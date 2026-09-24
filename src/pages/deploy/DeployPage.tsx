import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  Tabs,
  Table,
  Button,
  Input,
  Switch,
  Space,
  Typography,
  Tag,
  Drawer,
  Popconfirm,
  Row,
  Col,
  Select,
  Modal,
} from 'antd';
import { message } from '../../utils/antMsg';
import {
  ReloadOutlined,
  PlayCircleOutlined,
  StopOutlined,
  RollbackOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  KeyOutlined,
  BranchesOutlined,
  FileTextOutlined,
  SettingOutlined,
  InfoCircleFilled,
  CheckOutlined,
  VerticalAlignBottomOutlined,
  CloudUploadOutlined,
  SaveOutlined,
  DownloadOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { deployApi } from '../../api/deploy';
import { EnvVersion, GoEnv, SshKey, TaskOptions, TaskRecord, TaskRecordLog } from '../../types';
import { TaskStatusBadge } from '../../components/StatusBadge';
import { CodeViewer } from '../../components/CodeViewer';
import { PageHeader } from '../../components/PageHeader';
import { formatTime } from '../../utils/format';
import dayjs from 'dayjs';
import { DeployConfigModal } from './DeployConfigModal';

const { Paragraph } = Typography;

function isValidTime(t?: string | number | null): boolean {
  if (!t) return false;
  if (typeof t === 'string' && (t.startsWith('0001-01-01') || t.startsWith('1970-01-01'))) {
    return false;
  }
  const d = dayjs(typeof t === 'number' && t < 1e11 ? t * 1000 : t);
  return d.isValid() && d.year() > 2000;
}

function getValidStartTime(r: TaskRecord): string | undefined {
  if (isValidTime(r.startAt)) return r.startAt;
  if (isValidTime(r.createAt)) return r.createAt;
  return undefined;
}

function formatTaskDuration(
  start?: string | number,
  finish?: string | number,
  status?: string,
  nowMs?: number
): string {
  if (!start) return '-';
  const startDay = dayjs(typeof start === 'number' && start < 1e11 ? start * 1000 : start);
  if (!startDay.isValid()) return '-';

  if (status === 'waiting') {
    return '-';
  }

  if (status === 'running') {
    const current = nowMs ? dayjs(nowMs) : dayjs();
    const diff = Math.max(1, current.diff(startDay, 'second'));
    if (diff < 60) return `${diff}秒 (执行中)`;
    if (diff < 3600) return `${Math.floor(diff / 60)}分${diff % 60}秒 (执行中)`;
    return `${Math.floor(diff / 3600)}小时${Math.floor((diff % 3600) / 60)}分 (执行中)`;
  }

  if (finish && isValidTime(finish)) {
    const finishDay = dayjs(typeof finish === 'number' && finish < 1e11 ? finish * 1000 : finish);
    if (finishDay.isValid()) {
      const diff = Math.max(1, finishDay.diff(startDay, 'second'));
      if (diff < 60) return `${diff}秒`;
      if (diff < 3600) return `${Math.floor(diff / 60)}分${diff % 60}秒`;
      return `${Math.floor(diff / 3600)}小时${Math.floor((diff % 3600) / 60)}分`;
    }
  }

  return '1秒';
}

interface TaskDurationDisplayProps {
  record: TaskRecord;
  inline?: boolean;
  timeFormat?: string;
}

const TaskDurationDisplay: React.FC<TaskDurationDisplayProps> = ({
  record,
  inline = false,
  timeFormat = 'YYYY-MM-DD HH:mm:ss',
}) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (record.status !== 'running') return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [record.status]);

  if (record.status === 'waiting') {
    if (inline) {
      return <span className="text-gray-400 text-xs">排队等待中</span>;
    }
    return <span className="text-gray-400 text-xs">-</span>;
  }

  const startTime = getValidStartTime(record);
  if (!startTime) {
    return <span className="text-gray-400 text-xs">-</span>;
  }

  const durationStr = formatTaskDuration(startTime, record.finishAt, record.status, now);

  if (inline) {
    return (
      <div className="font-mono text-xs text-gray-500 flex items-center gap-3">
        <span>起: {formatTime(startTime, timeFormat)}</span>
        <span className="text-indigo-600 dark:text-indigo-400 font-medium">
          耗时: {durationStr}
        </span>
      </div>
    );
  }

  return (
    <div className="text-xs text-gray-500 font-mono space-y-0.5">
      <div>起: {formatTime(startTime, timeFormat)}</div>
      <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
        耗时: {durationStr}
      </div>
    </div>
  );
};

export const DeployPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('tasks');

  // Tasks State
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [tasksTotal, setTasksTotal] = useState(0);
  const [tasksPage, setTasksPage] = useState(1);
  const [tasksSize, setTasksSize] = useState(10);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Selected Task Drawer (Logs)
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [taskDetailDrawerOpen, setTaskDetailDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (taskDetailDrawerOpen && selectedTask?.log?.length) {
      setTimeout(scrollToBottom, 80);
    }
  }, [taskDetailDrawerOpen, selectedTask?.log?.length]);

  const handleCopyLogs = () => {
    if (!selectedTask?.log || selectedTask.log.length === 0) {
      message.info('暂无日志可复制');
      return;
    }
    const text = selectedTask.log
      .map((item) => `[${formatTime(item.time, 'HH:mm:ss')}] [${(item.level || 'info').toUpperCase()}] ${item.text}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    message.success('已复制完整部署日志到剪贴板');
  };

  // Config Wizard Modal & State
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [taskConfig, setTaskConfig] = useState<TaskOptions | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [confirmDeployModalOpen, setConfirmDeployModalOpen] = useState(false);
  const [deployTriggerLoading, setDeployTriggerLoading] = useState(false);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [fetchingBranches, setFetchingBranches] = useState(false);
  const [repoBranchesMap, setRepoBranchesMap] = useState<Record<string, string[]>>({});
  const [fetchingRepoMap, setFetchingRepoMap] = useState<Record<string, boolean>>({});

  // Environment State
  const [gitStatus, setGitStatus] = useState<EnvVersion | null>(null);
  const [goStatus, setGoStatus] = useState<EnvVersion | null>(null);
  const [sshKey, setSshKey] = useState<SshKey | null>(null);
  const [goEnvs, setGoEnvs] = useState<GoEnv[]>([]);
  const [envLoading, setEnvLoading] = useState(false);

  // Fetch Tasks
  const fetchTasks = useCallback(async (page?: number, size?: number) => {
    const p = page || tasksPage;
    const s = size || tasksSize;
    setTasksLoading(true);
    try {
      const res = await deployApi.getTaskPage(p, s);
      setTasks(res.items || []);
      setTasksTotal(res.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setTasksLoading(false);
    }
  }, [tasksPage, tasksSize]);

  // Fetch Branches for main repo
  const fetchBranches = useCallback(async (repoUrl: string) => {
    if (!repoUrl?.trim()) return;
    setFetchingBranches(true);
    try {
      const bList = await deployApi.getBranches(repoUrl.trim());
      if (bList && bList.length > 0) {
        setBranchOptions(bList);
        setTaskConfig((prev) => {
          if (!prev) return prev;
          if (!prev.branch || !bList.includes(prev.branch)) {
            return { ...prev, branch: bList[0] };
          }
          return prev;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingBranches(false);
    }
  }, []);

  // Fetch Branches for secondary repo (otherRepos)
  const fetchOtherRepoBranches = useCallback(async (repoUrl: string, itemIdx?: number) => {
    if (!repoUrl?.trim()) return;
    const url = repoUrl.trim();
    setFetchingRepoMap((prev) => ({ ...prev, [url]: true }));
    try {
      const bList = await deployApi.getBranches(url);
      if (bList && bList.length > 0) {
        setRepoBranchesMap((prev) => ({ ...prev, [url]: bList }));
        if (typeof itemIdx === 'number') {
          setTaskConfig((prev) => {
            if (!prev || !prev.otherRepos || !prev.otherRepos[itemIdx]) return prev;
            const updated = [...prev.otherRepos];
            const currentItem = updated[itemIdx];
            if (!currentItem.branch || !bList.includes(currentItem.branch)) {
              updated[itemIdx] = { ...currentItem, branch: bList[0] };
              return { ...prev, otherRepos: updated };
            }
            return prev;
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingRepoMap((prev) => ({ ...prev, [url]: false }));
    }
  }, []);

  // Fetch Config
  const fetchConfig = useCallback(async () => {
    try {
      const cfg = await deployApi.getTaskConfig();
      if (cfg) {
        setTaskConfig(cfg);
        if (cfg.repo) {
          fetchBranches(cfg.repo);
        }
        if (cfg.otherRepos && cfg.otherRepos.length > 0) {
          cfg.otherRepos.forEach((item, idx) => {
            if (item.repo) {
              fetchOtherRepoBranches(item.repo, idx);
            }
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [fetchBranches, fetchOtherRepoBranches]);

  // Fetch Environment
  const fetchEnvironment = useCallback(async () => {
    setEnvLoading(true);
    try {
      const [git, go, ssh, envs] = await Promise.all([
        deployApi.checkGit(),
        deployApi.checkGo(),
        deployApi.getSSHKey(),
        deployApi.getGoEnv(),
      ]);
      setGitStatus(git);
      setGoStatus(go);
      setSshKey(ssh);
      setGoEnvs(envs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setEnvLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchConfig();
    fetchEnvironment();
  }, [fetchTasks, fetchConfig, fetchEnvironment]);

  // Auto poll running tasks
  useEffect(() => {
    const hasRunning = tasks.some((t) => t.status === 'running' || t.status === 'waiting');
    if (!hasRunning) return;
    const timer = setInterval(() => {
      fetchTasks(tasksPage, tasksSize);
      if (selectedTask) {
        deployApi.getTask(selectedTask.id).then((t) => setSelectedTask(t));
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [tasks, tasksPage, tasksSize, selectedTask, fetchTasks]);

  // Open Deploy Confirmation Modal
  const handleOpenDeployConfirm = () => {
    if (!taskConfig?.repo) {
      message.warning('尚未配置部署仓库与分支，请先打开向导进行配置');
      setConfigModalOpen(true);
      return;
    }
    setConfirmDeployModalOpen(true);
  };

  // Confirm Trigger Start Task
  const handleConfirmStartTask = async () => {
    setDeployTriggerLoading(true);
    try {
      await deployApi.startTask();
      message.success('已触发部署任务，正在排队执行...');
      setConfirmDeployModalOpen(false);
      fetchTasks(1, tasksSize);
    } catch (err: any) {
      message.error(err.message || '触发部署失败');
    } finally {
      setDeployTriggerLoading(false);
    }
  };

  // Stop Task
  const handleStopTask = async (id: string) => {
    try {
      await deployApi.stopTask(id);
      message.success('已发送取消部署任务指令');
      fetchTasks(tasksPage, tasksSize);
    } catch (err: any) {
      message.error(err.message || '取消任务失败');
    }
  };

  // Rollback Task
  const handleRollback = async (id: string) => {
    try {
      await deployApi.rollbackTask(id);
      message.success('已创建回滚任务，正在秒级恢复历史备份版本');
      fetchTasks(1, tasksSize);
    } catch (err: any) {
      message.error(err.message || '回滚任务创建失败');
    }
  };

  // Open Log Drawer
  const handleOpenDetail = async (id: string) => {
    setTaskDetailDrawerOpen(true);
    setDetailLoading(true);
    try {
      const task = await deployApi.getTask(id);
      setSelectedTask(task);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Save Config
  const handleSaveConfig = async (values: TaskOptions) => {
    setConfigLoading(true);
    try {
      await deployApi.saveTaskConfig(values);
      message.success('部署流水线配置已保存');
    } catch (err: any) {
      message.error(err.message || '保存配置失败');
    } finally {
      setConfigLoading(false);
    }
  };

  // Save Go Env
  const handleSaveGoEnvs = async () => {
    setEnvLoading(true);
    try {
      await deployApi.setGoEnv(goEnvs);
      message.success('Go 编译环境变量已更新');
      fetchEnvironment();
    } catch (err: any) {
      message.error(err.message || '更新环境变量失败');
    } finally {
      setEnvLoading(false);
    }
  };

  // Task Columns
  const taskColumns = [
    {
      title: '任务 ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <span className="font-mono text-xs font-semibold">{id}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: any) => <TaskStatusBadge status={s} />,
    },
    {
      title: '代码分支 / Commit',
      key: 'commit',
      render: (_: any, r: TaskRecord) => (
        <div className="space-y-0.5">
          <div className="flex items-center space-x-1 text-xs font-mono font-bold text-gray-700 dark:text-gray-300">
            <BranchesOutlined className="text-indigo-500" />
            <span>{r.branch}</span>
            {r.rb && <Tag color="orange">回滚任务</Tag>}
          </div>
          {r.commit && (
            <div className="text-xs text-gray-500 truncate max-w-xs" title={r.commit}>
              {r.commit}
            </div>
          )}
          {r.gitHash && (
            <div className="text-[11px] font-mono text-gray-400">
              hash: {r.gitHash.slice(0, 8)}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '执行时间 / 耗时',
      key: 'time',
      render: (_: any, r: TaskRecord) => <TaskDurationDisplay record={r} />,
    },
    {
      title: '可回滚状态',
      dataIndex: 'rbStatus',
      key: 'rbStatus',
      render: (st: string) => {
        if (st === 'ready') return <Tag color="cyan">备份就绪 (可回滚)</Tag>;
        if (st === 'cleaned') return <Tag color="default">已清理</Tag>;
        return <span className="text-gray-400 text-xs">-</span>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, r: TaskRecord) => (
        <Space size="small">
          <Button
            type="link"
            size="middle"
            icon={<FileTextOutlined />}
            onClick={() => handleOpenDetail(r.id)}
            className="text-xs font-medium"
          >
            日志
          </Button>

          {(r.status === 'running' || r.status === 'waiting') && (
            <Popconfirm
              title="确定取消该任务吗？"
              onConfirm={() => handleStopTask(r.id)}
              okText="确认取消"
              cancelText="返回"
            >
              <Button type="link" danger size="middle" icon={<StopOutlined />} className="text-xs font-medium">
                取消
              </Button>
            </Popconfirm>
          )}

          {r.rbStatus === 'ready' && r.status === 'success' && (
            <Popconfirm
              title="确定要秒级回滚到该版本吗？"
              description="将基于本任务的构建备份文件创建新的回滚任务，直接复用可执行程序重启。"
              onConfirm={() => handleRollback(r.id)}
              okText="确认回滚"
              cancelText="取消"
            >
              <Button type="link" size="middle" icon={<RollbackOutlined />} className="text-amber-600 text-xs font-medium">
                回滚
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-3 pb-4">
      {/* 1. Unified Page Header */}
      <PageHeader
        icon={<CloudUploadOutlined />}
        title="CI/CD 自动化部署流水线"
        description="涵盖 Git / Go 编译环境管理、SSH 密钥鉴权、自动化构建产物、平滑重启与秒级回滚"
        extra={
          <Space size="middle">
            <Button
              type="primary"
              size="middle"
              icon={<PlayCircleOutlined className="text-base" />}
              onClick={handleOpenDeployConfirm}
              className="bg-indigo-600 hover:!bg-indigo-700 text-sm font-medium rounded-lg h-9 px-4 shadow-sm"
            >
              立即触发部署
            </Button>
            <Button
              size="middle"
              icon={<SettingOutlined className="text-base" />}
              onClick={() => setConfigModalOpen(true)}
              className="text-sm font-medium rounded-lg h-9 px-4"
            >
              部署配置向导
            </Button>
            <Button
              size="middle"
              icon={<ReloadOutlined className="text-base" />}
              onClick={() => fetchTasks(tasksPage, tasksSize)}
              className="text-sm font-medium rounded-lg h-9 px-3.5"
            >
              刷新
            </Button>
          </Space>
        }
      />

      <Card className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'tasks',
              label: '部署任务列表',
              children: (
                <div className="space-y-4">
                  {!taskConfig?.repo && (
                    <div className="bg-gradient-to-r from-indigo-50/90 to-blue-50/70 dark:from-slate-800 dark:to-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-sm">
                          ⚙️
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-gray-800 dark:text-white">
                            尚未完成部署环境与 Git 仓库配置
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            请按照 4 步流程完成运行环境检测、SSH Key 密钥、Git 仓库地址及本地二方库配置。
                          </div>
                        </div>
                      </div>
                      <Button
                        type="primary"
                        icon={<SettingOutlined />}
                        onClick={() => setConfigModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs h-9 px-4 font-medium flex-shrink-0"
                      >
                        开始配置向导
                      </Button>
                    </div>
                  )}

                  <Table
                    dataSource={tasks}
                    columns={taskColumns}
                    rowKey="id"
                    loading={tasksLoading}
                    pagination={{
                      current: tasksPage,
                      pageSize: tasksSize,
                      total: tasksTotal,
                      onChange: (p, s) => {
                        setTasksPage(p);
                        setTasksSize(s);
                        fetchTasks(p, s);
                      },
                      showSizeChanger: true,
                      showTotal: (total) => `共 ${total} 个部署任务`,
                    }}
                    size="middle"
                  />
                </div>
              ),
            },
            {
              key: 'config',
              label: '流水线参数配置',
              forceRender: true,
              children: (
                <div className="max-w-3xl py-2 space-y-5">
                  {/* Top CTA Banner */}
                  <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div>
                      <div className="font-bold text-sm text-gray-800 dark:text-white">
                        CI/CD 部署流水线配置
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        按 4 步向导管理环境检测、SSH Key、Git 仓库及二方库依赖
                      </div>
                    </div>
                    <Button
                      type="primary"
                      icon={<SettingOutlined />}
                      onClick={() => setConfigModalOpen(true)}
                      className="bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs h-9 font-medium"
                    >
                      打开 4 步配置向导
                    </Button>
                  </div>

                  {/* Git Repo & Branch Section (Matching Screenshot 2) */}
                  <div className="space-y-4">
                    {/* Main Git Repo Row */}
                    <div className="flex items-center gap-2">
                      <Input
                        value={taskConfig?.repo || ''}
                        onChange={(e) =>
                          setTaskConfig((prev) =>
                            prev ? { ...prev, repo: e.target.value } : ({ repo: e.target.value } as any)
                          )
                        }
                        onBlur={(e) => {
                          if (e.target.value.trim()) {
                            fetchBranches(e.target.value.trim());
                          }
                        }}
                        placeholder="git@codeup.aliyun.com:617a97376746bc7c6cc8d2a5/next"
                        className="flex-1 h-9 rounded-lg text-xs font-mono"
                      />
                      <Button
                        icon={<CheckOutlined />}
                        loading={fetchingBranches}
                        onClick={async () => {
                          if (taskConfig?.repo?.trim()) {
                            await fetchBranches(taskConfig.repo.trim());
                            message.success('已重新检测仓库并拉取分支');
                          } else {
                            message.warning('请先输入 Git 仓库地址');
                          }
                        }}
                        className="h-9 px-4 rounded-lg text-xs text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700 hover:bg-gray-50"
                      >
                        重新检测
                      </Button>
                    </div>

                    {/* Branch Row */}
                    <div className="flex items-center gap-2">
                      <Select
                        value={taskConfig?.branch || undefined}
                        onChange={(val) =>
                          setTaskConfig((prev) =>
                            prev ? { ...prev, branch: val } : ({ branch: val } as any)
                          )
                        }
                        options={(branchOptions.length > 0 ? branchOptions : (taskConfig?.branch ? [taskConfig.branch] : [])).map((b) => ({ label: b, value: b }))}
                        placeholder={fetchingBranches ? '正在拉取分支...' : '选择部署分支（根据 Git 地址拉取）'}
                        loading={fetchingBranches}
                        showSearch
                        className="flex-1 h-9 rounded-lg text-xs font-mono"
                        notFoundContent={taskConfig?.repo ? (fetchingBranches ? '拉取分支中...' : '未拉取到分支') : '请先输入 Git 仓库地址'}
                        onFocus={() => {
                          if (taskConfig?.repo && branchOptions.length === 0) {
                            fetchBranches(taskConfig.repo);
                          }
                        }}
                      />
                      <Button
                        icon={<ReloadOutlined />}
                        loading={fetchingBranches}
                        onClick={async () => {
                          if (taskConfig?.repo?.trim()) {
                            await fetchBranches(taskConfig.repo.trim());
                            message.success('已刷新分支列表');
                          } else {
                            message.warning('请先输入 Git 仓库地址');
                          }
                        }}
                        className="h-9 px-4 rounded-lg text-xs text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700 hover:bg-gray-50"
                      >
                        刷新列表
                      </Button>
                    </div>

                    {/* Local Second-Party Libraries Configuration (Matching Screenshot 2) */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                          本地二方库配置
                        </span>
                        <Button
                          icon={<PlusOutlined />}
                          onClick={() => {
                            const cur = taskConfig?.otherRepos || [];
                            setTaskConfig((prev) =>
                              prev
                                ? { ...prev, otherRepos: [...cur, { dir: '', repo: '', branch: '' }] }
                                : ({ otherRepos: [{ dir: '', repo: '', branch: '' }] } as any)
                            );
                          }}
                          className="h-9 px-3.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700"
                        >
                          添加依赖
                        </Button>
                      </div>

                      {/* Dynamic Other Repos List */}
                      <div className="space-y-2.5">
                        {(!taskConfig?.otherRepos || taskConfig.otherRepos.length === 0) ? (
                          <div className="text-xs text-gray-400 p-3 bg-gray-50/50 dark:bg-slate-800/40 rounded-lg border border-dashed border-gray-200 dark:border-slate-700 text-center">
                            暂未配置二方库依赖（如无需依赖其他同级仓库，可直接跳过）
                          </div>
                        ) : (
                          taskConfig.otherRepos.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200/70 dark:border-slate-700/70"
                            >
                              <Input
                                value={item.dir}
                                onChange={(e) => {
                                  const updated = [...(taskConfig.otherRepos || [])];
                                  updated[idx] = { ...updated[idx], dir: e.target.value };
                                  setTaskConfig((prev) =>
                                    prev ? { ...prev, otherRepos: updated } : null
                                  );
                                }}
                                placeholder="本地依赖目录 (例如 ../gorig-om)"
                                className="w-56 h-9 rounded-lg text-xs font-mono"
                              />
                              <Input
                                value={item.repo}
                                onChange={(e) => {
                                  const updated = [...(taskConfig.otherRepos || [])];
                                  updated[idx] = { ...updated[idx], repo: e.target.value };
                                  setTaskConfig((prev) =>
                                    prev ? { ...prev, otherRepos: updated } : null
                                  );
                                }}
                                onBlur={(e) => {
                                  if (e.target.value.trim()) {
                                    fetchOtherRepoBranches(e.target.value.trim(), idx);
                                  }
                                }}
                                placeholder="Git 仓库地址 (SSH 或 HTTPS)"
                                className="flex-1 h-9 rounded-lg text-xs font-mono"
                              />
                              <Select
                                value={item.branch || undefined}
                                onChange={(val) => {
                                  const updated = [...(taskConfig.otherRepos || [])];
                                  updated[idx] = { ...updated[idx], branch: val };
                                  setTaskConfig((prev) =>
                                    prev ? { ...prev, otherRepos: updated } : null
                                  );
                                }}
                                options={(repoBranchesMap[item.repo] || (item.branch ? [item.branch] : [])).map((b) => ({
                                  label: b,
                                  value: b,
                                }))}
                                placeholder={fetchingRepoMap[item.repo] ? '拉取中...' : '选择分支'}
                                loading={fetchingRepoMap[item.repo]}
                                showSearch
                                className="w-36 h-9 rounded-lg text-xs font-mono"
                                onFocus={() => {
                                  if (item.repo && !repoBranchesMap[item.repo]) {
                                    fetchOtherRepoBranches(item.repo, idx);
                                  }
                                }}
                                notFoundContent={item.repo ? (fetchingRepoMap[item.repo] ? '拉取分支中...' : '未拉取到分支') : '请先输入仓库地址'}
                              />
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined className="text-rose-500 text-sm" />}
                                onClick={() => {
                                  const updated = (taskConfig.otherRepos || []).filter(
                                    (_, i) => i !== idx
                                  );
                                  setTaskConfig((prev) =>
                                    prev ? { ...prev, otherRepos: updated } : null
                                  );
                                }}
                                className="h-9 px-3 flex items-center justify-center rounded-lg hover:bg-rose-50 text-xs font-medium"
                              >
                                删除
                              </Button>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Cyan Info Notice Alert (Matching Screenshot 2) */}
                      <div className="bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/80 rounded-xl p-4 flex items-start gap-3">
                        <InfoCircleFilled className="text-cyan-500 text-xl flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                            二方库配置说明
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 space-y-1.5 leading-relaxed">
                            <p>请填写主仓库依赖的其他仓库，目录需为同级目录。</p>
                            <p className="font-medium text-gray-700 dark:text-gray-200">例如：</p>
                            <div className="font-mono text-cyan-800 dark:text-cyan-300 bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-lg border border-cyan-100 dark:border-cyan-900/50 select-text">
                              replace github.com/WnJee/gorig-om =&gt; ../gorig-om
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Auto Trigger & Save */}
                    <div className="pt-2 flex items-center justify-between border-t border-gray-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={taskConfig?.autoTrigger ?? false}
                          onChange={(val) =>
                            setTaskConfig((prev) =>
                              prev ? { ...prev, autoTrigger: val } : ({ autoTrigger: val } as any)
                            )
                          }
                        />
                        <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                          远端新 Commit 自动触发流水线
                        </span>
                      </div>

                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={configLoading}
                        onClick={async () => {
                          if (taskConfig) {
                            await handleSaveConfig(taskConfig);
                          }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 h-9 px-6 rounded-lg text-xs font-medium"
                      >
                        保存配置
                      </Button>
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: 'env',
              label: '编译环境与 SSH 密钥',
              children: (
                <div className="space-y-6 py-2">
                  {/* Git & Go Version Cards */}
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Card
                        title="Git 环境"
                        size="small"
                        extra={
                          gitStatus?.installed ? (
                            <Tag icon={<CheckCircleOutlined />} color="success">
                              已安装
                            </Tag>
                          ) : (
                            <Tag icon={<CloseCircleOutlined />} color="error">
                              未就绪
                            </Tag>
                          )
                        }
                      >
                        <div className="space-y-3">
                          <div className="text-xs text-gray-600 dark:text-gray-300 font-mono">
                            版本信息: {gitStatus?.version || '未检测到 Git 命令行'}
                          </div>
                          {!gitStatus?.installed && (
                            <Button
                              type="primary"
                              size="middle"
                              icon={<DownloadOutlined />}
                              onClick={async () => {
                                message.loading('正在安装 Git...', 2);
                                await deployApi.installGit();
                                fetchEnvironment();
                              }}
                              className="rounded-lg text-xs font-medium"
                            >
                              一键自动安装 Git
                            </Button>
                          )}
                        </div>
                      </Card>
                    </Col>

                    <Col xs={24} md={12}>
                      <Card
                        title="Go 编译环境"
                        size="small"
                        extra={
                          goStatus?.installed ? (
                            <Tag icon={<CheckCircleOutlined />} color="success">
                              已就绪 (≥1.23.4)
                            </Tag>
                          ) : (
                            <Tag icon={<CloseCircleOutlined />} color="warning">
                              未安装 / 低于要求
                            </Tag>
                          )
                        }
                      >
                        <div className="space-y-3">
                          <div className="text-xs text-gray-600 dark:text-gray-300 font-mono">
                            版本信息: {goStatus?.version || '未安装 Go 运行时'}
                          </div>
                          {!goStatus?.installed && (
                            <Button
                              type="primary"
                              size="middle"
                              icon={<DownloadOutlined />}
                              onClick={async () => {
                                message.loading('正在下载并安装 Go 官方 SDK...', 5);
                                await deployApi.installGo();
                                fetchEnvironment();
                              }}
                              className="rounded-lg text-xs font-medium"
                            >
                              一键自动安装 Go 1.23
                            </Button>
                          )}
                        </div>
                      </Card>
                    </Col>
                  </Row>

                  {/* SSH Key Manager */}
                  <Card title="服务器 SSH 公钥 (部署拉取私有仓库凭证)" size="small">
                    <div className="space-y-3">
                      <Paragraph className="!mb-0 text-xs text-gray-500">
                        将此公钥添加到 GitHub / GitLab / Gitee 仓库的 Deploy Keys 中，即可免密拉取代码：
                      </Paragraph>
                      <CodeViewer
                        code={sshKey?.publicKey || '// 尚未生成 SSH Key'}
                        maxHeight={120}
                        title="~/.ssh/id_rsa.pub"
                      />
                      <Space>
                        <Button
                          icon={<CopyOutlined />}
                          size="middle"
                          disabled={!sshKey?.publicKey}
                          onClick={() => {
                            if (sshKey?.publicKey) {
                              navigator.clipboard.writeText(sshKey.publicKey);
                              message.success('SSH 公钥已复制');
                            }
                          }}
                          className="rounded-lg text-xs font-medium"
                        >
                          复制公钥
                        </Button>
                        <Popconfirm
                          title="确定重新生成 SSH 密钥对吗？"
                          description="此操作会覆盖现有的 id_rsa 与 id_rsa.pub。"
                          onConfirm={async () => {
                            await deployApi.genSSHKey();
                            message.success('已生成新 4096 位 RSA 密钥对');
                            fetchEnvironment();
                          }}
                        >
                          <Button size="middle" icon={<KeyOutlined />} className="rounded-lg text-xs font-medium">
                            重新生成密钥对
                          </Button>
                        </Popconfirm>
                      </Space>
                    </div>
                  </Card>

                  {/* Go Environment Variables */}
                  <Card
                    title="Go 编译环境变量 (Go Env)"
                    size="small"
                    extra={
                      <Space>
                        <Button
                          size="middle"
                          icon={<PlusOutlined />}
                          onClick={() =>
                            setGoEnvs([...goEnvs, { key: '', value: '', default: false }])
                          }
                          className="rounded-lg text-xs font-medium"
                        >
                          添加变量
                        </Button>
                        <Button
                          type="primary"
                          size="middle"
                          icon={<SaveOutlined />}
                          onClick={handleSaveGoEnvs}
                          loading={envLoading}
                          className="bg-indigo-600 rounded-lg text-xs font-medium"
                        >
                          保存变量配置
                        </Button>
                      </Space>
                    }
                  >
                    <Table
                      dataSource={goEnvs}
                      rowKey="key"
                      pagination={false}
                      size="small"
                      columns={[
                        {
                          title: '变量名 (Key)',
                          dataIndex: 'key',
                          key: 'key',
                          width: 200,
                          render: (key: string, _, idx) => (
                            <Input
                              value={key}
                              size="small"
                              onChange={(e) => {
                                const list = [...goEnvs];
                                list[idx].key = e.target.value;
                                setGoEnvs(list);
                              }}
                            />
                          ),
                        },
                        {
                          title: '变量值 (Value)',
                          dataIndex: 'value',
                          key: 'value',
                          render: (val: string, _, idx) => (
                            <Input
                              value={val}
                              size="small"
                              onChange={(e) => {
                                const list = [...goEnvs];
                                list[idx].value = e.target.value;
                                setGoEnvs(list);
                              }}
                            />
                          ),
                        },
                        {
                          title: '默认保护',
                          dataIndex: 'default',
                          key: 'default',
                          width: 100,
                          render: (def: boolean) => (def ? <Tag color="blue">系统默认</Tag> : null),
                        },
                        {
                          title: '操作',
                          key: 'action',
                          width: 90,
                          render: (_, r, idx) =>
                            !r.default ? (
                              <Button
                                type="text"
                                danger
                                size="middle"
                                icon={<DeleteOutlined />}
                                onClick={() => {
                                  const list = goEnvs.filter((_, i) => i !== idx);
                                  setGoEnvs(list);
                                }}
                                className="rounded-lg text-xs font-medium"
                              >
                                删除
                              </Button>
                            ) : null,
                        },
                      ]}
                    />
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Task Log Execution Drawer */}
      <Drawer
        title={
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center space-x-2">
              <FileTextOutlined className="text-indigo-500" />
              <span className="font-semibold text-sm">部署执行日志</span>
              {selectedTask && (
                <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  {selectedTask.id}
                </span>
              )}
            </div>
            {selectedTask && (
              <Space size="small">
                <Button
                  size="middle"
                  icon={<VerticalAlignBottomOutlined />}
                  onClick={scrollToBottom}
                  className="rounded-lg text-xs font-medium"
                >
                  滚至底部
                </Button>
                <Button
                  size="middle"
                  icon={<CopyOutlined />}
                  onClick={handleCopyLogs}
                  className="rounded-lg text-xs font-medium"
                >
                  复制日志
                </Button>
              </Space>
            )}
          </div>
        }
        open={taskDetailDrawerOpen}
        onClose={() => setTaskDetailDrawerOpen(false)}
        width={860}
        styles={{
          body: {
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
          },
        }}
      >
        {detailLoading ? (
          <div className="text-center py-24 text-gray-400 text-xs">正在拉取任务日志...</div>
        ) : selectedTask ? (
          <div className="flex flex-col h-full space-y-3 min-h-0">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-800 text-xs flex-shrink-0">
              <Space size="middle">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">状态:</span>
                  <TaskStatusBadge status={selectedTask.status} />
                </div>
                {selectedTask.branch && (
                  <div className="flex items-center gap-1 font-mono text-gray-600 dark:text-gray-300">
                    <BranchesOutlined className="text-indigo-500" />
                    <span>{selectedTask.branch}</span>
                  </div>
                )}
              </Space>
              <TaskDurationDisplay record={selectedTask} inline timeFormat="HH:mm:ss" />
            </div>

            <div
              ref={logContainerRef}
              className="flex-1 min-h-0 rounded-xl border border-gray-800 bg-gray-950 font-mono text-xs p-4 overflow-y-auto overflow-x-auto select-text space-y-2.5 shadow-inner"
              style={{ maxHeight: 'calc(100vh - 160px)' }}
            >
              {(selectedTask.log || []).length === 0 ? (
                <div className="text-gray-500 text-center py-16">暂无步骤日志输出</div>
              ) : (
                selectedTask.log?.map((item: TaskRecordLog, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-start space-x-2.5 group hover:bg-gray-900/60 -mx-2 px-2 py-0.5 rounded transition"
                  >
                    <span className="text-gray-500 select-none whitespace-nowrap text-[11px] pt-0.5 font-mono">
                      {formatTime(item.time, 'HH:mm:ss')}
                    </span>
                    <span
                      className={`select-none uppercase px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                        item.level === 'error'
                          ? 'bg-red-950 text-red-400 border border-red-800/50'
                          : item.level === 'warn'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                          : 'bg-indigo-950 text-indigo-400 border border-indigo-800/50'
                      }`}
                    >
                      {item.level || 'info'}
                    </span>
                    <pre className="flex-1 font-mono text-xs whitespace-pre-wrap break-all leading-relaxed m-0 select-text text-gray-200">
                      {item.text}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* Deploy Config Wizard Modal (4-step workflow) */}
      <DeployConfigModal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        onSuccess={() => {
          fetchConfig();
          fetchEnvironment();
          fetchTasks(1, tasksSize);
        }}
        initialConfig={taskConfig}
        gitStatus={gitStatus}
        goStatus={goStatus}
        sshKey={sshKey}
        onRefreshEnv={fetchEnvironment}
      />

      {/* 立即触发部署二次确认弹窗 */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-base font-bold text-gray-800 dark:text-white">
            <RocketOutlined className="text-indigo-600" />
            <span>确认立即触发部署</span>
          </div>
        }
        open={confirmDeployModalOpen}
        onCancel={() => !deployTriggerLoading && setConfirmDeployModalOpen(false)}
        footer={[
          <Button
            key="cancel"
            disabled={deployTriggerLoading}
            onClick={() => setConfirmDeployModalOpen(false)}
            className="rounded-lg text-xs"
          >
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={deployTriggerLoading}
            icon={<PlayCircleOutlined />}
            onClick={handleConfirmStartTask}
            className="bg-indigo-600 hover:!bg-indigo-700 rounded-lg text-xs font-medium"
          >
            确认触发部署
          </Button>,
        ]}
        width={560}
        destroyOnHidden
      >
        <div className="py-2 space-y-4">
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            系统将立即拉取目标分支最新代码并在服务器本地执行编译与构建部署。请核对以下项目仓库与分支配置：
          </div>

          <div className="bg-gray-50 dark:bg-slate-800/60 p-4 rounded-xl border border-gray-100 dark:border-slate-800 space-y-3 text-xs">
            <div className="flex items-start justify-between gap-3">
              <span className="text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Git 仓库地址:</span>
              <span className="font-mono text-gray-800 dark:text-gray-200 text-right max-w-[360px] break-all select-all font-semibold">
                {taskConfig?.repo || '-'}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-gray-200/60 dark:border-slate-700/60 pt-2.5">
              <span className="text-gray-500 dark:text-gray-400 font-medium">部署目标分支:</span>
              <Tag color="indigo" className="font-mono px-2.5 py-0.5 text-xs font-semibold">
                {taskConfig?.branch || '-'}
              </Tag>
            </div>

            {taskConfig?.otherRepos && taskConfig.otherRepos.length > 0 && (
              <div className="border-t border-gray-200/60 dark:border-slate-700/60 pt-2.5 space-y-1.5">
                <span className="text-gray-500 dark:text-gray-400 font-medium">
                  依赖二方库 ({taskConfig.otherRepos.length} 个):
                </span>
                <div className="space-y-1 pl-2">
                  {taskConfig.otherRepos.map((item, idx) => (
                    <div key={idx} className="font-mono text-[11px] text-gray-600 dark:text-gray-400">
                      • {item.dir} → {item.repo} ({item.branch})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {taskConfig?.healthCheckUrl && (
              <div className="flex items-center justify-between border-t border-gray-200/60 dark:border-slate-700/60 pt-2.5">
                <span className="text-gray-500 dark:text-gray-400 font-medium">健康检查探针:</span>
                <span className="font-mono text-gray-700 dark:text-gray-300">
                  {taskConfig.healthCheckUrl} ({taskConfig.healthCheckTimeout || 30}s)
                </span>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
