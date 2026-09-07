import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Form,
  Select,
  Input,
  Button,
  Table,
  Space,
  Drawer,
  Modal,
  Tag,
  DatePicker,
  Tooltip,
  Switch,
  Segmented,
  Empty,
} from 'antd';
import { message } from '../../utils/antMsg';
import dayjs from 'dayjs';
import {
  SearchOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClearOutlined,
  DownloadOutlined,
  CompassOutlined,
  BranchesOutlined,
  CopyOutlined,
  ReloadOutlined,
  CalendarOutlined,
  FolderOutlined,
  FilterOutlined,
  BarsOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { logApi } from '../../api/log';
import { ContextLogLine, LogLevel, MatchedRecord, SearchOptions } from '../../types';
import { LogLevelBadge } from '../../components/StatusBadge';
import { PageHeader } from '../../components/PageHeader';

const { RangePicker } = DatePicker;

export const LogsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'monitor'>('search');
  const [categories, setCategories] = useState<string[]>([]);
  const [levels, setLevels] = useState<LogLevel[]>([]);

  // Search State
  const [searchForm] = Form.useForm();
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MatchedRecord[]>([]);

  // Context Near Drawer State
  const [nearDrawerOpen, setNearDrawerOpen] = useState(false);
  const [nearLoading, setNearLoading] = useState(false);
  const [contextLines, setContextLines] = useState<ContextLogLine[]>([]);
  const [selectedNearTarget, setSelectedNearTarget] = useState<{ path: string; line: number } | null>(null);
  const [contextRange, setContextRange] = useState<number>(50); // Default to 50 lines (101 lines total)
  const targetLineRef = useRef<HTMLDivElement>(null);

  // Trace Detail Modal State (Clicking TraceID pops up modal)
  const [traceModalOpen, setTraceModalOpen] = useState(false);
  const [traceLoading, setTraceLoading] = useState(false);
  const [activeTraceId, setActiveTraceId] = useState<string>('');
  const [traceLogs, setTraceLogs] = useState<MatchedRecord[]>([]);

  // SSE Monitor State
  const [monitoring, setMonitoring] = useState(false);
  const [monitorCategory, setMonitorCategory] = useState<string>('');
  const [monitorKeyword, setMonitorKeyword] = useState<string>('');
  const [monitorLogs, setMonitorLogs] = useState<MatchedRecord[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Initialize Categories & Levels
  useEffect(() => {
    const init = async () => {
      try {
        const [cats, lvls] = await Promise.all([
          logApi.getCategories(),
          logApi.getLevels(),
        ]);
        setCategories(cats || []);
        setLevels(lvls || []);
        if (cats && cats.length > 0) {
          setMonitorCategory(cats[0]);
        }
      } catch (err) {
        console.error(err);
      }
    };
    init();
  }, []);

  // Handle Search
  const handleSearch = async (values: any) => {
    setSearching(true);
    try {
      const opts: SearchOptions = {
        categories: values.categories?.length ? values.categories : undefined,
        levels: values.levels?.length ? values.levels : undefined,
        traceID: values.traceID?.trim() || undefined,
        keyword: values.keyword?.trim() || undefined,
        size: values.size || 100,
      };

      if (values.timeRange && values.timeRange[0] && values.timeRange[1]) {
        opts.startTime = values.timeRange[0].format('YYYY-MM-DD HH:mm:ss');
        opts.endTime = values.timeRange[1].format('YYYY-MM-DD HH:mm:ss');
      }

      const results = await logApi.searchLogs(opts);
      setSearchResults(results || []);
    } catch (err: any) {
      message.error(err.message || '检索日志失败');
    } finally {
      setSearching(false);
    }
  };

  // Open Context Lines (Near)
  const handleOpenNear = async (path: string, line: number, range = contextRange) => {
    setSelectedNearTarget({ path, line });
    setContextRange(range);
    setNearDrawerOpen(true);
    setNearLoading(true);
    try {
      const lines = await logApi.getNearLogs(path, line, range);
      setContextLines(lines || []);
    } catch (err: any) {
      message.error(err.message || '获取上下文失败');
    } finally {
      setNearLoading(false);
    }
  };

  // Scroll to target line when context lines load
  useEffect(() => {
    if (nearDrawerOpen && !nearLoading && targetLineRef.current) {
      targetLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [nearDrawerOpen, nearLoading, contextLines]);

  // Open Trace Detail Modal
  const handleOpenTraceModal = async (tid: string) => {
    if (!tid) return;
    setActiveTraceId(tid);
    setTraceModalOpen(true);
    setTraceLoading(true);
    try {
      const logs = await logApi.searchLogs({ traceID: tid, size: 500 });
      const sorted = (logs || []).sort((a, b) => {
        const tA = new Date(a.record?.time || '').getTime() || 0;
        const tB = new Date(b.record?.time || '').getTime() || 0;
        return tA - tB;
      });
      setTraceLogs(sorted);
    } catch (err: any) {
      message.error(err.message || '加载链路日志失败');
    } finally {
      setTraceLoading(false);
    }
  };

  // Copy Trace ID
  const handleCopyTraceId = () => {
    if (navigator.clipboard && activeTraceId) {
      navigator.clipboard.writeText(activeTraceId);
      message.success('TraceID 已复制到剪贴板');
    }
  };

  // Download File
  const handleDownload = async (path: string) => {
    try {
      message.loading({ content: '正在打包下载...', key: 'dl' });
      const blob = await logApi.downloadLog(path);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      const fileName = path.split('/').pop() || 'download.jsonl';
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success({ content: '下载成功', key: 'dl' });
    } catch (err: any) {
      message.error({ content: err.message || '下载失败', key: 'dl' });
    }
  };

  // Toggle SSE Monitor
  const toggleMonitoring = useCallback(() => {
    if (monitoring) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setMonitoring(false);
    } else {
      const url = logApi.buildMonitorUrl({
        categories: monitorCategory ? [monitorCategory] : undefined,
        keyword: monitorKeyword ? monitorKeyword : undefined,
      });

      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        setMonitoring(true);
        message.success('已连接实时日志流');
      };

      es.onmessage = (event) => {
        try {
          if (event.data === 'monitoring started' || event.data === 'monitoring stopped') {
            return;
          }
          const item: MatchedRecord = JSON.parse(event.data);
          setMonitorLogs((prev) => {
            const next = [...prev, item];
            return next.length > 500 ? next.slice(next.length - 500) : next;
          });
        } catch (e) {
          // ignore heartbeats
        }
      };

      es.onerror = () => {
        message.warning('日志流连接中断或已停止');
        es.close();
        eventSourceRef.current = null;
        setMonitoring(false);
      };
    }
  }, [monitoring, monitorCategory, monitorKeyword]);

  // Clean up SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Auto scroll terminal
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [monitorLogs, autoScroll]);

  // Main Table Columns
  const searchColumns = [
    {
      title: '级别',
      dataIndex: ['record', 'level'],
      key: 'level',
      width: 75,
      align: 'center' as const,
      render: (lvl: string) => <LogLevelBadge level={lvl} />,
    },
    {
      title: '时间',
      dataIndex: ['record', 'time'],
      key: 'time',
      width: 165,
      render: (t: string) => <span className="font-mono text-xs text-gray-600 dark:text-gray-300">{t}</span>,
    },
    {
      title: 'TraceID',
      dataIndex: ['record', '_trace_id_'],
      key: 'traceID',
      width: 225,
      render: (tid: string) =>
        tid ? (
          <Tooltip title="点击在独立弹窗中追踪该 TraceID 的全链路日志 (点击右侧图标可复制)">
            <Tag
              color="geekblue"
              className="group cursor-pointer font-mono text-xs hover:bg-blue-600 hover:text-white transition rounded px-2 py-0.5 border-blue-200 dark:border-blue-900 inline-flex items-center gap-1 max-w-full"
              onClick={() => handleOpenTraceModal(tid)}
            >
              <BranchesOutlined className="flex-shrink-0 text-blue-500 group-hover:text-white" />
              <span className="select-all tracking-tight whitespace-nowrap">{tid}</span>
              <CopyOutlined
                className="opacity-0 group-hover:opacity-100 text-[10px] ml-0.5 transition flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(tid);
                  message.success('已复制 TraceID');
                }}
              />
            </Tag>
          </Tooltip>
        ) : (
          <span className="text-gray-300 dark:text-gray-600 font-mono text-xs">-</span>
        ),
    },
    {
      title: '消息内容',
      dataIndex: ['record', 'msg'],
      key: 'msg',
      ellipsis: false,
      className: 'overflow-hidden',
      render: (msg: string, record: MatchedRecord) => (
        <div className="space-y-1 max-w-full overflow-hidden">
          <div className="font-medium text-xs text-gray-900 dark:text-gray-100 break-all leading-relaxed select-text">
            {msg}
          </div>
          {record.record?.error && (
            <div className="text-rose-600 dark:text-rose-400 font-mono text-xs break-all bg-rose-50/70 dark:bg-rose-950/40 px-2 py-1 rounded border border-rose-100 dark:border-rose-900/40 select-text">
              <strong className="mr-1">Error:</strong>
              {record.record.error}
            </div>
          )}
          {record.record?.data && Object.keys(record.record.data).length > 0 && (
            <div className="mt-1">
              <div
                className="text-[11px] font-mono text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-800/80 p-1.5 rounded border border-gray-100 dark:border-slate-800 break-all leading-normal select-text line-clamp-2 hover:line-clamp-none transition-all cursor-pointer"
                title="点击展开完整 JSON 内容"
              >
                <span className="text-indigo-500 font-bold mr-1">data:</span>
                {JSON.stringify(record.record.data)}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      title: '文件位置',
      key: 'pos',
      width: 140,
      render: (_: any, r: MatchedRecord) => (
        <div className="text-xs font-mono text-gray-400 truncate" title={`${r.path}:${r.line}`}>
          {r.path.split('/').pop()}:{r.line}
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 170,
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: any, r: MatchedRecord) => (
        <Space size="small">
          <Button
            type="link"
            size="middle"
            icon={<CompassOutlined />}
            onClick={() => handleOpenNear(r.path, r.line, contextRange)}
            className="text-xs px-1 text-indigo-600 hover:text-indigo-500"
          >
            上下文
          </Button>
          <Button
            type="link"
            size="middle"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(r.path)}
            className="text-xs px-1 text-gray-600 hover:text-indigo-600"
          >
            下载
          </Button>
        </Space>
      ),
    },
  ];

  // Trace Detail Modal Table Columns
  const traceColumns = [
    {
      title: '#',
      key: 'idx',
      width: 45,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => (
        <span className="text-xs font-mono text-gray-400">{index + 1}</span>
      ),
    },
    {
      title: '时间',
      dataIndex: ['record', 'time'],
      key: 'time',
      width: 175,
      render: (t: string, _: any, idx: number) => {
        let deltaStr = '';
        if (idx > 0 && traceLogs[idx - 1]?.record?.time) {
          const prevT = new Date(traceLogs[idx - 1].record.time).getTime();
          const currT = new Date(t).getTime();
          if (!isNaN(prevT) && !isNaN(currT) && currT >= prevT) {
            deltaStr = `+${currT - prevT}ms`;
          }
        }
        return (
          <div>
            <div className="font-mono text-xs text-gray-700 dark:text-gray-300">{t}</div>
            {deltaStr && (
              <Tag color="cyan" className="text-[10px] font-mono mt-0.5 px-1 py-0">
                {deltaStr}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: '级别',
      dataIndex: ['record', 'level'],
      key: 'level',
      width: 75,
      align: 'center' as const,
      render: (lvl: string) => <LogLevelBadge level={lvl} />,
    },
    {
      title: '消息内容与载荷',
      dataIndex: ['record', 'msg'],
      key: 'msg',
      render: (msg: string, record: MatchedRecord) => (
        <div className="space-y-1 overflow-hidden">
          <div className="font-medium text-xs text-gray-900 dark:text-gray-100 break-all select-text">
            {msg}
          </div>
          {record.record?.error && (
            <div className="text-rose-600 dark:text-rose-400 font-mono text-xs break-all bg-rose-50/70 dark:bg-rose-950/40 px-2 py-1 rounded border border-rose-100 dark:border-rose-900/40 select-text">
              <strong className="mr-1">Error:</strong>
              {record.record.error}
            </div>
          )}
          {record.record?.data && Object.keys(record.record.data).length > 0 && (
            <div className="text-[11px] font-mono text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-800/80 p-1.5 rounded border border-gray-100 dark:border-slate-800 break-all select-text">
              <span className="text-indigo-500 font-bold mr-1">data:</span>
              {JSON.stringify(record.record.data)}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '文件位置 / 操作',
      key: 'action',
      width: 150,
      render: (_: any, r: MatchedRecord) => (
        <div className="space-y-1">
          <div className="text-[11px] font-mono text-gray-400 truncate" title={`${r.path}:${r.line}`}>
            {r.path.split('/').pop()}:{r.line}
          </div>
          <Button
            type="link"
            size="middle"
            icon={<CompassOutlined />}
            onClick={() => handleOpenNear(r.path, r.line, contextRange)}
            className="text-xs p-0 h-auto text-indigo-600 hover:text-indigo-500 font-medium"
          >
            反查上下文
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3 pb-4">
      {/* 1. Unified Page Header */}
      <PageHeader
        icon={<FileTextOutlined />}
        title="日志中心"
        description="全量 JSONL 结构化检索、Trace 链路追踪、上下文反查与 SSE 实时流"
        extra={
          <Segmented
            size="middle"
            className="p-1 text-sm font-medium"
            value={activeTab}
            onChange={(val) => setActiveTab(val as 'search' | 'monitor')}
            options={[
              { label: '日志检索与分析', value: 'search', icon: <SearchOutlined /> },
              { label: 'SSE 实时监控流', value: 'monitor', icon: <PlayCircleOutlined /> },
            ]}
          />
        }
      />

      {activeTab === 'search' ? (
        <div className="space-y-3">
          {/* 2. Unified & Balanced Search Filter Matrix (Strict 12-Col Grid Alignment) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 shadow-sm border border-gray-100 dark:border-slate-800 space-y-3">
            <Form
              form={searchForm}
              onFinish={handleSearch}
              initialValues={{ size: 100, timeRange: [dayjs().subtract(10, 'minute'), dayjs()] }}
              className="space-y-3"
            >
              {/* Row 1: Primary Search & Actions (12 Columns Total) */}
              <div className="grid grid-cols-12 gap-3">
                {/* 关键词检索 - 8 cols */}
                <div className="col-span-12 md:col-span-8">
                  <Form.Item name="keyword" className="!mb-0 w-full">
                    <Input
                      placeholder="搜索关键词 (支持模糊匹配 msg、error、数据载荷、请求参数等)..."
                      allowClear
                      prefix={
                        <span className="text-gray-400 text-xs flex items-center gap-1.5 mr-1 font-medium select-none">
                          <SearchOutlined className="text-indigo-500" />
                          <span>关键词</span>
                        </span>
                      }
                      className="h-9 rounded-lg text-xs"
                    />
                  </Form.Item>
                </div>

                {/* 链路 TraceID - 4 cols */}
                <div className="col-span-12 md:col-span-4">
                  <Form.Item name="traceID" className="!mb-0 w-full">
                    <Input
                      placeholder="输入 TraceID 精准追踪"
                      allowClear
                      prefix={
                        <span className="text-gray-400 text-xs flex items-center gap-1.5 mr-1 font-medium select-none">
                          <BranchesOutlined className="text-blue-500" />
                          <span>TraceID</span>
                        </span>
                      }
                      className="h-9 rounded-lg text-xs font-mono"
                    />
                  </Form.Item>
                </div>
              </div>

              {/* Row 2: Secondary Filters & Triggers (12 Columns Total) */}
              <div className="grid grid-cols-12 gap-3 items-center">
                {/* 时间范围 - 4 cols */}
                <div className="col-span-12 md:col-span-4">
                  <Form.Item name="timeRange" className="!mb-0 w-full">
                    <RangePicker
                      showTime
                      format="YYYY-MM-DD HH:mm:ss"
                      placeholder={['开始时间', '结束时间']}
                      presets={[
                        { label: '最近 10 分钟', value: [dayjs().subtract(10, 'minute'), dayjs()] },
                        { label: '最近 30 分钟', value: [dayjs().subtract(30, 'minute'), dayjs()] },
                        { label: '最近 1 小时', value: [dayjs().subtract(1, 'hour'), dayjs()] },
                        { label: '今天', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
                        { label: '最近 3 天', value: [dayjs().subtract(3, 'day'), dayjs()] },
                      ]}
                      prefix={
                        <span className="text-gray-400 text-xs flex items-center gap-1 mr-1 font-medium select-none">
                          <CalendarOutlined />
                          <span>时间</span>
                        </span>
                      }
                      className="w-full h-9 rounded-lg text-xs"
                    />
                  </Form.Item>
                </div>

                {/* 日志类目 - 2 cols */}
                <div className="col-span-6 md:col-span-2">
                  <Form.Item name="categories" className="!mb-0 w-full">
                    <Select
                      mode="multiple"
                      maxTagCount={1}
                      placeholder="全部类目"
                      allowClear
                      options={categories.map((c) => ({ label: c, value: c }))}
                      prefix={
                        <span className="text-gray-400 text-xs flex items-center gap-1 mr-1 font-medium select-none">
                          <FolderOutlined />
                          <span>类目</span>
                        </span>
                      }
                      className="w-full h-9 rounded-lg text-xs"
                    />
                  </Form.Item>
                </div>

                {/* 日志级别 - 2 cols */}
                <div className="col-span-6 md:col-span-2">
                  <Form.Item name="levels" className="!mb-0 w-full">
                    <Select
                      mode="multiple"
                      maxTagCount={1}
                      placeholder="全部级别"
                      allowClear
                      options={levels.map((l) => ({ label: l.toUpperCase(), value: l }))}
                      prefix={
                        <span className="text-gray-400 text-xs flex items-center gap-1 mr-1 font-medium select-none">
                          <FilterOutlined />
                          <span>级别</span>
                        </span>
                      }
                      className="w-full h-9 rounded-lg text-xs"
                    />
                  </Form.Item>
                </div>

                {/* 显示条数 - 2 cols */}
                <div className="col-span-6 md:col-span-2">
                  <Form.Item name="size" className="!mb-0 w-full">
                    <Select
                      options={[
                        { label: '50 条/页', value: 50 },
                        { label: '100 条/页', value: 100 },
                        { label: '200 条/页', value: 200 },
                        { label: '500 条/页', value: 500 },
                      ]}
                      prefix={
                        <span className="text-gray-400 text-xs flex items-center gap-1 mr-1 font-medium select-none">
                          <BarsOutlined />
                          <span>条数</span>
                        </span>
                      }
                      className="w-full h-9 rounded-lg text-xs"
                    />
                  </Form.Item>
                </div>

                {/* 检索 & 重置操作按钮 - 2 cols */}
                <div className="col-span-6 md:col-span-2 flex items-center gap-2">
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SearchOutlined />}
                    loading={searching}
                    className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium shadow-sm transition"
                  >
                    检索日志
                  </Button>
                  <Button
                    onClick={() => {
                      searchForm.resetFields();
                      searchForm.setFieldsValue({
                        size: 100,
                        timeRange: [dayjs().subtract(10, 'minute'), dayjs()],
                      });
                    }}
                    icon={<ReloadOutlined />}
                    className="h-9 px-3 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 border-gray-200 dark:border-slate-700 hover:bg-gray-50 transition"
                  >
                    重置
                  </Button>
                </div>
              </div>
            </Form>
          </div>

          {/* 3. Results Summary Subheader */}
          <div className="flex items-center justify-between px-1 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700 dark:text-gray-300">结构化日志检索结果</span>
              {searchResults.length > 0 ? (
                <Tag color="blue" className="font-mono text-[11px] px-1.5 py-0 rounded">
                  共 {searchResults.length} 条命中
                </Tag>
              ) : (
                <span className="text-gray-400 font-mono text-[11px]">暂无数据</span>
              )}
            </div>
            <span className="text-[11px] text-gray-400 hidden sm:inline">
              提示：点击 TraceID 可在独立弹窗查看全链路日志，点击“上下文”可反查前后 50 行
            </span>
          </div>

          {/* 3. Results Table with tableLayout='fixed' (Prevents overflowing & overlaps) */}
          <div className="bg-white dark:bg-slate-900 rounded-lg p-3 shadow-sm border border-gray-100 dark:border-slate-800">
            <Table
              tableLayout="fixed"
              scroll={{ x: 1100 }}
              dataSource={searchResults}
              columns={searchColumns}
              rowKey={(r) => `${r.path}-${r.line}`}
              loading={searching}
              pagination={{
                pageSize: 15,
                showSizeChanger: true,
                pageSizeOptions: ['15', '30', '50', '100'],
                showTotal: (total) => `共 ${total} 条日志`,
                size: 'small',
              }}
              size="small"
            />
          </div>
        </div>
      ) : (
        /* SSE Monitor View */
        <div className="space-y-3">
          {/* SSE Monitor Filter & Control Toolbar (Unified 36px Height) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 shadow-sm border border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[320px]">
              <Select
                placeholder="选择监控类目"
                value={monitorCategory}
                onChange={setMonitorCategory}
                options={categories.map((c) => ({ label: c, value: c }))}
                prefix={
                  <span className="text-gray-400 text-xs flex items-center gap-1.5 mr-1 font-medium select-none">
                    <FolderOutlined />
                    <span>类目</span>
                  </span>
                }
                className="w-48 h-9 rounded-lg text-xs"
                disabled={monitoring}
              />
              <Input
                placeholder="关键词实时过滤 (支持 msg, error, 载荷等)..."
                value={monitorKeyword}
                onChange={(e) => setMonitorKeyword(e.target.value)}
                allowClear
                prefix={
                  <span className="text-gray-400 text-xs flex items-center gap-1.5 mr-1 font-medium select-none">
                    <SearchOutlined className="text-indigo-500" />
                    <span>过滤词</span>
                  </span>
                }
                className="flex-1 min-w-[220px] h-9 rounded-lg text-xs"
                disabled={monitoring}
              />
              <Button
                type={monitoring ? 'default' : 'primary'}
                icon={monitoring ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={toggleMonitoring}
                danger={monitoring}
                className={`h-9 px-4 rounded-lg text-xs font-medium transition shadow-sm ${
                  !monitoring ? 'bg-indigo-600 hover:bg-indigo-500' : ''
                }`}
              >
                {monitoring ? '停止推送' : '开始实时监控'}
              </Button>
              <Button
                icon={<ClearOutlined />}
                onClick={() => setMonitorLogs([])}
                className="h-9 px-3.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 border-gray-200 dark:border-slate-700 hover:bg-gray-50 transition"
              >
                清屏
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-9 flex items-center gap-2 px-3 bg-gray-50 dark:bg-slate-800/60 rounded-lg border border-gray-100 dark:border-slate-800 text-xs text-gray-500">
                <span>自动滚动</span>
                <Switch size="small" checked={autoScroll} onChange={setAutoScroll} />
              </div>
              <div
                className={`h-9 flex items-center px-3 rounded-lg text-xs font-medium border ${
                  monitoring
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                    : 'bg-gray-50 dark:bg-slate-800/60 text-gray-500 border-gray-200 dark:border-slate-700'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full mr-1.5 ${
                    monitoring ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                  }`}
                />
                {monitoring ? '实时推流中' : '空闲状态'}
              </div>
            </div>
          </div>

          {/* Terminal Window */}
          <div className="rounded-lg overflow-hidden border border-gray-800 bg-gray-950 font-mono text-xs shadow-inner">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 text-gray-400">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-gray-400 text-xs">实时控制台 (SSE)</span>
              </div>
              <span className="text-gray-500 text-[11px]">{monitorLogs.length} 条已捕获</span>
            </div>

            <div className="p-4 h-[520px] overflow-y-auto space-y-1.5 custom-scrollbar">
              {monitorLogs.length === 0 ? (
                <div className="text-gray-600 text-center py-20">
                  {monitoring ? '正在监听日志流输出，暂无新写入...' : '点击“开始实时监控”接入 SSE 日志流'}
                </div>
              ) : (
                monitorLogs.map((m, idx) => (
                  <div
                    key={idx}
                    className="hover:bg-gray-900/60 p-1 rounded transition flex items-start space-x-2 text-xs leading-relaxed"
                  >
                    <span className="text-gray-500 select-none">{m.record?.time || '-'}</span>
                    <LogLevelBadge level={m.record?.level || 'info'} />
                    {m.record?._trace_id_ && (
                      <span
                        className="text-sky-400 hover:underline cursor-pointer select-all"
                        onClick={() => handleOpenTraceModal(m.record._trace_id_!)}
                      >
                        [{m.record._trace_id_}]
                      </span>
                    )}
                    <span className="text-gray-200 break-all flex-1">{m.record?.msg}</span>
                    {m.record?.error && (
                      <span className="text-red-400 break-all">| Err: {m.record.error}</span>
                    )}
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* 4. Trace Detail Modal (Independent popup without filtering current table) */}
      <Modal
        title={
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center space-x-2">
              <BranchesOutlined className="text-indigo-600 text-base" />
              <span className="font-bold text-sm text-gray-900 dark:text-white">全链路 Trace 追踪</span>
              <Tag color="geekblue" className="font-mono text-xs px-2 py-0.5">
                {activeTraceId}
              </Tag>
            </div>
            <Button
              size="middle"
              icon={<CopyOutlined />}
              onClick={handleCopyTraceId}
              className="rounded-lg text-xs font-medium"
            >
              复制 ID
            </Button>
          </div>
        }
        open={traceModalOpen}
        onCancel={() => setTraceModalOpen(false)}
        footer={null}
        width={980}
        destroyOnHidden
      >
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-gray-100 dark:border-slate-800">
            <span>
              已汇聚该 TraceID 下的所有执行日志（共 <strong>{traceLogs.length}</strong> 条记录），按时间顺序完整重现调用链路：
            </span>
            {traceLogs.length > 1 && (
              <span className="font-mono text-gray-400">
                起点: {traceLogs[0]?.record?.time?.split(' ')[1] || ''} ──► 终点:{' '}
                {traceLogs[traceLogs.length - 1]?.record?.time?.split(' ')[1] || ''}
              </span>
            )}
          </div>

          <Table
            tableLayout="fixed"
            dataSource={traceLogs}
            columns={traceColumns}
            rowKey={(r) => `${r.path}-${r.line}`}
            loading={traceLoading}
            pagination={false}
            size="small"
            scroll={{ y: 460 }}
            locale={{ emptyText: <Empty description="未查询到该 TraceID 对应的日志数据" /> }}
          />
        </div>
      </Modal>

      {/* 5. Near Context Drawer (With Range Selector ±20, ±50, ±100, ±200 & Auto-scroll) */}
      <Drawer
        title={
          <div className="flex items-center justify-between pr-4">
            <div className="flex items-center space-x-2">
              <CompassOutlined className="text-indigo-500" />
              <span className="font-semibold text-sm text-gray-800 dark:text-white">行上下文反查</span>
              {selectedNearTarget && (
                <span className="text-xs font-mono text-gray-400">
                  ({selectedNearTarget.path.split('/').pop()}:{selectedNearTarget.line})
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400 hidden sm:inline">范围:</span>
              <Segmented
                size="small"
                options={[
                  { label: '±20行', value: 20 },
                  { label: '±50行', value: 50 },
                  { label: '±100行', value: 100 },
                  { label: '±200行', value: 200 },
                ]}
                value={contextRange}
                onChange={(val) => {
                  const r = val as number;
                  setContextRange(r);
                  if (selectedNearTarget) {
                    handleOpenNear(selectedNearTarget.path, selectedNearTarget.line, r);
                  }
                }}
              />
            </div>
          </div>
        }
        open={nearDrawerOpen}
        onClose={() => setNearDrawerOpen(false)}
        width={820}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-500 pb-1 border-b border-gray-100 dark:border-slate-800">
            <span>
              展示目标行前后 <strong>{contextRange}</strong> 行（共 {contextLines.length} 行），中心目标行已高亮并自动居中定位：
            </span>
            {selectedNearTarget && (
              <Button
                size="middle"
                type="link"
                icon={<DownloadOutlined />}
                onClick={() => handleDownload(selectedNearTarget.path)}
                className="text-xs p-0 h-auto font-medium"
              >
                下载完整文件
              </Button>
            )}
          </div>
          <div className="space-y-1 font-mono text-xs">
            {nearLoading ? (
              <div className="text-center py-16 text-gray-400">
                <ReloadOutlined spin className="text-xl mb-2" />
                <div>正在拉取前后 {contextRange} 行上下文...</div>
              </div>
            ) : contextLines.length === 0 ? (
              <div className="text-center py-16 text-gray-400">未获取到上下文数据</div>
            ) : (
              contextLines.map((cl) => {
                const isTarget = cl.line === selectedNearTarget?.line;
                return (
                  <div
                    key={cl.line}
                    ref={isTarget ? targetLineRef : undefined}
                    className={`p-1.5 rounded flex items-start space-x-2 transition ${
                      isTarget
                        ? 'bg-amber-50/90 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 shadow-sm'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className={`w-12 text-right select-none font-mono text-xs ${
                        isTarget ? 'text-amber-600 font-bold' : 'text-gray-400'
                      }`}
                    >
                      {cl.line}
                    </span>
                    <div className="flex-1 break-all select-text">
                      <span
                        className={
                          isTarget
                            ? 'font-bold text-gray-900 dark:text-amber-100'
                            : 'text-gray-700 dark:text-gray-300'
                        }
                      >
                        {cl.content}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Drawer>
    </div>
  );
};
