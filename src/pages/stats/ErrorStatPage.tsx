import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Space, Button, Tag, Modal } from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  FileTextOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { statApi } from '../../api/stat';
import { ErrSigRank, PageTimeItem } from '../../types';
import { QuickRange, TimeRangeSelector } from '../../components/TimeRangeSelector';
import { PageHeader } from '../../components/PageHeader';
import { LogLevelBadge } from '../../components/StatusBadge';
import { formatChartTime, formatNumber, formatTime } from '../../utils/format';
import { useAppStore } from '../../stores/useAppStore';


export const ErrorStatPage: React.FC<{ isModal?: boolean }> = ({ isModal = false }) => {
  const [timeRange, setTimeRange] = useState<[number, number]>([
    dayjs().subtract(24, 'hour').unix(),
    dayjs().unix(),
  ]);

  const [chartData, setChartData] = useState<PageTimeItem[]>([]);
  const [signatures, setSignatures] = useState<ErrSigRank[]>([]);
  const [loading, setLoading] = useState(false);

  // Detail Modal
  const [selectedSig, setSelectedSig] = useState<ErrSigRank | null>(null);

  const navigate = useNavigate();
  const { theme } = useAppStore();

  const fetchChart = useCallback(async (range: [number, number]) => {
    try {
      const diffHours = (range[1] - range[0]) / 3600;
      let unit = 'hour';
      if (diffHours > 72) unit = 'day';
      else if (diffHours < 6) unit = 'minute';

      const res = await statApi.getErrorTimeRange({
        start: range[0],
        end: range[1],
        unit,
        filter: ['warn', 'error', 'panic', 'total'],
      });
      setChartData(res || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchTopSignatures = useCallback(async (range: [number, number]) => {
    setLoading(true);
    try {
      const res = await statApi.getErrorTop({
        start: range[0],
        end: range[1],
        limit: 20,
      });
      setSignatures(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchChart(timeRange);
    fetchTopSignatures(timeRange);
  }, [fetchChart, fetchTopSignatures, timeRange]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleRangeChange = (range: [number, number], _quick: QuickRange) => {
    setTimeRange(range);
    fetchChart(range);
    fetchTopSignatures(range);
  };

  // ECharts Option
  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const splitLineColor = isDark ? '#334155' : '#f1f5f9';

  const timestamps = chartData.map((d) => d.at);
  const spanSeconds = timeRange[1] - timeRange[0];
  const xTimeLabels = timestamps.map((ts) => formatChartTime(ts, spanSeconds));

  const getErrorChartOption = () => ({
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
    legend: { textStyle: { color: textColor }, right: 10 },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: xTimeLabels,
      axisLabel: { color: textColor, fontSize: 11 },
      axisLine: { lineStyle: { color: splitLineColor } },
    },
    yAxis: {
      type: 'value',
      name: '错误次数',
      axisLabel: { color: textColor },
      splitLine: { lineStyle: { color: splitLineColor } },
    },
    series: [
      {
        name: 'Panic / 致命异常',
        type: 'line',
        smooth: true,
        data: chartData.map((d) => d.value?.panic || 0),
        itemStyle: { color: '#dc2626' },
      },
      {
        name: 'Error 错误',
        type: 'line',
        smooth: true,
        data: chartData.map((d) => d.value?.error || 0),
        itemStyle: { color: '#f59e0b' },
      },
      {
        name: 'Warn 警告',
        type: 'line',
        smooth: true,
        data: chartData.map((d) => d.value?.warn || 0),
        itemStyle: { color: '#3b82f6' },
      },
    ],
  });

  const columns = [
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 90,
      render: (l: string) => <LogLevelBadge level={l} />,
    },
    {
      title: '错误特征签名 (Normalized Signature)',
      dataIndex: 'signature',
      key: 'signature',
      render: (sig: string) => (
        <span className="font-mono text-xs text-red-600 dark:text-red-400 font-medium break-all">
          {sig}
        </span>
      ),
    },
    {
      title: '发生频次',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      render: (c: number) => (
        <Tag color="red" className="font-bold font-mono">
          {formatNumber(c)} 次
        </Tag>
      ),
    },
    {
      title: '首次 / 最近出现',
      key: 'time',
      width: 200,
      render: (_: any, r: ErrSigRank) => (
        <div className="text-xs text-gray-500 font-mono space-y-0.5">
          <div>首: {formatTime(r.firstAt)}</div>
          <div>末: {formatTime(r.lastAt)}</div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 170,
      render: (_: any, r: ErrSigRank) => (
        <Space size="small">
          <Button
            type="link"
            size="middle"
            icon={<FileTextOutlined />}
            onClick={() => setSelectedSig(r)}
            className="text-xs font-medium"
          >
            详情
          </Button>
          {r.sampleTrace && (
            <Button
              type="link"
              size="middle"
              icon={<SearchOutlined />}
              onClick={() => navigate('/logs')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
            >
              溯源
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {!isModal ? (
        <PageHeader
          icon={<CloseCircleOutlined />}
          title="错误统计与签名追踪"
          description="自动对异常日志进行正则归一化聚合（UUID/数字替换为问号），聚类生成错误签名并追踪首末频次"
          extra={
            <Space size="middle">
              <TimeRangeSelector onChange={handleRangeChange} />
              <Button
                icon={<ReloadOutlined className="text-base" />}
                onClick={refreshAll}
                size="middle"
                className="text-sm font-medium rounded-lg h-9 px-4"
              >
                刷新
              </Button>
            </Space>
          }
        />
      ) : (
        <div className="flex justify-end mb-2">
          <Space size="middle">
            <TimeRangeSelector onChange={handleRangeChange} />
            <Button
              icon={<ReloadOutlined />}
              onClick={refreshAll}
              size="middle"
              className="text-sm font-medium rounded-lg h-9 px-4"
            >
              刷新
            </Button>
          </Space>
        </div>
      )}

      {/* Error Trend Chart */}
      <Card
        title={<span className="text-sm font-semibold">错误发生频次趋势</span>}
        className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800"
      >
        <ReactECharts option={getErrorChartOption()} style={{ height: 280 }} />
      </Card>

      {/* Signatures Ranking */}
      <Card
        title={<span className="text-sm font-semibold">Top 异常签名排行榜</span>}
        className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800"
      >
        <Table
          dataSource={signatures}
          columns={columns}
          rowKey="sigHash"
          loading={loading}
          pagination={false}
          size="middle"
        />
      </Card>

      {/* Signature Detail Modal */}
      <Modal
        title={
          <div className="flex items-center space-x-2">
            <span>异常特征详情</span>
            {selectedSig && <LogLevelBadge level={selectedSig.level} />}
          </div>
        }
        open={!!selectedSig}
        onCancel={() => setSelectedSig(null)}
        footer={null}
        width={700}
      >
        {selectedSig && (
          <div className="space-y-4 mt-4">
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1">归一化签名 Hash:</div>
              <span className="font-mono text-xs bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">
                {selectedSig.sigHash}
              </span>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1">抽样异常日志:</div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-mono text-red-700 dark:text-red-300">
                {selectedSig.sampleError || selectedSig.sampleMsg || '无样本信息'}
              </div>
            </div>

            {selectedSig.sampleTrace && (
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-1">抽样 TraceID:</div>
                <Tag color="geekblue" className="font-mono">
                  {selectedSig.sampleTrace}
                </Tag>
              </div>
            )}

            <div className="text-xs text-gray-400">
              首次出现: {formatTime(selectedSig.firstAt)} | 最近出现: {formatTime(selectedSig.lastAt)}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
