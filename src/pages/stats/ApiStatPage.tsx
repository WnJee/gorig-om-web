import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Typography,
  Space,
  Button,
  Input,
  Select,
  Drawer,
  Tabs,
  Tag,
  Descriptions,
} from 'antd';
import {
  ApiOutlined,
  DashboardOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { statApi } from '../../api/stat';
import {
  ApiLatencyRank,
  ApiLatencySampleResp,
  ApiLatencySummary,
  PageTimeItem,
} from '../../types';
import { MetricCard } from '../../components/MetricCard';
import { QuickRange, TimeRangeSelector } from '../../components/TimeRangeSelector';
import { CodeViewer } from '../../components/CodeViewer';
import { formatChartTime, formatLatency, formatNumber, formatTime } from '../../utils/format';
import { useAppStore } from '../../stores/useAppStore';

const { Title } = Typography;

export const ApiStatPage: React.FC<{ isModal?: boolean }> = ({ isModal = false }) => {
  const [timeRange, setTimeRange] = useState<[number, number]>([
    dayjs().subtract(1, 'hour').unix(),
    dayjs().unix(),
  ]);

  // Summary State
  const [summary, setSummary] = useState<ApiLatencySummary | null>(null);

  // Time Chart State
  const [chartData, setChartData] = useState<PageTimeItem[]>([]);

  // Top Table State
  const [rankList, setRankList] = useState<ApiLatencyRank[]>([]);
  const [totalRanks, setTotalRanks] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedMethod, setSelectedMethod] = useState<string | undefined>(undefined);
  const [uriSearch, setUriSearch] = useState('');
  const [sortBy, setSortBy] = useState('avg');
  const [sortAsc, setSortAsc] = useState(false);

  // Sample Drawer
  const [sampleDrawerOpen, setSampleDrawerOpen] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleData, setSampleData] = useState<ApiLatencySampleResp | null>(null);
  const [activeApiTarget, setActiveApiTarget] = useState<{ method: string; uri: string } | null>(null);

  const { theme } = useAppStore();

  const fetchSummary = useCallback(async (range: [number, number]) => {
    try {
      const res = await statApi.getApiSummary(range[0], range[1], 200);
      setSummary(res);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchChart = useCallback(async (range: [number, number]) => {
    try {
      const diffHours = (range[1] - range[0]) / 3600;
      let unit = 'minute';
      if (diffHours > 48) unit = 'day';
      else if (diffHours > 12) unit = 'hour';

      const res = await statApi.getApiTimeRange({
        start: range[0],
        end: range[1],
        unit,
        filter: ['count', 'count2xx', 'count4xx', 'count5xx', 'countSlow'],
      });
      setChartData(res || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchTopRanks = useCallback(async (range: [number, number], p = page, s = pageSize) => {
    setLoading(true);
    try {
      const res = await statApi.getApiTop({
        start: range[0],
        end: range[1],
        page: p,
        size: s,
        methods: selectedMethod ? [selectedMethod] : undefined,
        uriLike: uriSearch.trim() || undefined,
        sortBy,
        asc: sortAsc,
      });
      setRankList(res.items || []);
      setTotalRanks(res.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, selectedMethod, uriSearch, sortBy, sortAsc]);

  const refreshAll = useCallback(() => {
    fetchSummary(timeRange);
    fetchChart(timeRange);
    fetchTopRanks(timeRange, page, pageSize);
  }, [fetchSummary, fetchChart, fetchTopRanks, timeRange, page, pageSize]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleRangeChange = (range: [number, number], _quick: QuickRange) => {
    setTimeRange(range);
    fetchSummary(range);
    fetchChart(range);
    fetchTopRanks(range, 1, pageSize);
  };

  const handleOpenSample = async (method: string, uri: string) => {
    setActiveApiTarget({ method, uri });
    setSampleDrawerOpen(true);
    setSampleLoading(true);
    try {
      const res = await statApi.getApiSample(method, uri);
      setSampleData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setSampleLoading(false);
    }
  };

  // ECharts Option
  const isDark = theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const splitLineColor = isDark ? '#334155' : '#f1f5f9';

  const timestamps = chartData.map((d) => d.at);
  const spanSeconds = timeRange[1] - timeRange[0];
  const xTimeLabels = timestamps.map((ts) => formatChartTime(ts, spanSeconds));

  const getTrafficChartOption = () => ({
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
      name: '请求数',
      axisLabel: { color: textColor },
      splitLine: { lineStyle: { color: splitLineColor } },
    },
    series: [
      {
        name: '2xx 正常',
        type: 'bar',
        stack: 'traffic',
        data: chartData.map((d) => d.value?.count2xx || 0),
        itemStyle: { color: '#10b981' },
      },
      {
        name: '4xx 客户端异常',
        type: 'bar',
        stack: 'traffic',
        data: chartData.map((d) => d.value?.count4xx || 0),
        itemStyle: { color: '#f59e0b' },
      },
      {
        name: '5xx 服务端错误',
        type: 'bar',
        stack: 'traffic',
        data: chartData.map((d) => d.value?.count5xx || 0),
        itemStyle: { color: '#ef4444' },
      },
      {
        name: '慢请求 (>200ms)',
        type: 'line',
        smooth: true,
        data: chartData.map((d) => d.value?.countSlow || 0),
        itemStyle: { color: '#8b5cf6' },
      },
    ],
  });

  const methodColorMap: Record<string, string> = {
    GET: 'blue',
    POST: 'green',
    PUT: 'orange',
    DELETE: 'red',
    PATCH: 'purple',
  };

  const columns = [
    {
      title: '请求方法',
      dataIndex: 'method',
      key: 'method',
      width: 100,
      render: (m: string) => <Tag color={methodColorMap[m] || 'default'}>{m}</Tag>,
    },
    {
      title: '接口路径 (URI)',
      dataIndex: 'uri',
      key: 'uri',
      render: (uri: string) => <span className="font-mono text-xs font-semibold">{uri}</span>,
    },
    {
      title: '总请求量',
      dataIndex: 'count',
      key: 'count',
      render: (c: number) => formatNumber(c),
    },
    {
      title: '平均耗时',
      dataIndex: 'avgLatency',
      key: 'avgLatency',
      render: (ms: number) => (
        <span className={`font-mono ${ms > 200 ? 'text-amber-500 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
          {formatLatency(ms)}
        </span>
      ),
    },
    {
      title: '最大耗时',
      dataIndex: 'maxLatency',
      key: 'maxLatency',
      render: (ms: number) => <span className="font-mono text-xs text-gray-500">{formatLatency(ms)}</span>,
    },
    {
      title: '状态码分布 (2xx / 4xx / 5xx)',
      key: 'statusDist',
      render: (_: any, r: ApiLatencyRank) => (
        <Space size="small" className="text-xs font-mono">
          <span className="text-emerald-600">{r.count2xx}</span>/
          <span className="text-amber-600">{r.count4xx}</span>/
          <span className="text-red-600 font-bold">{r.count5xx}</span>
        </Space>
      ),
    },
    {
      title: '成功率',
      dataIndex: 'successRate',
      key: 'successRate',
      render: (rate: number) => {
        const val = +(rate * 100).toFixed(1);
        const color = val >= 99 ? 'text-emerald-600' : val >= 90 ? 'text-amber-600' : 'text-red-600';
        return <span className={`font-mono font-bold ${color}`}>{val}%</span>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, r: ApiLatencyRank) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleOpenSample(r.method, r.uri)}
        >
          样本分析
        </Button>
      ),
    },
  ];

  const renderSampleTab = (sample?: any, title?: string) => {
    if (!sample) {
      return <div className="text-center py-10 text-gray-400">暂无{title}样本数据</div>;
    }
    return (
      <div className="space-y-4">
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="链路 TraceID">
            <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">
              {sample.traceId || '-'}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="响应状态码">
            <Tag color={sample.status >= 500 ? 'red' : sample.status >= 400 ? 'orange' : 'green'}>
              {sample.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="请求耗时">
            <span className="font-mono font-bold">{formatLatency(sample.latencyMs)}</span>
          </Descriptions.Item>
          <Descriptions.Item label="请求时间">
            {formatTime(sample.requestAt)}
          </Descriptions.Item>
        </Descriptions>

        {sample.inLog && (
          <div>
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              入参日志 (InLog)
            </div>
            <CodeViewer
              code={JSON.stringify(sample.inLog, null, 2)}
              maxHeight={200}
            />
          </div>
        )}

        {sample.outLog && (
          <div>
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              出参/错误日志 (OutLog)
            </div>
            <CodeViewer
              code={JSON.stringify(sample.outLog, null, 2)}
              maxHeight={250}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {!isModal ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Title level={4} className="!mb-1 text-gray-800 dark:text-white">
              API 统计与延迟分析
            </Title>
            <span className="text-xs text-gray-500">
              基于分钟级桶与小时 Rollup 聚合分析 API 流量规模、慢请求率、5xx 错误与入/出参抽样
            </span>
          </div>
          <Space>
            <TimeRangeSelector onChange={handleRangeChange} />
            <Button icon={<ReloadOutlined />} onClick={refreshAll} size="small">
              刷新
            </Button>
          </Space>
        </div>
      ) : (
        <div className="flex justify-end mb-2">
          <Space>
            <TimeRangeSelector onChange={handleRangeChange} />
            <Button icon={<ReloadOutlined />} onClick={refreshAll} size="small">
              刷新
            </Button>
          </Space>
        </div>
      )}

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="总请求数"
            value={formatNumber(summary?.count)}
            subText={summary ? `更新于 ${formatTime(summary.updatedAt, 'HH:mm:ss')}` : '-'}
            icon={<ApiOutlined />}
            color="#6366f1"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="平均延迟 (2xx)"
            value={formatLatency(summary?.avgLatency)}
            subText="正常请求平均响应时长"
            icon={<DashboardOutlined />}
            color="#10b981"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="5xx 服务端错误"
            value={formatNumber(summary?.count5xx)}
            subText="严重服务器内部异常"
            icon={<CloseCircleOutlined />}
            color="#ef4444"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="慢请求 (>200ms)"
            value={formatNumber(summary?.slowCount)}
            subText="超过 200ms 阈值请求"
            icon={<ClockCircleOutlined />}
            color="#f59e0b"
          />
        </Col>
      </Row>

      {/* Traffic Trend */}
      <Card
        title={<span className="text-sm font-semibold">请求量与状态码走势</span>}
        className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800"
      >
        <ReactECharts option={getTrafficChartOption()} style={{ height: 280 }} />
      </Card>

      {/* API Ranking Table */}
      <Card
        title={<span className="text-sm font-semibold">API 接口耗时排行榜</span>}
        className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800"
      >
        {/* Table Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <Space wrap>
            <Select
              placeholder="请求方法"
              allowClear
              value={selectedMethod}
              onChange={setSelectedMethod}
              className="w-28"
              options={[
                { label: 'GET', value: 'GET' },
                { label: 'POST', value: 'POST' },
                { label: 'PUT', value: 'PUT' },
                { label: 'DELETE', value: 'DELETE' },
              ]}
            />
            <Input
              placeholder="搜索接口 URI"
              value={uriSearch}
              onChange={(e) => setUriSearch(e.target.value)}
              prefix={<SearchOutlined className="text-gray-400" />}
              className="w-56"
              onPressEnter={() => fetchTopRanks(timeRange, 1, pageSize)}
            />
            <Select
              value={sortBy}
              onChange={(val) => {
                setSortBy(val);
                fetchTopRanks(timeRange, 1, pageSize);
              }}
              className="w-36"
              options={[
                { label: '按平均延迟排序', value: 'avg' },
                { label: '按最大延迟排序', value: 'max' },
                { label: '按请求量排序', value: 'count' },
                { label: '按 5xx 排序', value: '5xx' },
              ]}
            />
            <Select
              value={sortAsc ? 'asc' : 'desc'}
              onChange={(val) => {
                setSortAsc(val === 'asc');
                fetchTopRanks(timeRange, 1, pageSize);
              }}
              className="w-24"
              options={[
                { label: '降序 ↓', value: 'desc' },
                { label: '升序 ↑', value: 'asc' },
              ]}
            />
            <Button
              type="primary"
              size="small"
              onClick={() => fetchTopRanks(timeRange, 1, pageSize)}
            >
              查询
            </Button>
          </Space>
        </div>

        <Table
          dataSource={rankList}
          columns={columns}
          rowKey={(r) => `${r.method}-${r.uri}`}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total: totalRanks,
            onChange: (p, s) => {
              setPage(p);
              setPageSize(s);
              fetchTopRanks(timeRange, p, s);
            },
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个接口记录`,
          }}
          size="middle"
        />
      </Card>

      {/* Sample Detail Drawer */}
      <Drawer
        title={
          <div>
            <span>接口样本分析: </span>
            {activeApiTarget && (
              <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 ml-1">
                {activeApiTarget.method} {activeApiTarget.uri}
              </span>
            )}
          </div>
        }
        open={sampleDrawerOpen}
        onClose={() => setSampleDrawerOpen(false)}
        width={720}
      >
        {sampleLoading ? (
          <div className="text-center py-20 text-gray-400">正在获取调用样本...</div>
        ) : (
          <Tabs
            defaultActiveKey="latest"
            items={[
              {
                key: 'latest',
                label: '最新样本',
                children: renderSampleTab(sampleData?.latest, '最新'),
              },
              {
                key: 'slow',
                label: '慢请求样本',
                children: renderSampleTab(sampleData?.sampleSlow, '慢请求'),
              },
              {
                key: '5xx',
                label: '5xx 异常样本',
                children: renderSampleTab(sampleData?.sample5xx, '5xx 异常'),
              },
              {
                key: '4xx',
                label: '4xx 客户端异常',
                children: renderSampleTab(sampleData?.sample4xx, '4xx 异常'),
              },
              {
                key: '2xx',
                label: '2xx 正常样本',
                children: renderSampleTab(sampleData?.sample2xx, '2xx 正常'),
              },
            ]}
          />
        )}
      </Drawer>
    </div>
  );
};
