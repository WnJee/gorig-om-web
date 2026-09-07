import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Space,
  Button,
  Tabs,
  Tag,
  Progress,
  Typography,
  Input,
  Select,
  Modal,
  Empty,
  Spin,
  Collapse,
} from 'antd';
import {
  BugOutlined,
  ReloadOutlined,
  DownloadOutlined,
  FileTextOutlined,
  CopyOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  CheckOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { diagApi } from '../../api/diag';
import { GoroutineClusterResult } from '../../types';
import { message } from '../../utils/antMsg';
import { PageHeader } from '../../components/PageHeader';
import dayjs from 'dayjs';

const { Paragraph } = Typography;

const getStateColor = (state: string): string => {
  const s = state.toLowerCase();
  if (s.includes('running')) return 'green';
  if (s.includes('chan receive') || s.includes('chan send')) return 'blue';
  if (s.includes('select')) return 'cyan';
  if (s.includes('io wait') || s.includes('syscall')) return 'orange';
  if (s.includes('sleep')) return 'purple';
  if (s.includes('semacquire') || s.includes('sync')) return 'volcano';
  return 'default';
};

export const DiagPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('goroutines');
  const [loading, setLoading] = useState(false);
  const [clusterData, setClusterData] = useState<GoroutineClusterResult | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedState, setSelectedState] = useState<string>('all');

  // Raw Dump Modal
  const [rawModalOpen, setRawModalOpen] = useState(false);
  const [rawDump, setRawDump] = useState('');
  const [rawLoading, setRawLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Profiling States
  const [cpuDuration, setCpuDuration] = useState<number>(10);
  const [cpuSampling, setCpuSampling] = useState(false);
  const [heapSampling, setHeapSampling] = useState(false);

  // Fetch Goroutine Clusters
  const fetchGoroutines = useCallback(async () => {
    setLoading(true);
    try {
      const res = await diagApi.getGoroutines();
      setClusterData(res);
    } catch (err: any) {
      message.error(err.message || '获取协程特征数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoroutines();
  }, [fetchGoroutines]);

  // Fetch Raw Dump
  const handleOpenRawDump = async () => {
    setRawModalOpen(true);
    setRawLoading(true);
    setCopied(false);
    try {
      const raw = await diagApi.getRawGoroutines();
      setRawDump(raw);
    } catch (err: any) {
      message.error(err.message || '获取原始协程转储失败');
    } finally {
      setRawLoading(false);
    }
  };

  const handleCopyRaw = () => {
    if (!rawDump) return;
    navigator.clipboard.writeText(rawDump);
    setCopied(true);
    message.success('已复制全部堆栈转储到剪贴板');
    setTimeout(() => setCopied(false), 2500);
  };

  // CPU Profile
  const handleCpuProfile = async () => {
    setCpuSampling(true);
    message.loading({ content: `正在进行 ${cpuDuration} 秒在线 CPU 采样，请稍候...`, key: 'cpu_profile', duration: 0 });
    try {
      await diagApi.downloadCPUProfile(cpuDuration);
      message.success({ content: 'CPU Profile 采集完成，已触发下载', key: 'cpu_profile' });
    } catch (err: any) {
      message.error({ content: err.message || 'CPU Profile 采集失败', key: 'cpu_profile' });
    } finally {
      setCpuSampling(false);
    }
  };

  // Heap Profile
  const handleHeapProfile = async () => {
    setHeapSampling(true);
    try {
      await diagApi.downloadHeapProfile();
      message.success('Heap 内存快照采集完成，已触发下载');
    } catch (err: any) {
      message.error(err.message || 'Heap 快照采集失败');
    } finally {
      setHeapSampling(false);
    }
  };

  // Filter groups
  const filteredGroups = (clusterData?.groups || []).filter((g) => {
    const matchesKeyword =
      !searchKeyword ||
      g.state.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      g.topFrame.function.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      g.topFrame.file.toLowerCase().includes(searchKeyword.toLowerCase());

    const matchesState = selectedState === 'all' || g.state.toLowerCase().includes(selectedState.toLowerCase());

    return matchesKeyword && matchesState;
  });

  // Extract unique states for filter
  const uniqueStates = Array.from(new Set((clusterData?.groups || []).map((g) => g.state)));

  return (
    <div className="space-y-3 pb-4">
      {/* 1. Unified Page Header */}
      <PageHeader
        icon={<BugOutlined />}
        title="运行时性能诊断"
        description="Goroutine 协程特征聚类、阻塞热点分析与在线 CPU / Heap pprof 抓取"
        extra={
          <Space size="middle">
            <Button
              size="middle"
              icon={<ReloadOutlined spin={loading} className="text-base" />}
              onClick={fetchGoroutines}
              className="text-sm font-medium rounded-lg h-9 px-4"
            >
              刷新协程
            </Button>
            <Button
              size="middle"
              icon={<FileTextOutlined className="text-base" />}
              onClick={handleOpenRawDump}
              className="text-sm font-medium rounded-lg h-9 px-4 border-indigo-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:!border-indigo-400"
            >
              原始 Stack Dump
            </Button>
          </Space>
        }
      />

      {/* Metric Stat Cards */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 !p-3">
            <div className="text-xs text-gray-400">活跃协程总数</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1 font-mono">
              {loading && !clusterData ? <Spin size="small" /> : clusterData?.totalGoroutines ?? '-'}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">当前存活 Goroutines</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 !p-3">
            <div className="text-xs text-gray-400">特征聚类组数</div>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
              {loading && !clusterData ? <Spin size="small" /> : clusterData?.totalGroups ?? '-'}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">相似堆栈特征合并</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 !p-3">
            <div className="text-xs text-gray-400">主要状态分布</div>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-2 truncate">
              {clusterData?.groups?.[0] ? (
                <Tag color={getStateColor(clusterData.groups[0].state)}>
                  {clusterData.groups[0].state} ({clusterData.groups[0].percentage}%)
                </Tag>
              ) : (
                '-'
              )}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Top 1 协程占用状态</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 !p-3">
            <div className="text-xs text-gray-400">快照采集时间</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-200 mt-2 font-mono truncate">
              {clusterData?.timestamp
                ? dayjs(clusterData.timestamp).format('HH:mm:ss')
                : '-'}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {clusterData?.timestamp ? dayjs(clusterData.timestamp).format('YYYY-MM-DD') : '等待采集'}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Main Tabs */}
      <Card className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
          {
            key: 'goroutines',
            label: (
              <span className="flex items-center space-x-1.5 font-medium text-xs px-1">
                <BugOutlined />
                <span>协程特征聚类 ({clusterData?.groups?.length || 0})</span>
              </span>
            ),
            children: (
              <div className="space-y-4 pt-2">
                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 dark:bg-slate-800/60 p-3 rounded-lg">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      placeholder="搜索函数名、文件路径或状态..."
                      prefix={<SearchOutlined className="text-gray-400" />}
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      allowClear
                      className="w-64 text-xs"
                      size="middle"
                    />
                    <Select
                      value={selectedState}
                      onChange={setSelectedState}
                      className="w-36 text-xs"
                      size="middle"
                      options={[
                        { value: 'all', label: '全部状态' },
                        ...uniqueStates.map((s) => ({ value: s, label: s })),
                      ]}
                    />
                  </div>
                  <div className="text-xs text-gray-400">
                    共展示 <strong>{filteredGroups.length}</strong> / {clusterData?.groups?.length || 0} 个聚类组
                  </div>
                </div>

                {/* Groups List */}
                {loading && !clusterData ? (
                  <div className="py-16 text-center">
                    <Spin tip="正在提取并聚类 Go 协程堆栈..." />
                  </div>
                ) : filteredGroups.length === 0 ? (
                  <Empty description="未发现符合条件的协程聚类" className="py-12" />
                ) : (
                  <div className="space-y-3">
                    {filteredGroups.map((group, idx) => {
                      const collapseItems = [
                        {
                          key: 'frames',
                          label: (
                            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                              查看完整调用链 ({group.frames.length} 帧)
                            </span>
                          ),
                          children: (
                            <div className="bg-gray-900 text-gray-200 p-3 rounded-md text-xs font-mono overflow-x-auto space-y-1.5">
                              {group.frames.map((frame, fIdx) => (
                                <div key={fIdx} className="border-b border-gray-800 pb-1 last:border-0 last:pb-0">
                                  <div className="text-emerald-400 font-semibold">{frame.function}</div>
                                  <div className="text-gray-400 text-[11px]">
                                    {frame.file}:{frame.line}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ),
                        },
                      ];

                      return (
                        <div
                          key={idx}
                          className="border border-gray-100 dark:border-slate-800 rounded-lg p-4 bg-white dark:bg-slate-900 hover:shadow-md transition-shadow"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 flex items-center justify-center text-xs font-bold font-mono">
                                #{idx + 1}
                              </span>
                              <Tag color={getStateColor(group.state)} className="!mr-0 font-medium">
                                {group.state}
                              </Tag>
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">
                                {group.count} 个协程
                              </span>
                              <span className="text-xs text-gray-400">({group.percentage}%)</span>
                            </div>

                            <div className="w-48">
                              <Progress
                                percent={group.percentage}
                                size="small"
                                showInfo={false}
                                strokeColor="#6366f1"
                              />
                            </div>
                          </div>

                          {/* Top Frame Highlight */}
                          <div className="bg-gray-50 dark:bg-slate-800/70 rounded-md p-2.5 my-2 border-l-4 border-indigo-500 font-mono text-xs">
                            <div className="text-gray-900 dark:text-gray-100 font-semibold break-all">
                              {group.topFrame.function || 'unknown'}
                            </div>
                            <div className="text-gray-400 text-[11px] mt-0.5 break-all">
                              {group.topFrame.file}:{group.topFrame.line}
                            </div>
                          </div>

                          {/* Collapse for all frames */}
                          {group.frames && group.frames.length > 1 && (
                            <Collapse
                              ghost
                              size="small"
                              items={collapseItems}
                              className="!mt-1"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'profiling',
            label: (
              <span className="flex items-center space-x-1.5 font-medium text-xs px-1">
                <ThunderboltOutlined />
                <span>在线性能分析 (CPU & Heap Profiling)</span>
              </span>
            ),
            children: (
              <div className="space-y-6 pt-2">
                <Row gutter={[16, 16]}>
                  {/* CPU Profiling Card */}
                  <Col xs={24} md={12}>
                    <Card
                      className="shadow-sm border border-gray-100 dark:border-slate-800 h-full"
                      title={
                        <div className="flex items-center space-x-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                          <ThunderboltOutlined className="text-amber-500" />
                          <span>CPU 性能采样分析</span>
                        </div>
                      }
                    >
                      <div className="space-y-4">
                        <Paragraph className="text-xs text-gray-500 dark:text-gray-400 !mb-0 leading-relaxed">
                          采用 Go 官方 <code>runtime/pprof</code> 在线开启 CPU 分析器，采集指定时间窗口内的函数调用消耗，生成二进制 profile 文件。
                        </Paragraph>

                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">采样时长:</span>
                          <Select
                            value={cpuDuration}
                            onChange={setCpuDuration}
                            disabled={cpuSampling}
                            className="w-32"
                            options={[
                              { value: 5, label: '5 秒 (快速)' },
                              { value: 10, label: '10 秒 (推荐)' },
                              { value: 30, label: '30 秒 (深入)' },
                              { value: 60, label: '60 秒 (全量)' },
                            ]}
                          />
                        </div>

                        <Button
                          type="primary"
                          size="middle"
                          icon={<DownloadOutlined />}
                          loading={cpuSampling}
                          onClick={handleCpuProfile}
                          className="bg-amber-600 hover:!bg-amber-700 w-full h-9 rounded-lg text-xs font-medium"
                        >
                          {cpuSampling ? `正在采集 (${cpuDuration}s)...` : `开始采集并下载 CPU Profile (${cpuDuration}s)`}
                        </Button>

                        <div className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-lg text-xs font-mono text-gray-600 dark:text-gray-300 space-y-1">
                          <div className="text-[11px] text-gray-400 font-sans font-medium mb-1">本地可视化指南:</div>
                          <div className="text-indigo-600 dark:text-indigo-400"># 启动本地 Web 火焰图交互界面</div>
                          <div>go tool pprof -http=:8081 cpu_{cpuDuration}s.pprof</div>
                        </div>
                      </div>
                    </Card>
                  </Col>

                  {/* Heap Profiling Card */}
                  <Col xs={24} md={12}>
                    <Card
                      className="shadow-sm border border-gray-100 dark:border-slate-800 h-full"
                      title={
                        <div className="flex items-center space-x-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                          <DatabaseOutlined className="text-indigo-500" />
                          <span>内存堆分配采样分析</span>
                        </div>
                      }
                    >
                      <div className="space-y-4">
                        <Paragraph className="text-xs text-gray-500 dark:text-gray-400 !mb-0 leading-relaxed">
                          即时抓取当前进程堆内存快照 (Inuse Space / Alloc Space)，用于定位常驻大对象、对象泄漏及未释放的缓冲区。
                        </Paragraph>

                        <div className="pt-2">
                          <Button
                            type="primary"
                            size="middle"
                            icon={<DownloadOutlined />}
                            loading={heapSampling}
                            onClick={handleHeapProfile}
                            className="bg-indigo-600 hover:!bg-indigo-700 w-full h-9 rounded-lg text-xs font-medium"
                          >
                            立即生成并下载 Heap Profile
                          </Button>
                        </div>

                        <div className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-lg text-xs font-mono text-gray-600 dark:text-gray-300 space-y-1">
                          <div className="text-[11px] text-gray-400 font-sans font-medium mb-1">本地可视化指南:</div>
                          <div className="text-indigo-600 dark:text-indigo-400"># 启动本地 Web 内存树状/火焰图分析</div>
                          <div>go tool pprof -http=:8081 heap.pprof</div>
                        </div>
                      </div>
                    </Card>
                  </Col>
                </Row>

                {/* Flamegraph Usage Card */}
                <Card
                  className="shadow-sm border border-gray-100 dark:border-slate-800"
                  title={
                    <div className="flex items-center space-x-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                      <CodeOutlined className="text-emerald-500" />
                      <span>性能分析排查常见命令速查</span>
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-lg space-y-1">
                      <div className="font-sans font-semibold text-gray-700 dark:text-gray-200">查看 Top 耗时函数</div>
                      <div className="text-gray-500 dark:text-gray-400"># 进入交互式命令行</div>
                      <div>go tool pprof cpu_10s.pprof</div>
                      <div className="text-indigo-600 dark:text-indigo-400">(pprof) top20 -cum</div>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-lg space-y-1">
                      <div className="font-sans font-semibold text-gray-700 dark:text-gray-200">对比两次内存快照 (差量排查泄漏)</div>
                      <div className="text-gray-500 dark:text-gray-400"># 对比基准与增长后的内存差</div>
                      <div>go tool pprof -base base_heap.pprof current_heap.pprof</div>
                      <div className="text-indigo-600 dark:text-indigo-400">(pprof) top</div>
                    </div>
                  </div>
                </Card>
              </div>
            ),
          },
        ]}
      />
      </Card>

      {/* Raw Stack Dump Modal */}
      <Modal
        title={
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center space-x-2">
              <FileTextOutlined className="text-indigo-500" />
              <span>原始 Goroutine Stack Dump</span>
            </div>
            <Button
              size="middle"
              icon={copied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={handleCopyRaw}
              disabled={!rawDump || rawLoading}
              className="rounded-lg text-xs font-medium"
            >
              {copied ? '已复制' : '复制全部内容'}
            </Button>
          </div>
        }
        open={rawModalOpen}
        onCancel={() => setRawModalOpen(false)}
        footer={null}
        width={960}
      >
        <div className="mt-3">
          {rawLoading ? (
            <div className="py-20 text-center">
              <Spin tip="正在导出全量 Goroutine 堆栈..." />
            </div>
          ) : (
            <pre className="bg-gray-950 text-emerald-400 p-4 rounded-lg font-mono text-xs max-h-[580px] overflow-auto whitespace-pre-wrap leading-relaxed">
              {rawDump || '暂无堆栈数据'}
            </pre>
          )}
        </div>
      </Modal>
    </div>
  );
};
