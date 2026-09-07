import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, Row, Col, Space, Button, Progress, Popconfirm, Modal } from 'antd';
import {
  SyncOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  HddOutlined,
  RightOutlined,
  WarningFilled,
  DashboardOutlined,
  AreaChartOutlined,
  DatabaseOutlined,
  ThunderboltFilled,
  PlusOutlined,
  ApiOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { hostApi } from '../../api/host';
import { appApi } from '../../api/app';
import { statApi } from '../../api/stat';
import { ApiLatencySummary, PageTimeItem, ReStartLog, ResType, ResUsage } from '../../types';
import { TimeRangeSelector } from '../../components/TimeRangeSelector';
import { PageHeader } from '../../components/PageHeader';
import { formatChartTime, formatLatency, formatMB, formatNumber, formatTime } from '../../utils/format';
import { useAppStore } from '../../stores/useAppStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { message } from '../../utils/antMsg';

import { AppManagePage } from '../app/AppManagePage';
import { ApiStatPage } from '../stats/ApiStatPage';
import { ErrorStatPage } from '../stats/ErrorStatPage';
import { RuntimeStatPage } from '../stats/RuntimeStatPage';

export const DashboardPage: React.FC = () => {
  const { connections, activeId } = useAuthStore();
  const [restarting, setRestarting] = useState(false);

  // App & Host Data
  const [latestRestart, setLatestRestart] = useState<ReStartLog | null>(null);
  const [latestUsage, setLatestUsage] = useState<ResUsage | null>(null);

  // Stats Data
  const [todayErrors, setTodayErrors] = useState(0);
  const [todayPanics, setTodayPanics] = useState(0);
  const [apiSummary, setApiSummary] = useState<ApiLatencySummary | null>(null);
  const [goroutineData, setGoroutineData] = useState<PageTimeItem[]>([]);
  const [bigObjCount, setBigObjCount] = useState<number>(0);
  const [leakCount, setLeakCount] = useState<number>(0);

  // Modal Dialog States
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [hostModalOpen, setHostModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [runtimeModalOpen, setRuntimeModalOpen] = useState(false);
  const [runtimeTab, setRuntimeTab] = useState<'goroutine' | 'big' | 'leak'>('goroutine');

  // Trend Charts for Host Modal
  const [hostRange, setHostRange] = useState<[number, number]>([
    dayjs().subtract(1, 'hour').unix(),
    dayjs().unix(),
  ]);
  const [hostTrends, setHostTrends] = useState<PageTimeItem[]>([]);
  const [hostTrendsLoading, setHostTrendsLoading] = useState(false);

  const { theme } = useAppStore();

  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);

  // Fetch all overview data
  const fetchAllData = useCallback(async () => {
    if (connections.length === 0 || !activeId) {
      return;
    }
    const nowMs = Date.now();
    // Prevent duplicate fetch within 350ms or while already running
    if (nowMs - lastFetchTimeRef.current < 350 || isFetchingRef.current) {
      return;
    }
    lastFetchTimeRef.current = nowMs;
    isFetchingRef.current = true;

    const todayStart = dayjs().startOf('day').unix();
    const now = dayjs().unix();

    try {
      const [usageRes, appRes, apiRes, errTimeRes, gorTimeRes, bigRes, leakRes] = await Promise.allSettled([
        hostApi.getUsage(1, 1),
        appApi.getRestartLogs(1, 5),
        statApi.getApiSummary(todayStart, now),
        statApi.getErrorTimeRange({ start: todayStart, end: now, unit: 'hour', filter: ['panic', 'error', 'warn'] }),
        statApi.getGoroutineTime({ start: todayStart, end: now, unit: 'hour' }),
        statApi.getMemBigCount(todayStart, now),
        statApi.getMemLeakCount(todayStart, now),
      ]);

      if (usageRes.status === 'fulfilled' && usageRes.value?.items?.[0]) {
        setLatestUsage(usageRes.value.items[0]);
      }
      if (appRes.status === 'fulfilled' && appRes.value?.items?.[0]) {
        setLatestRestart(appRes.value.items[0]);
      }
      if (apiRes.status === 'fulfilled' && apiRes.value) {
        setApiSummary(apiRes.value);
      }
      if (errTimeRes.status === 'fulfilled' && errTimeRes.value) {
        let errCount = 0;
        let panicCount = 0;
        errTimeRes.value.forEach((item) => {
          errCount += item.value?.error || 0;
          panicCount += item.value?.panic || 0;
        });
        setTodayErrors(errCount);
        setTodayPanics(panicCount);
      }
      if (gorTimeRes.status === 'fulfilled' && gorTimeRes.value) {
        setGoroutineData(gorTimeRes.value);
      }
      if (bigRes.status === 'fulfilled' && typeof bigRes.value === 'number') {
        setBigObjCount(bigRes.value);
      }
      if (leakRes.status === 'fulfilled' && typeof leakRes.value === 'number') {
        setLeakCount(leakRes.value);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // Fetch host modal trends
  const fetchHostTrends = useCallback(async (range: [number, number]) => {
    setHostTrendsLoading(true);
    try {
      const diffHours = (range[1] - range[0]) / 3600;
      let unit: 'minute' | '5m' | '10m' | '30m' | 'hour' | 'day' = 'minute';
      if (diffHours > 72) unit = 'day';
      else if (diffHours > 24) unit = 'hour';
      else if (diffHours > 6) unit = '10m';

      const filter: ResType[] = ['cpu', 'appCpu', 'mem', 'appMem', 'totalMem', 'disk', 'appDisk', 'totalDisk'];
      const items = await hostApi.getTimeRange({
        start: range[0],
        end: range[1],
        unit,
        filter,
      });
      setHostTrends(items || []);
    } catch (err) {
      console.error('Failed to fetch host trends:', err);
    } finally {
      setHostTrendsLoading(false);
    }
  }, []);

  // Real-time ticking second counter for uptime (ticks every second live)
  const [nowSec, setNowSec] = useState(() => dayjs().unix());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(dayjs().unix());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load once on mount and subscribe to service switch / manual refresh
  useEffect(() => {
    if (connections.length === 0 || !activeId) return;
    fetchAllData();
    const handleReload = () => {
      if (useAuthStore.getState().connections.length > 0) {
        fetchAllData();
      }
    };
    window.addEventListener('gorig_service_switched', handleReload);
    window.addEventListener('gorig_manual_refresh', handleReload);
    return () => {
      window.removeEventListener('gorig_service_switched', handleReload);
      window.removeEventListener('gorig_manual_refresh', handleReload);
    };
  }, [connections.length, activeId, fetchAllData]);

  useEffect(() => {
    if (hostModalOpen) {
      fetchHostTrends(hostRange);
    }
  }, [hostModalOpen, hostRange, fetchHostTrends]);

  // Handle system restart
  const handleSystemRestart = async () => {
    setRestarting(true);
    try {
      await appApi.restart();
      message.success('已触发应用平滑重启脚本，看门狗正在重新载入...');
      setTimeout(fetchAllData, 2000);
    } catch (err: any) {
      message.error(err.message || '重启系统失败');
    } finally {
      setRestarting(false);
    }
  };

  // Metric values calculation
  const cpuPct = latestUsage ? Math.min(100, Math.max(0, parseFloat(latestUsage.cpu || '0'))) : 0;
  const appCpuPct = latestUsage ? parseFloat(latestUsage.appCpu || '0') : 0;
  const cpuCores = latestUsage?.cpuNum || 4;

  const memUsedMB = latestUsage ? parseFloat(latestUsage.mem || '0') : 0;
  const memTotalMB = latestUsage ? parseFloat(latestUsage.totalMem || '0') : 0;
  const memPct = memTotalMB > 0 ? parseFloat(((memUsedMB / memTotalMB) * 100).toFixed(1)) : 0;
  const appMemMB = latestUsage ? parseFloat(latestUsage.appMem || '0') : 0;
  const appMemPct = memTotalMB > 0 ? parseFloat(((appMemMB / memTotalMB) * 100).toFixed(2)) : 0;

  const diskUsedMB = latestUsage ? parseFloat(latestUsage.disk || '0') : 0;
  const diskTotalMB = latestUsage ? parseFloat(latestUsage.totalDisk || '0') : 0;
  const diskPct = diskTotalMB > 0 ? parseFloat(((diskUsedMB / diskTotalMB) * 100).toFixed(1)) : 0;
  const appDiskMB = latestUsage ? parseFloat(latestUsage.appDisk || '0') : 0;
  const appDiskPct = diskTotalMB > 0 ? parseFloat(((appDiskMB / diskTotalMB) * 100).toFixed(1)) : 0;

  // Uptime calculation (updates every second via nowSec)
  const startTimestamp = latestRestart?.startTime || (latestUsage?.at ? latestUsage.at - 89248 : dayjs().subtract(1, 'day').unix());
  const diffSec = Math.max(0, nowSec - startTimestamp);
  const uptimeDays = Math.floor(diffSec / 86400);
  const uptimeHours = Math.floor((diffSec % 86400) / 3600);
  const uptimeMinutes = Math.floor((diffSec % 3600) / 60);
  const uptimeSeconds = diffSec % 60;
  const uptimeString = `${uptimeDays > 0 ? `${uptimeDays}天` : ''}${uptimeHours}小时${uptimeMinutes}分${uptimeSeconds}秒`;
  const startTimeDisplay = formatTime(startTimestamp);
  const startSrcDisplay = latestRestart?.startSrc === 'deploy' ? '部署' : latestRestart?.startSrc === 'crash' ? '崩溃自愈' : '手动';

  // Latest Goroutines count
  const latestGorItem = goroutineData.length > 0 ? goroutineData[goroutineData.length - 1] : null;
  const currentGoroutines = latestGorItem
    ? Math.round(latestGorItem.value?.count ?? latestGorItem.value?.goroutine ?? 0)
    : 0;

  // ECharts Goroutine Area Option
  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const splitLineColor = isDark ? '#334155' : '#f1f5f9';

  const gorTimestamps = goroutineData.map((d) => d.at);
  const gorLabels = gorTimestamps.map((ts) => formatChartTime(ts, 86400));

  const getGoroutineOption = () => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      textStyle: { color: isDark ? '#f8fafc' : '#1e293b' },
      formatter: (params: any[]) => {
        if (!params || !params.length) return '';
        const idx = params[0].dataIndex;
        const timeStr = formatTime(gorTimestamps[idx]);
        return `<div style="font-size:12px">
          <div style="font-weight:600;margin-bottom:4px">${timeStr}</div>
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <span>活跃协程:</span>
            <span style="font-weight:700;color:#0284c7">${formatNumber(params[0].value)}</span>
          </div>
        </div>`;
      },
    },
    grid: { left: '1%', right: '2%', bottom: '0%', top: '14%', containLabel: true },
    xAxis: {
      type: 'category',
      data: gorLabels.length > 0 ? gorLabels : [],
      axisLabel: { color: textColor, fontSize: 10 },
      axisLine: { lineStyle: { color: splitLineColor } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: textColor, fontSize: 10 },
      splitLine: { lineStyle: { color: splitLineColor } },
      min: (val: any) => Math.max(0, Math.floor(val.min * 0.8)),
    },
    series: [
      {
        name: '活跃协程数',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: goroutineData.length > 0
          ? goroutineData.map((d) => Math.round(d.value?.count ?? d.value?.goroutine ?? 0))
          : [],
        itemStyle: { color: '#0ea5e9' },
        lineStyle: { width: 2.5, color: '#0ea5e9' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(14, 165, 233, 0.35)' },
              { offset: 1, color: 'rgba(14, 165, 233, 0.02)' },
            ],
          },
        },
      },
    ],
  });

  // Host modal trend charts options
  const hostTimestamps = hostTrends.map((d) => d.at);
  const hostLabels = hostTimestamps.map((ts) => formatChartTime(ts, hostRange[1] - hostRange[0]));

  const getHostCpuChartOption = () => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: textColor }, right: 10 },
    grid: { left: '3%', right: '4%', bottom: '3%', top: 35, containLabel: true },
    xAxis: { type: 'category', data: hostLabels, axisLabel: { color: textColor, fontSize: 11 } },
    yAxis: { type: 'value', max: 100, axisLabel: { color: textColor, formatter: '{value}%' } },
    series: [
      {
        name: '宿主整体 CPU',
        type: 'line',
        smooth: true,
        data: hostTrends.map((d) => (d.value?.cpu !== undefined ? +d.value.cpu.toFixed(2) : 0)),
        itemStyle: { color: '#6366f1' },
      },
      {
        name: '应用进程 CPU',
        type: 'line',
        smooth: true,
        data: hostTrends.map((d) => (d.value?.appCpu !== undefined ? +d.value.appCpu.toFixed(2) : 0)),
        itemStyle: { color: '#06b6d4' },
      },
    ],
  });

  const getHostMemChartOption = () => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: textColor }, right: 10 },
    grid: { left: '3%', right: '4%', bottom: '3%', top: 35, containLabel: true },
    xAxis: { type: 'category', data: hostLabels, axisLabel: { color: textColor, fontSize: 11 } },
    yAxis: { type: 'value', max: 100, axisLabel: { color: textColor, formatter: '{value}%' } },
    series: [
      {
        name: '宿主内存使用率',
        type: 'line',
        smooth: true,
        data: hostTrends.map((d) => {
          const used = d.value?.mem || 0;
          const total = d.value?.totalMem || memTotalMB;
          return total > 0 ? +((used / total) * 100).toFixed(2) : 0;
        }),
        itemStyle: { color: '#10b981' },
      },
      {
        name: '应用内存占比',
        type: 'line',
        smooth: true,
        data: hostTrends.map((d) => {
          const appMem = d.value?.appMem || 0;
          const total = d.value?.totalMem || memTotalMB;
          return total > 0 ? +((appMem / total) * 100).toFixed(2) : 0;
        }),
        itemStyle: { color: '#f59e0b' },
      },
    ],
  });

  // If no connections configured, do not show the overview page at all
  if (connections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[520px] p-8 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-3xl mb-4 shadow-sm">
          <ApiOutlined />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
          未配置服务连接
        </h3>
        <p className="text-sm text-gray-400 dark:text-gray-500 max-w-md mb-6 leading-relaxed">
          当前系统尚未配置任何 Gorig-OM 后端服务连接。请先添加一个服务连接以查看主机指标、运行时监控与系统概览大盘。
        </p>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => window.dispatchEvent(new CustomEvent('gorig_open_connection_modal'))}
          className="bg-indigo-600 hover:bg-indigo-700 h-10 px-6 rounded-xl text-sm font-medium shadow-sm"
        >
          添加新服务连接
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {/* 1. Unified Page Header */}
      <PageHeader
        icon={<DashboardOutlined />}
        title="系统概览"
        description={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 font-normal">
            <div>
              <span className="text-gray-400 mr-1">运行时长:</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200 font-mono">{uptimeString}</span>
            </div>
            <div>
              <span className="text-gray-400 mr-1">启动时间:</span>
              <span className="font-mono">{startTimeDisplay}</span>
            </div>
            <div>
              <span className="text-gray-400 mr-1">启动方式:</span>
              <span
                className="text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer hover:underline"
                onClick={() => setAppModalOpen(true)}
              >
                {startSrcDisplay}
              </span>
            </div>
          </div>
        }
        extra={
          <Space size="middle">
            <Button
              size="middle"
              icon={<HistoryOutlined className="text-base" />}
              onClick={() => setAppModalOpen(true)}
              className="text-sm font-medium rounded-lg h-9 px-4"
            >
              更多记录
            </Button>

            <Popconfirm
              title="确定重启应用服务？"
              description="将向当前进程发送 SIGTERM 执行平滑重载，守护脚本将重新启动应用。"
              onConfirm={handleSystemRestart}
              okText="立即重启"
              cancelText="取消"
              okButtonProps={{ danger: true, loading: restarting }}
            >
              <Button
                type="primary"
                size="middle"
                icon={<SyncOutlined spin={restarting} className="text-base" />}
                loading={restarting}
                className="text-sm font-medium bg-amber-500 hover:bg-amber-600 border-amber-500 rounded-lg h-9 px-4 shadow-sm"
              >
                重启系统
              </Button>
            </Popconfirm>
          </Space>
        }
      />

      {/* 2. Three Core Resource Cards (CPU, 内存, 磁盘) - Height identical to Row 3 */}
      <Row gutter={[12, 12]} align="stretch" className="items-stretch">
        {/* CPU Card */}
        <Col xs={24} md={8} className="flex flex-col" style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            onClick={() => setHostModalOpen(true)}
            className="bg-white dark:bg-slate-900 rounded-lg p-3.5 shadow-sm border border-gray-100 dark:border-slate-800 hover:shadow-md transition cursor-pointer group flex-1 flex flex-col justify-between min-h-[118px]"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-gray-900 dark:text-white text-sm flex items-center">
                  <ThunderboltOutlined className="mr-1.5 text-indigo-500 text-sm" />
                  CPU
                </span>
                <span className="text-xs text-gray-500 font-mono group-hover:text-indigo-600 transition">
                  {cpuCores} 核 <RightOutlined className="text-[10px] ml-1 opacity-0 group-hover:opacity-100" />
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs mb-1.5">
                <span className="text-[11px] text-gray-400">使用率</span>
                <span className="font-mono text-gray-700 dark:text-gray-300 text-xs">
                  应用 <strong className="text-indigo-600 dark:text-indigo-400">{appCpuPct.toFixed(1)}%</strong> / 系统 <strong className="font-semibold">{cpuPct.toFixed(2)}%</strong>
                </span>
              </div>
              <Progress
                percent={cpuPct}
                showInfo={false}
                size="small"
                strokeColor="#22c55e"
                trailColor={isDark ? '#334155' : '#f1f5f9'}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-gray-100 dark:border-slate-800 mt-2 text-gray-400">
              <span>系统总负载: {cpuPct.toFixed(1)}%</span>
              <span className="group-hover:text-indigo-500 transition">点击查看趋势</span>
            </div>
          </div>
        </Col>

        {/* 内存 Card */}
        <Col xs={24} md={8} className="flex flex-col" style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            onClick={() => setHostModalOpen(true)}
            className="bg-white dark:bg-slate-900 rounded-lg p-3.5 shadow-sm border border-gray-100 dark:border-slate-800 hover:shadow-md transition cursor-pointer group flex-1 flex flex-col justify-between min-h-[118px]"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-gray-900 dark:text-white text-sm flex items-center">
                  <FileTextOutlined className="mr-1.5 text-emerald-500 text-sm" />
                  内存
                </span>
                <span className="text-xs text-gray-500 font-mono group-hover:text-emerald-600 transition">
                  {formatMB(memTotalMB)} <RightOutlined className="text-[10px] ml-1 opacity-0 group-hover:opacity-100" />
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs mb-1.5">
                <span className="text-[11px] text-gray-400">使用率</span>
                <span className="font-mono text-gray-700 dark:text-gray-300 text-xs">
                  应用 <strong className="text-emerald-600 dark:text-emerald-400">{appMemPct.toFixed(2)}%</strong> / 系统 <strong className="font-semibold">{memPct.toFixed(2)}%</strong>
                </span>
              </div>
              <Progress
                percent={memPct}
                showInfo={false}
                size="small"
                strokeColor="#22c55e"
                trailColor={isDark ? '#334155' : '#f1f5f9'}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-gray-100 dark:border-slate-800 mt-2 text-gray-400">
              <span>已用: {formatMB(appMemMB)} ({formatMB(memUsedMB)})</span>
              <span className="group-hover:text-emerald-500 transition">点击查看趋势</span>
            </div>
          </div>
        </Col>

        {/* 磁盘 Card */}
        <Col xs={24} md={8} className="flex flex-col" style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            onClick={() => setHostModalOpen(true)}
            className="bg-white dark:bg-slate-900 rounded-lg p-3.5 shadow-sm border border-gray-100 dark:border-slate-800 hover:shadow-md transition cursor-pointer group flex-1 flex flex-col justify-between min-h-[118px]"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-gray-900 dark:text-white text-sm flex items-center">
                  <HddOutlined className="mr-1.5 text-blue-500 text-sm" />
                  磁盘
                </span>
                <span className="text-xs text-gray-500 font-mono group-hover:text-blue-600 transition">
                  {formatMB(diskTotalMB)} <RightOutlined className="text-[10px] ml-1 opacity-0 group-hover:opacity-100" />
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs mb-1.5">
                <span className="text-[11px] text-gray-400">使用率</span>
                <span className="font-mono text-gray-700 dark:text-gray-300 text-xs">
                  应用 <strong className="text-blue-600 dark:text-blue-400">{appDiskPct.toFixed(1)}%</strong> / 系统 <strong className="font-semibold">{diskPct.toFixed(2)}%</strong>
                </span>
              </div>
              <Progress
                percent={diskPct}
                showInfo={false}
                size="small"
                strokeColor="#3b82f6"
                trailColor={isDark ? '#334155' : '#f1f5f9'}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-gray-100 dark:border-slate-800 mt-2 text-gray-400">
              <span>已用: {formatMB(appDiskMB)} ({formatMB(diskUsedMB)})</span>
              <span className="group-hover:text-blue-500 transition">点击查看趋势</span>
            </div>
          </div>
        </Col>
      </Row>

      {/* 3. Today Anomaly & API Latency Row - Height identical to Row 2 */}
      <Row gutter={[12, 12]} align="stretch" className="items-stretch">
        {/* 今日异常 */}
        <Col xs={24} lg={8} className="flex flex-col" style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            onClick={() => setErrorModalOpen(true)}
            className="bg-rose-50/50 dark:bg-rose-950/20 rounded-lg p-3.5 shadow-sm border border-rose-100/80 dark:border-rose-900/30 hover:shadow-md transition cursor-pointer flex flex-col justify-between flex-1 group min-h-[118px]"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900 dark:text-white text-sm">
                  今日异常
                </span>
                <div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-500 flex items-center justify-center text-sm shadow-sm">
                  <WarningFilled />
                </div>
              </div>

              <div className="flex items-baseline space-x-5 mt-0.5">
                <div>
                  <span className="text-[11px] text-rose-500 font-semibold mr-1">ERROR</span>
                  <span className="text-xl font-bold font-mono text-gray-900 dark:text-white mr-1">
                    {todayErrors}
                  </span>
                  <span className="text-[11px] text-gray-400">次</span>
                </div>
                <div>
                  <span className="text-[11px] text-amber-500 font-semibold mr-1">PANIC</span>
                  <span className="text-xl font-bold font-mono text-gray-900 dark:text-white mr-1">
                    {todayPanics}
                  </span>
                  <span className="text-[11px] text-gray-400">次</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-rose-100/60 dark:border-rose-900/20 mt-2 text-gray-400">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {todayErrors === 0 ? '全天服务运行平稳' : '点击排查错误与调用栈'}
              </span>
              <span>更新于 {formatTime(Date.now(), 'HH:mm')}</span>
            </div>
          </div>
        </Col>

        {/* 今日 API 响应 */}
        <Col xs={24} lg={16} className="flex flex-col" style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            onClick={() => setApiModalOpen(true)}
            className="bg-emerald-50/40 dark:bg-emerald-950/20 rounded-lg p-3.5 shadow-sm border border-emerald-100/80 dark:border-emerald-900/30 hover:shadow-md transition cursor-pointer flex flex-col justify-between flex-1 group min-h-[118px]"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900 dark:text-white text-sm">
                  今日 API 响应
                </span>
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 flex items-center justify-center text-sm shadow-sm">
                  <DashboardOutlined />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-0.5">
                <div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">总请求数</div>
                  <div className="text-xl font-bold font-mono text-gray-900 dark:text-white">
                    {formatNumber(apiSummary?.count || 0)}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">平均耗时</div>
                  <div className="text-xl font-bold font-mono text-gray-900 dark:text-white">
                    {formatLatency(apiSummary?.avgLatency || 0)}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-rose-500 font-semibold mb-0.5">5XX 错误</div>
                  <div className="text-xl font-bold font-mono text-rose-600">
                    {apiSummary?.count5xx || 0}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-amber-500 font-semibold mb-0.5">慢响应 (&gt;200MS)</div>
                  <div className="text-xl font-bold font-mono text-amber-600">
                    {apiSummary?.slowCount || 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end text-[11px] pt-2 border-t border-emerald-100/60 dark:border-emerald-900/20 mt-2 text-gray-400">
              <span>更新于 {formatTime(Date.now(), 'HH:mm')}</span>
            </div>
          </div>
        </Col>
      </Row>

      {/* 4. Goroutine Trend & Big Objects / Memory Leaks (Reduced Height) */}
      <Row gutter={[12, 12]} align="stretch" className="items-stretch">
        {/* Left: 协程数量趋势 */}
        <Col xs={24} lg={16} className="flex flex-col" style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            onClick={() => {
              setRuntimeTab('goroutine');
              setRuntimeModalOpen(true);
            }}
            className="bg-white dark:bg-slate-900 rounded-lg p-3.5 shadow-sm border border-gray-100 dark:border-slate-800 hover:shadow-md transition cursor-pointer group flex-1 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-baseline space-x-2">
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">
                    协程数量趋势
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    当前: <strong className="text-sky-600 dark:text-sky-400 text-sm">{currentGoroutines}</strong>
                  </span>
                </div>
                <div className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-500 flex items-center justify-center text-xs">
                  <AreaChartOutlined />
                </div>
              </div>
            </div>

            <div className="flex-1 w-full" style={{ height: 130, minHeight: 130 }}>
              <ReactECharts option={getGoroutineOption()} style={{ height: '100%', minHeight: 130 }} />
            </div>
          </div>
        </Col>

        {/* Right: 大内存对象 & 内存异常事件 */}
        <Col xs={24} lg={8} className="flex flex-col gap-2.5" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* 大内存对象 */}
          <div
            onClick={() => {
              setRuntimeTab('big');
              setRuntimeModalOpen(true);
            }}
            className="bg-amber-50/40 dark:bg-amber-950/20 rounded-lg p-2.5 shadow-sm border border-amber-100/80 dark:border-amber-900/30 hover:shadow-md transition cursor-pointer flex flex-col justify-between flex-1 group"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900 dark:text-white text-xs">
                  大内存对象
                </span>
                <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 flex items-center justify-center text-xs">
                  <DatabaseOutlined />
                </div>
              </div>
              <div className="text-[11px] text-gray-500 mb-1">当前占用 &gt;1MB 的对象数量</div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black font-mono text-gray-900 dark:text-white">
                  {bigObjCount}
                </span>
                <span className="text-[11px] text-gray-500 font-bold text-emerald-500">↑ 正常</span>
              </div>
            </div>

            <div className="flex items-center justify-end text-[10px] pt-1.5 border-t border-amber-100/60 dark:border-amber-900/20 mt-1.5 text-gray-400">
              <span>更新于 {formatTime(Date.now(), 'HH:mm')}</span>
            </div>
          </div>

          {/* 内存异常事件 */}
          <div
            onClick={() => {
              setRuntimeTab('leak');
              setRuntimeModalOpen(true);
            }}
            className="bg-rose-50/40 dark:bg-rose-950/20 rounded-lg p-2.5 shadow-sm border border-rose-100/80 dark:border-rose-900/30 hover:shadow-md transition cursor-pointer flex flex-col justify-between flex-1 group"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900 dark:text-white text-xs">
                  内存异常事件
                </span>
                <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-500 flex items-center justify-center text-xs">
                  <ThunderboltFilled />
                </div>
              </div>
              <div className="text-[11px] text-gray-500 mb-1">今日检测到异常事件</div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black font-mono text-rose-600">
                  {leakCount}
                </span>
                <span className="text-[11px] text-gray-400">次</span>
              </div>
            </div>

            <div className="flex items-center justify-end text-[10px] pt-1.5 border-t border-rose-100/60 dark:border-rose-900/20 mt-1.5 text-gray-400">
              <span>更新于 {formatTime(Date.now(), 'HH:mm')}</span>
            </div>
          </div>
        </Col>
      </Row>

      {/* ================= MODALS ================= */}

      {/* 1. App Manage Modal */}
      <Modal
        title="应用生命周期管理与启动历史"
        open={appModalOpen}
        onCancel={() => setAppModalOpen(false)}
        width={1100}
        footer={null}
        destroyOnHidden
      >
        <AppManagePage isModal={true} />
      </Modal>

      {/* 2. Host Resource Trends Modal */}
      <Modal
        title="宿主 CPU、内存与磁盘详细趋势分析"
        open={hostModalOpen}
        onCancel={() => setHostModalOpen(false)}
        width={1100}
        footer={null}
        destroyOnHidden
      >
        <div className="space-y-6 pt-2">
          <div className="flex justify-end">
            <TimeRangeSelector onChange={(r) => { setHostRange(r); fetchHostTrends(r); }} />
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="CPU 利用率走势 (宿主 vs 应用)" className="rounded-xl border border-gray-100 dark:border-slate-800">
                <ReactECharts option={getHostCpuChartOption()} style={{ height: 300 }} showLoading={hostTrendsLoading} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="内存使用率走势 (宿主 vs 应用)" className="rounded-xl border border-gray-100 dark:border-slate-800">
                <ReactECharts option={getHostMemChartOption()} style={{ height: 300 }} showLoading={hostTrendsLoading} />
              </Card>
            </Col>
          </Row>
        </div>
      </Modal>

      {/* 3. Error Stat Modal */}
      <Modal
        title="异常统计与错误签名追踪"
        open={errorModalOpen}
        onCancel={() => setErrorModalOpen(false)}
        width={1150}
        footer={null}
        destroyOnHidden
      >
        <ErrorStatPage isModal={true} />
      </Modal>

      {/* 4. API Stat Modal */}
      <Modal
        title="API 性能分析与耗时排行"
        open={apiModalOpen}
        onCancel={() => setApiModalOpen(false)}
        width={1150}
        footer={null}
        destroyOnHidden
      >
        <ApiStatPage isModal={true} />
      </Modal>

      {/* 5. Runtime Stat Modal */}
      <Modal
        title="Go 运行时协程与内存深度诊断"
        open={runtimeModalOpen}
        onCancel={() => setRuntimeModalOpen(false)}
        width={1150}
        footer={null}
        destroyOnHidden
      >
        <RuntimeStatPage isModal={true} defaultTab={runtimeTab} />
      </Modal>
    </div>
  );
};
