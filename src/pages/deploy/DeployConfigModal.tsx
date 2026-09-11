import React, { useState, useEffect } from 'react';
import {
  Modal,
  Steps,
  Button,
  Input,
  InputNumber,
  Select,
  Switch,
  Space,
  Tag,
  Popconfirm,
} from 'antd';
import { message } from '../../utils/antMsg';
import {
  CheckCircleFilled,
  InfoCircleFilled,
  CheckOutlined,
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  KeyOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  LeftOutlined,
  RightOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { deployApi } from '../../api/deploy';
import { EnvVersion, OtherRepo, SshKey, TaskOptions } from '../../types';

interface DeployConfigModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialConfig?: TaskOptions | null;
  gitStatus: EnvVersion | null;
  goStatus: EnvVersion | null;
  sshKey: SshKey | null;
  onRefreshEnv: () => Promise<void>;
}

export const DeployConfigModal: React.FC<DeployConfigModalProps> = ({
  open,
  onClose,
  onSuccess,
  initialConfig,
  gitStatus,
  goStatus,
  sshKey,
  onRefreshEnv,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  // Form State
  const [gitInit, setGitInit] = useState(true);
  const [goInit, setGoInit] = useState(true);
  const [sshKeyCopy, setSshKeyCopy] = useState(true);
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('');
  const [otherRepos, setOtherRepos] = useState<OtherRepo[]>([]);
  const [autoTrigger, setAutoTrigger] = useState(false);
  const [healthCheckUrl, setHealthCheckUrl] = useState('/ping');
  const [healthCheckTimeout, setHealthCheckTimeout] = useState(30);
  const [autoRollback, setAutoRollback] = useState(true);

  // Loading States
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [checkingRepo, setCheckingRepo] = useState(false);
  const [fetchingBranches, setFetchingBranches] = useState(false);
  const [repoBranchesMap, setRepoBranchesMap] = useState<Record<string, string[]>>({});
  const [fetchingRepoMap, setFetchingRepoMap] = useState<Record<string, boolean>>({});
  const [generatingKey, setGeneratingKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [installingGit, setInstallingGit] = useState(false);
  const [installingGo, setInstallingGo] = useState(false);

  // Sync Initial Config
  useEffect(() => {
    if (initialConfig) {
      setGitInit(gitStatus?.installed ?? (initialConfig.gitInit ?? true));
      setGoInit(goStatus?.installed ?? (initialConfig.goInit ?? true));
      setSshKeyCopy(initialConfig.sshKeyCopy ?? true);
      setRepo(initialConfig.repo || '');
      setBranch(initialConfig.branch || '');
      setOtherRepos(initialConfig.otherRepos || []);
      setAutoTrigger(initialConfig.autoTrigger ?? false);
      setHealthCheckUrl(
        initialConfig.healthCheckUrl !== undefined && initialConfig.healthCheckUrl !== ''
          ? initialConfig.healthCheckUrl
          : '/ping'
      );
      setHealthCheckTimeout(initialConfig.healthCheckTimeout || 30);
      setAutoRollback(initialConfig.autoRollback ?? true);

      if (initialConfig.repo) {
        fetchBranchList(initialConfig.repo);
      }
      if (initialConfig.otherRepos && initialConfig.otherRepos.length > 0) {
        initialConfig.otherRepos.forEach((item, idx) => {
          if (item.repo) {
            fetchOtherRepoBranchList(item.repo, idx);
          }
        });
      }
    } else {
      setGitInit(gitStatus?.installed ?? true);
      setGoInit(goStatus?.installed ?? true);
      setSshKeyCopy(true);
      setBranch('');
      setBranchOptions([]);
      setHealthCheckUrl('/ping');
      setHealthCheckTimeout(30);
      setAutoRollback(true);
    }
  }, [initialConfig, open, gitStatus, goStatus]);

  // Fetch branches helper for main repo
  const fetchBranchList = async (targetRepo: string) => {
    if (!targetRepo?.trim()) return;
    setFetchingBranches(true);
    try {
      const bList = await deployApi.getBranches(targetRepo.trim());
      if (bList && bList.length > 0) {
        setBranchOptions(bList);
        setBranch((prev) => {
          if (!prev || !bList.includes(prev)) {
            return bList[0];
          }
          return prev;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingBranches(false);
    }
  };

  // Fetch branches helper for otherRepos
  const fetchOtherRepoBranchList = async (repoUrl: string, itemIdx?: number) => {
    if (!repoUrl?.trim()) return;
    const url = repoUrl.trim();
    setFetchingRepoMap((prev) => ({ ...prev, [url]: true }));
    try {
      const bList = await deployApi.getBranches(url);
      if (bList && bList.length > 0) {
        setRepoBranchesMap((prev) => ({ ...prev, [url]: bList }));
        if (typeof itemIdx === 'number') {
          setOtherRepos((prev) => {
            const next = [...prev];
            if (next[itemIdx]) {
              if (!next[itemIdx].branch || !bList.includes(next[itemIdx].branch)) {
                next[itemIdx] = { ...next[itemIdx], branch: bList[0] };
              }
            }
            return next;
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingRepoMap((prev) => ({ ...prev, [url]: false }));
    }
  };

  // Re-check Main Repo
  const handleRecheckRepo = async () => {
    if (!repo.trim()) {
      message.warning('请先输入 Git 仓库地址');
      return;
    }
    setCheckingRepo(true);
    try {
      const bList = await deployApi.getBranches(repo.trim());
      if (bList && bList.length > 0) {
        setBranchOptions(bList);
        setBranch((prev) => {
          if (!prev || !bList.includes(prev)) {
            return bList[0];
          }
          return prev;
        });
        message.success(`仓库检测成功，已识别 ${bList.length} 个分支`);
      } else {
        message.info('仓库已连接，已加载分支列表');
      }
    } catch (err: any) {
      message.error(err.message || '仓库检测失败，请确认 SSH 密钥权限或网络');
    } finally {
      setCheckingRepo(false);
    }
  };

  // Refresh Branch List
  const handleRefreshBranches = async () => {
    if (!repo.trim()) {
      message.warning('请先输入 Git 仓库地址');
      return;
    }
    setFetchingBranches(true);
    try {
      const bList = await deployApi.getBranches(repo.trim());
      if (bList && bList.length > 0) {
        setBranchOptions(bList);
        message.success(`分支列表刷新成功（共 ${bList.length} 个）`);
      } else {
        message.info('分支列表已刷新');
      }
    } catch (err: any) {
      message.error(err.message || '获取分支列表失败');
    } finally {
      setFetchingBranches(false);
    }
  };

  // Add Other Repo Item
  const handleAddOtherRepo = () => {
    setOtherRepos([...otherRepos, { dir: '', repo: '', branch: '' }]);
  };

  // Update Other Repo Item
  const updateOtherRepo = (index: number, field: keyof OtherRepo, value: string) => {
    const next = [...otherRepos];
    next[index] = { ...next[index], [field]: value };
    setOtherRepos(next);
  };

  // Remove Other Repo Item
  const removeOtherRepo = (index: number) => {
    setOtherRepos(otherRepos.filter((_, i) => i !== index));
  };

  // Copy SSH Key
  const handleCopySSHKey = () => {
    if (sshKey?.publicKey) {
      navigator.clipboard.writeText(sshKey.publicKey);
      message.success('SSH 公钥已成功复制到剪贴板');
    } else {
      message.warning('暂无可用公钥，请点击生成');
    }
  };

  // Generate New SSH Key
  const handleGenSSHKey = async () => {
    setGeneratingKey(true);
    try {
      await deployApi.genSSHKey();
      await onRefreshEnv();
      message.success('已生成新的 SSH 密钥对');
    } catch (err: any) {
      message.error(err.message || '生成密钥失败');
    } finally {
      setGeneratingKey(false);
    }
  };

  // Install Git
  const handleInstallGit = async () => {
    setInstallingGit(true);
    try {
      await deployApi.installGit();
      await onRefreshEnv();
      message.success('Git 安装/检测完成');
    } catch (err: any) {
      message.error(err.message || '安装 Git 失败');
    } finally {
      setInstallingGit(false);
    }
  };

  // Install Go
  const handleInstallGo = async () => {
    setInstallingGo(true);
    try {
      await deployApi.installGo();
      await onRefreshEnv();
      message.success('Go 环境安装/检测完成');
    } catch (err: any) {
      message.error(err.message || '安装 Go 失败');
    } finally {
      setInstallingGo(false);
    }
  };

  // Save Final Configuration
  const handleSaveAll = async () => {
    if (!repo.trim()) {
      setCurrentStep(2);
      message.error('请先配置主仓库 Git 地址');
      return;
    }
    if (!branch) {
      setCurrentStep(2);
      message.error('请选择部署分支');
      return;
    }

    setSaving(true);
    try {
      const configPayload: TaskOptions = {
        gitInit: Boolean(gitInit ?? gitStatus?.installed ?? true),
        goInit: Boolean(goInit ?? goStatus?.installed ?? true),
        sshKeyCopy: Boolean(sshKeyCopy ?? true),
        repo: repo.trim(),
        branch,
        otherRepos: otherRepos.filter((r) => r.dir && r.repo),
        autoTrigger: Boolean(autoTrigger),
        healthCheckUrl: healthCheckUrl.trim(),
        healthCheckTimeout: Number(healthCheckTimeout) || 30,
        autoRollback: Boolean(autoRollback),
      };

      await deployApi.saveTaskConfig(configPayload);
      message.success('CI/CD 部署流水线配置已成功保存！');
      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.message || '保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center space-x-2 text-base font-bold text-gray-800 dark:text-white">
          <span>配置</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={820}
      destroyOnHidden
      footer={null}
      className="deploy-config-wizard"
    >
      <div className="pt-2 pb-1 space-y-6">
        {/* Steps Navigation Header (Exact matching Screenshot 1) */}
        <Steps
          current={currentStep}
          onChange={(step) => setCurrentStep(step)}
          items={[
            { title: '运行环境检测' },
            { title: 'SSH Key 配置' },
            { title: '配置仓库地址' },
            { title: '自动触发配置' },
          ]}
        />

        {/* Step 1: 运行环境检测 */}
        {currentStep === 0 && (
          <div className="space-y-4 py-2">
            <div className="bg-gray-50 dark:bg-slate-800/60 p-4 rounded-xl border border-gray-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-gray-800 dark:text-white">Git 运行时检测</h4>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    {gitStatus?.version || '未检测到 Git 命令行工具'}
                  </p>
                </div>
                {gitStatus?.installed ? (
                  <Tag icon={<CheckCircleOutlined />} color="success" className="px-2.5 py-1 text-xs">
                    已就绪
                  </Tag>
                ) : (
                  <Button
                    type="primary"
                    size="middle"
                    icon={<DownloadOutlined />}
                    loading={installingGit}
                    onClick={handleInstallGit}
                    className="bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium"
                  >
                    一键安装 Git
                  </Button>
                )}
              </div>

              <div className="border-t border-gray-200/60 dark:border-slate-700/60 pt-3 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-gray-800 dark:text-white">Go 编译环境检测</h4>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    {goStatus?.version || '未检测到 Go SDK'}
                  </p>
                </div>
                {goStatus?.installed ? (
                  <Tag icon={<CheckCircleOutlined />} color="success" className="px-2.5 py-1 text-xs">
                    已就绪
                  </Tag>
                ) : (
                  <Button
                    type="primary"
                    size="middle"
                    icon={<DownloadOutlined />}
                    loading={installingGo}
                    onClick={handleInstallGo}
                    className="bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium"
                  >
                    一键安装 Go
                  </Button>
                )}
              </div>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-4 flex items-start gap-3">
              <CheckCircleFilled className="text-emerald-500 text-xl flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm">环境检测说明</div>
                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                  部署流水线将在本服务器本地执行代码拉取与编译构建，确认 Git 与 Go SDK 就绪后即可进入下一步。
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end pt-4 border-t border-gray-100 dark:border-slate-800">
              <Button
                type="primary"
                size="middle"
                icon={<RightOutlined />}
                onClick={() => setCurrentStep(1)}
                className="h-9 px-6 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium"
              >
                下一步：SSH Key 配置
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: SSH Key 配置 */}
        {currentStep === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  服务器公钥 (Public Key)
                </span>
                <Space size="small">
                  <Button
                    size="middle"
                    icon={<CopyOutlined />}
                    onClick={handleCopySSHKey}
                    className="rounded-lg text-xs font-medium"
                  >
                    复制公钥
                  </Button>
                  <Popconfirm
                    title="确定重新生成密钥对吗？"
                    description="重新生成后旧公钥将失效，需重新配置到 Git 托管平台。"
                    onConfirm={handleGenSSHKey}
                    okText="生成新密钥"
                    cancelText="取消"
                  >
                    <Button
                      size="middle"
                      icon={<KeyOutlined />}
                      loading={generatingKey}
                      className="rounded-lg text-xs font-medium"
                    >
                      重新生成
                    </Button>
                  </Popconfirm>
                </Space>
              </div>

              <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-3 border border-gray-200 dark:border-slate-800">
                <div className="text-xs font-mono text-gray-600 dark:text-gray-300 break-all select-all leading-relaxed">
                  {sshKey?.publicKey || '尚未生成 SSH 公钥'}
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl p-4 flex items-start gap-3">
              <InfoCircleFilled className="text-amber-500 text-xl flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm">部署密钥使用方式</div>
                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 space-y-1 leading-relaxed">
                  <p>1. 点击上方按钮复制服务器 SSH 公钥；</p>
                  <p>2. 前往 Git 平台（GitHub / GitLab / 阿里云 Codeup / Gitee）仓库设置；</p>
                  <p>3. 找到 <strong>Deploy Keys / 部署密钥</strong> 菜单，添加并粘贴该公钥（只需只读权限）；</p>
                  <p>4. 添加成功后，勾选下方确认项并进入下一步。</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Switch
                checked={sshKeyCopy}
                onChange={setSshKeyCopy}
                className="bg-gray-300"
              />
              <span className="text-xs text-gray-700 dark:text-gray-300">
                我已将公钥添加至 Git 托管平台的 SSH Keys 中
              </span>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-slate-800">
              <Button
                size="middle"
                icon={<LeftOutlined />}
                onClick={() => setCurrentStep(0)}
                className="h-9 px-4 rounded-lg text-xs font-medium"
              >
                上一步
              </Button>
              <Button
                type="primary"
                size="middle"
                icon={<RightOutlined />}
                onClick={() => setCurrentStep(2)}
                className="h-9 px-6 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium"
              >
                下一步：配置仓库地址
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: 配置仓库地址 (Exact UI from User Screenshot 2) */}
        {currentStep === 2 && (
          <div className="space-y-4 py-1">
            {/* Main Git Repo Row */}
            <div className="flex items-center gap-2">
              <Input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                onBlur={(e) => {
                  if (e.target.value.trim()) {
                    fetchBranchList(e.target.value.trim());
                  }
                }}
                placeholder="git@codeup.aliyun.com:617a97376746bc7c6cc8d2a5/next"
                className="flex-1 h-9 rounded-lg text-xs font-mono"
              />
              <Button
                icon={<CheckOutlined />}
                size="middle"
                loading={checkingRepo}
                onClick={handleRecheckRepo}
                className="h-9 px-4 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700 hover:bg-gray-50"
              >
                重新检测
              </Button>
            </div>

            {/* Branch Row */}
            <div className="flex items-center gap-2">
              <Select
                value={branch || undefined}
                onChange={setBranch}
                options={(branchOptions.length > 0 ? branchOptions : (branch ? [branch] : [])).map((b) => ({ label: b, value: b }))}
                placeholder={fetchingBranches ? '正在拉取分支...' : '选择部署分支（根据 Git 地址拉取）'}
                loading={fetchingBranches}
                showSearch
                className="flex-1 h-9 rounded-lg text-xs font-mono"
                notFoundContent={repo ? (fetchingBranches ? '拉取分支中...' : '未拉取到分支') : '请先输入 Git 仓库地址'}
                onFocus={() => {
                  if (repo && branchOptions.length === 0) {
                    fetchBranchList(repo);
                  }
                }}
              />
              <Button
                icon={<ReloadOutlined />}
                size="middle"
                loading={fetchingBranches}
                onClick={handleRefreshBranches}
                className="h-9 px-4 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700 hover:bg-gray-50"
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
                  size="middle"
                  onClick={handleAddOtherRepo}
                  className="h-9 px-3.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700"
                >
                  添加依赖
                </Button>
              </div>

              {/* Dynamic Other Repos List */}
              <div className="space-y-2.5">
                {otherRepos.length === 0 ? (
                  <div className="text-xs text-gray-400 p-3 bg-gray-50/50 dark:bg-slate-800/40 rounded-lg border border-dashed border-gray-200 dark:border-slate-700 text-center">
                    暂未配置二方库依赖（如无需依赖其他同级仓库，可直接跳过）
                  </div>
                ) : (
                  otherRepos.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-800"
                    >
                      <Input
                        value={item.dir}
                        onChange={(e) => updateOtherRepo(idx, 'dir', e.target.value)}
                        placeholder="next19-core"
                        className="w-44 h-9 rounded-lg text-xs font-mono"
                      />
                      <Input
                        value={item.repo}
                        onChange={(e) => updateOtherRepo(idx, 'repo', e.target.value)}
                        onBlur={(e) => {
                          if (e.target.value.trim()) {
                            fetchOtherRepoBranchList(e.target.value.trim(), idx);
                          }
                        }}
                        placeholder="git@codeup.aliyun.com:617a97376746..."
                        className="flex-1 h-9 rounded-lg text-xs font-mono"
                      />
                      <Select
                        value={item.branch || undefined}
                        onChange={(val) => updateOtherRepo(idx, 'branch', val)}
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
                            fetchOtherRepoBranchList(item.repo, idx);
                          }
                        }}
                        notFoundContent={item.repo ? (fetchingRepoMap[item.repo] ? '正在获取分支...' : '未拉取到分支') : '请先输入仓库地址'}
                      />
                      <Button
                        type="text"
                        danger
                        size="middle"
                        icon={<DeleteOutlined className="text-rose-500 text-sm" />}
                        onClick={() => removeOtherRepo(idx)}
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
                      replace github.com/jom-io/gorig-om =&gt; ../gorig-om
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-slate-800">
              <Button
                size="middle"
                icon={<LeftOutlined />}
                onClick={() => setCurrentStep(1)}
                className="h-9 px-4 rounded-lg text-xs font-medium"
              >
                上一步
              </Button>
              <Button
                type="primary"
                size="middle"
                icon={<RightOutlined />}
                onClick={() => {
                  if (!repo.trim()) {
                    message.warning('请先输入 Git 仓库地址');
                    return;
                  }
                  setCurrentStep(3);
                }}
                className="h-9 px-6 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium"
              >
                下一步：自动触发配置
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: 自动触发配置 */}
        {currentStep === 3 && (
          <div className="space-y-4 py-2">
            <div className="bg-gray-50 dark:bg-slate-800/60 p-4 rounded-xl border border-gray-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-gray-800 dark:text-white">
                    代码更新自动触发部署 (Auto Trigger)
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    开启后，当监测到远端 Git 仓库目标分支有新 Commit 提交时，自动创建并运行流水线发布任务。
                  </p>
                </div>
                <Switch checked={autoTrigger} onChange={setAutoTrigger} />
              </div>
            </div>

            {/* Health Check Probe & Auto Rollback Card */}
            <div className="bg-gray-50 dark:bg-slate-800/60 p-4 rounded-xl border border-gray-100 dark:border-slate-800 space-y-3">
              <div>
                <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center space-x-1.5">
                  <span>发布健康探针与自动回滚</span>
                  <Tag color="processing" className="text-[10px]">高可用防护</Tag>
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  服务启动后，系统将自动探测健康端点。若在指定时间内未能通过检查，自动执行回滚并推送告警。
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                    探针 URL / 相对路径 (可选):
                  </label>
                  <Input
                    placeholder="例如: /ping 或 http://127.0.0.1:19617/ping (留空则直接判定成功)"
                    value={healthCheckUrl}
                    onChange={(e) => setHealthCheckUrl(e.target.value)}
                    className="rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                    探针超时时长 (秒):
                  </label>
                  <InputNumber
                    min={5}
                    max={300}
                    value={healthCheckTimeout}
                    onChange={(val) => setHealthCheckTimeout(val || 30)}
                    className="w-full rounded-lg text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 dark:border-slate-700/60">
                <div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    探针超时失败后自动执行 Rollback 回滚
                  </span>
                  <p className="text-[11px] text-gray-400">
                    自动切换至上一次部署成功的可回滚版本，防止损坏版本持续阻断线上流量
                  </p>
                </div>
                <Switch checked={autoRollback} onChange={setAutoRollback} />
              </div>
            </div>

            {/* Summary Review Card */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
              <h4 className="font-bold text-xs text-gray-700 dark:text-gray-300">
                当前部署配置预览清单
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-gray-400">主仓库地址:</span>
                  <div className="font-mono text-gray-700 dark:text-gray-200 break-all">{repo || '-'}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-400">部署分支:</span>
                  <div className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                    {branch || '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-400">二方库依赖项:</span>
                  <div className="text-gray-700 dark:text-gray-300">
                    {otherRepos.filter((r) => r.dir && r.repo).length} 个已定义
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-400">自动触发状态:</span>
                  <div>
                    {autoTrigger ? (
                      <Tag color="success">已开启自动构建</Tag>
                    ) : (
                      <Tag color="default">手动触发模式</Tag>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-400">健康检查探针:</span>
                  <div className="font-mono text-gray-700 dark:text-gray-300">
                    {healthCheckUrl ? `${healthCheckUrl} (${healthCheckTimeout}s)` : '未启用探针'}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-400">探针失败自动回滚:</span>
                  <div>
                    {autoRollback ? (
                      <Tag color="blue">自动回滚已开启</Tag>
                    ) : (
                      <Tag color="default">未开启自动回滚</Tag>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-slate-800">
              <Button
                size="middle"
                icon={<LeftOutlined />}
                onClick={() => setCurrentStep(2)}
                className="h-9 px-4 rounded-lg text-xs font-medium"
              >
                上一步
              </Button>
              <Button
                type="primary"
                size="middle"
                loading={saving}
                icon={<RocketOutlined />}
                onClick={handleSaveAll}
                className="h-9 px-6 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium shadow-sm"
              >
                完成并保存配置
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
