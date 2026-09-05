import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Typography, Space, Button, Alert, Tag, Modal, Tabs } from 'antd';
import {
  ReloadOutlined,
  WarningOutlined,
  FileSearchOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { statApi } from '../../api/stat';
import { BigObjRank, LeakEvent, PageTimeItem } from '../../types';
import { QuickRange, TimeRangeSelector } from '../../components/TimeRangeSelector';
import { formatBytes, formatChartTime, formatNumber, formatTime } from '../../utils/format';
import { useAppStore } from '../../stores/useAppStore';

const { Title } = Typography;

export interface RuntimeStatPageProps {
  isModal?: boolean;
  defaultTab?: 'all' | 'goroutine' | 'big' | 'leak';
}

export const RuntimeStatPage: React.FC<RuntimeStatPageProps> = ({
  isModal = false,
  defaultTab = 'all',
}) => {
  const [activeTab, setActiveTab] = useState<string>(
    defaultTab === 'all' ? 'goroutine' : defaultTab
  );

  useEffect(() => {
    if (defaultTab && defaultTab !== 'all') {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  const [timeRange, setTimeRange] = useState<[number, number]>([
    dayjs().subtract(6, 'hour').unix(),
    dayjs().unix(),
  ]);

  // Goroutine Chart
  const [goroutineData, setGoroutineData] = useState<PageTimeItem[]>([]);

  // Big Objects
  const [bigObjects, setBigObjects] = useState<BigObjRank[]>([]);
  const [bigObjTotal, setBigObjTotal] = useState(0);
  const [bigObjPage, setBigObjPage] = useState(1);
  const [bigObjSize, setBigObjSize] = useState(10);
  const [bigObjLoading, setBigObjLoading] = useState(false);

  // Leak Events
  const [latestLeak, setLatestLeak] = useState<LeakEvent | null>(null);
  const [leakEvents, setLeakEvents] = useState<LeakEvent[]>([]);
  const [leakTotal, setLeakTotal] = useState(0);
  const [leakPage, setLeakPage] = useState(1);
  const [leakPageSize, setLeakPageSize] = useState(5);
  const [leakLoading, setLeakLoading] = useState(false);

  // Modal for Leak Event details
  const [selectedLeak, setSelectedLeak] = useState<LeakEvent | null>(null);

  const { theme } = useAppStore();

  const fetchGoroutines = useCallback(async (range: [number, number]) => {
    try {
      const diffHours = (range[1] - range[0]) / 3600;
      let unit = 'minute';
      if (diffHours > 24) unit = 'hour';

      const res = await statApi.getGoroutineTime({
        start: range[0],
        end: range[1],
        unit,
      });
      setGoroutineData(res || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchBigObjects = useCallback(async (range: [number, number], p = bigObjPage, s = bigObjSize) => {
    setBigObjLoading(true);
    try {
      const res = await statApi.getMemBigTop({
        start: range[0],
        end: range[1],
        page: p,
        size: s,
        sortBy: 'inuseSpace',
        asc: false,
      });
      setBigObjects(res.items || []);
      setBigObjTotal(res.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setBigObjLoading(false);
    }
  }, [bigObjPage, bigObjSize]);

  const fetchLeakEvents = useCallback(async (range: [number, number], p = leakPage, s = leakPageSize) => {
    setLeakLoading(true);
    try {
      const [latest, pageRes] = await Promise.all([
        statApi.getMemLeakLatest(),
        statApi.getMemLeakPage({
          start: range[0],
          end: range[1],
          page: p,
          size: s,
        }),
      ]);
      setLatestLeak(latest);
      setLeakEvents(pageRes.items || []);
      setLeakTotal(pageRes.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLeakLoading(false);
    }
  }, [leakPage, leakPageSize]);

  const refreshAll = useCallback(() => {
    fetchGoroutines(timeRange);
    fetchBigObjects(timeRange);
    fetchLeakEvents(timeRange);
  }, [fetchGoroutines, fetchBigObjects, fetchLeakEvents, timeRange]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleRangeChange = (range: [number, number], _quick: QuickRange) => {
    setTimeRange(range);
    fetchGoroutines(range);
    fetchBigObjects(range, 1, bigObjSize);
    fetchLeakEvents(range, 1, leakPageSize);
  };

  // ECharts Option
  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const splitLineColor = isDark ? '#334155' : '#f1f5f9';

  const timestamps = goroutineData.map((d) => d.at);
  const spanSeconds = timeRange[1] - timeRange[0];
  const xTimeLabels = timestamps.map((ts) => formatChartTime(ts, spanSeconds));

  const getGoroutineChartOption = () => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      textStyle: { color: isDark ? '#f8fafc' : '#1e293b' },
      formatter: (params: any[]) => {
        if (!params || !params.length) return '';
        const idx = params[0].dataIndex;
        const timeStr = formatTime(timestamps[idx]);
        let html = `<div style="font-weight:600;margin-bottom:6px;font-size:12px">${timeStr}</div>`;
        params.forEach((item) => {
          html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin:3px 0;font-size:12px;">
            <span>${item.marker} ${item.seriesName}</span>
            <span style="font-weight:600;font-family:monospace">${formatNumber(item.value)}</span>
          </div>`;
        });
        return html;
      },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: xTimeLabels,
      axisLabel: { color: textColor, fontSize: 11 },
      axisLine: { lineStyle: { color: splitLineColor } },
    },
    yAxis: {
      type: 'value',
      name: '活跃协程数',
      axisLabel: { color: textColor },
      splitLine: { lineStyle: { color: splitLineColor } },
    },
    series: [
      {
        name: 'Goroutine 数量',
        type: 'line',
        smooth: true,
        data: goroutineData.map((d) => d.value?.count || 0),
        itemStyle: { color: '#0ea5e9' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(14, 165, 233, 0.3)' },
              { offset: 1, color: 'rgba(14, 165, 233, 0.0)' },
            ],
          },
        },
      },
    ],
  });

  const bigObjColumns = [
    {
      title: '分配函数 (Function)',
      dataIndex: 'func',
      key: 'func',
      render: (f: string) => <span className="font-mono text-xs font-semibold">{f}</span>,
    },
    {
      title: '代码位置',
      key: 'pos',
      render: (_: any, r: BigObjRank) => (
        <span className="font-mono text-xs text-gray-500">
          {r.file.split('/').pop()}:{r.line}
        </span>
      ),
    },
    {
      title: '在用内存空间 (Inuse Space)',
      dataIndex: 'inuseSpace',
      key: 'inuseSpace',
      render: (bytes: number) => (
        <Tag color="volcano" className="font-mono font-bold">
          {formatBytes(bytes)}
        </Tag>
      ),
    },
    {
      title: '在用对象数量',
      dataIndex: 'inuseObjects',
      key: 'inuseObjects',
      render: (obj: number) => formatNumber(obj),
    },
    {
      title: '平均单对象尺寸',
      dataIndex: 'avgObjSize',
      key: 'avgObjSize',
      render: (size: number) => formatBytes(size),
    },
    {
      title: '采样时间',
      dataIndex: 'lastAt',
      key: 'lastAt',
      render: (ts: number) => formatTime(ts),
    },
  ];

  const leakColumns = [
    {
      title: '捕获时间',
      dataIndex: 'at',
      key: 'at',
      render: (ts: number) => formatTime(ts),
    },
    {
      title: 'GC 窗口增长内存 (AllocDelta)',
      dataIndex: 'allocDelta',
      key: 'allocDelta',
      render: (bytes: number) => (
        <span className="font-mono text-red-600 font-bold">+{formatBytes(bytes)}</span>
      ),
    },
    {
      title: 'GC 窗口增长对象数',
      dataIndex: 'objectDelta',
      key: 'objectDelta',
      render: (cnt: number) => (
        <span className="font-mono text-red-600 font-bold">+{formatNumber(cnt)}</span>
      ),
    },
    {
      title: '异常增长嫌疑函数数',
      dataIndex: 'points',
      key: 'points',
      render: (pts: any[]) => `${pts?.length || 0} 个函数`,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, r: LeakEvent) => (
        <Button
          type="link"
          size="small"
          icon={<FileSearchOutlined />}
          onClick={() => setSelectedLeak(r)}
        >
          查看泄漏调用链
        </Button>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'goroutine',
      label: 'Goroutine 活跃走势',
      children: (
        <Card className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
          <ReactECharts option={getGoroutineChartOption()} style={{ height: 320 }} />
        </Card>
      ),
    },
    {
      key: 'big',
      label: `堆内存大对象 (${bigObjTotal})`,
      children: (
        <Card className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
          <Table
            dataSource={bigObjects}
            columns={bigObjColumns}
            rowKey={(r) => `${r.func}-${r.file}-${r.line}`}
            loading={bigObjLoading}
            pagination={{
              current: bigObjPage,
              pageSize: bigObjSize,
              total: bigObjTotal,
              onChange: (p, s) => {
                setBigObjPage(p);
                setBigObjSize(s);
                fetchBigObjects(timeRange, p, s);
              },
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个大对象分配点`,
            }}
            size="middle"
          />
        </Card>
      ),
    },
    {
      key: 'leak',
      label: `内存泄漏事件 (${leakTotal})`,
      children: (
        <div className="space-y-4">
          {latestLeak ? (
            <Alert
              message="检测到内存泄漏事件"
              description={`最新捕获时间: ${formatTime(latestLeak.at)}，GC 窗口内存突增 +${formatBytes(
                latestLeak.allocDelta
              )} (增量对象: +${formatNumber(latestLeak.objectDelta)})，检测到 ${
                latestLeak.points?.length || 0
              } 个持续增长函数。`}
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              action={
                <Button size="small" danger onClick={() => setSelectedLeak(latestLeak)}>
                  查看详情
                </Button>
              }
              className="rounded-xl"
            />
          ) : (
            <Alert
              message="内存运行状态健康"
              description="当前滑动 GC 窗口内未发生持续性内存分配异常（HeapAlloc 增量 < 100MB 阈值）。"
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              className="rounded-xl"
            />
          )}
          <Card className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
            <Table
              dataSource={leakEvents}
              columns={leakColumns}
              rowKey="at"
              loading={leakLoading}
              pagination={{
                current: leakPage,
                pageSize: leakPageSize,
                total: leakTotal,
                onChange: (p, s) => {
                  setLeakPage(p);
                  setLeakPageSize(s);
                  fetchLeakEvents(timeRange, p, s);
                },
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 次泄漏事件`,
              }}
              size="middle"
            />
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {!isModal ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <Title level={4} className="!mb-1 text-gray-800 dark:text-white">
                协程与内存诊断
              </Title>
              <span className="text-xs text-gray-500">
                监控 Go 运行时 Goroutine 协程暴涨趋势，解析 Heap Profile 采样内存大对象 Top50 与 GC 窗口内存泄漏
              </span>
            </div>
            <Space>
              <TimeRangeSelector onChange={handleRangeChange} defaultQuick="6h" />
              <Button icon={<ReloadOutlined />} onClick={refreshAll} size="small">
                刷新
              </Button>
            </Space>
          </div>

          {/* Memory Leak Banner */}
          {latestLeak ? (
            <Alert
              message="检测到内存泄漏事件"
              description={`最新捕获时间: ${formatTime(latestLeak.at)}，GC 窗口内存突增 +${formatBytes(
                latestLeak.allocDelta
              )} (增量对象: +${formatNumber(latestLeak.objectDelta)})，检测到 ${
                latestLeak.points?.length || 0
              } 个持续增长函数。`}
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              action={
                <Button size="small" danger onClick={() => setSelectedLeak(latestLeak)}>
                  查看详情
                </Button>
              }
              className="rounded-xl"
            />
          ) : (
            <Alert
              message="内存运行状态健康"
              description="当前滑动 GC 窗口内未发生持续性内存分配异常（HeapAlloc 增量 < 100MB 阈值）。"
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              className="rounded-xl"
            />
          )}

          {/* Goroutine Trend Chart */}
          <Card
            title={<span className="text-sm font-semibold">Goroutine 协程数量走势</span>}
            className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800"
          >
            <ReactECharts option={getGoroutineChartOption()} style={{ height: 260 }} />
          </Card>

          {/* Heap Big Objects */}
          <Card
            title={<span className="text-sm font-semibold">堆内存大对象排行榜 Top50</span>}
            className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800"
          >
            <Table
              dataSource={bigObjects}
              columns={bigObjColumns}
              rowKey={(r) => `${r.func}-${r.file}-${r.line}`}
              loading={bigObjLoading}
              pagination={{
                current: bigObjPage,
                pageSize: bigObjSize,
                total: bigObjTotal,
                onChange: (p, s) => {
                  setBigObjPage(p);
                  setBigObjSize(s);
                  fetchBigObjects(timeRange, p, s);
                },
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 个大对象分配点`,
              }}
              size="middle"
            />
          </Card>

          {/* Memory Leak Events */}
          <Card
            title={<span className="text-sm font-semibold">内存泄漏捕获历史</span>}
            className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800"
          >
            <Table
              dataSource={leakEvents}
              columns={leakColumns}
              rowKey="at"
              loading={leakLoading}
              pagination={{
                current: leakPage,
                pageSize: leakPageSize,
                total: leakTotal,
                onChange: (p, s) => {
                  setLeakPage(p);
                  setLeakPageSize(s);
                  fetchLeakEvents(timeRange, p, s);
                },
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 次泄漏事件`,
              }}
              size="middle"
            />
          </Card>
        </>
      ) : (
        <>
          <div className="flex justify-end mb-2">
            <Space>
              <TimeRangeSelector onChange={handleRangeChange} defaultQuick="6h" />
              <Button icon={<ReloadOutlined />} onClick={refreshAll} size="small">
                刷新
              </Button>
            </Space>
          </div>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
        </>
      )}

      {/* Leak Event Points Modal */}
      <Modal
        title="内存泄漏疑点函数调用栈"
        open={!!selectedLeak}
        onCancel={() => setSelectedLeak(null)}
        footer={null}
        width={750}
      >
        {selectedLeak && (
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-xs font-mono">
              <span>捕获时间: {formatTime(selectedLeak.at)}</span>
              <span>内存突增: +{formatBytes(selectedLeak.allocDelta)}</span>
              <span>对象突增: +{formatNumber(selectedLeak.objectDelta)}</span>
            </div>

            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              异常增长函数 Top 列表 (与 Base Profile 对比):
            </div>

            <Table
              dataSource={selectedLeak.points || []}
              rowKey={(r) => `${r.func}-${r.file}-${r.line}`}
              pagination={false}
              size="small"
              columns={[
                {
                  title: '函数',
                  dataIndex: 'func',
                  key: 'func',
                  render: (f: string) => <span className="font-mono text-xs font-bold">{f}</span>,
                },
                {
                  title: '源码位置',
                  key: 'pos',
                  render: (_: any, r: any) => (
                    <span className="font-mono text-xs text-gray-500">
                      {r.file.split('/').pop()}:{r.line}
                    </span>
                  ),
                },
                {
                  title: '差值空间 (Delta Space)',
                  dataIndex: 'deltaSpace',
                  key: 'deltaSpace',
                  render: (bytes: number) => (
                    <span className="font-mono text-xs text-red-500 font-bold">
                      +{formatBytes(bytes)}
                    </span>
                  ),
                },
                {
                  title: '差值对象数',
                  dataIndex: 'deltaObjects',
                  key: 'deltaObjects',
                  render: (cnt: number) => (
                    <span className="font-mono text-xs text-red-500">
                      +{formatNumber(cnt)}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};
