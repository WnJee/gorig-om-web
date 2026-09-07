import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Space, Popconfirm, Typography, Modal, Alert } from 'antd';
import { message } from '../../utils/antMsg';
import {
  ReloadOutlined,
  PoweroffOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ControlOutlined,
} from '@ant-design/icons';
import { appApi } from '../../api/app';
import { ReStartLog } from '../../types';
import { StartSrcBadge } from '../../components/StatusBadge';
import { CodeViewer } from '../../components/CodeViewer';
import { PageHeader } from '../../components/PageHeader';
import { formatTime } from '../../utils/format';

const { Paragraph } = Typography;

export const AppManagePage: React.FC<{ isModal?: boolean }> = ({ isModal = false }) => {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [logs, setLogs] = useState<ReStartLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<ReStartLog | null>(null);

  const fetchLogs = useCallback(async (p = page, s = pageSize) => {
    setLoading(true);
    try {
      const res = await appApi.getRestartLogs(p, s);
      setLogs(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRestart = async () => {
    setActionLoading(true);
    try {
      await appApi.restart();
      message.success('已触发重启脚本，服务正在重启中...');
      setTimeout(() => fetchLogs(1, pageSize), 3000);
    } catch (err: any) {
      message.error(err.message || '重启失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await appApi.stop();
      message.warning('已触发停止脚本，应用正在下线');
      setTimeout(() => fetchLogs(1, pageSize), 3000);
    } catch (err: any) {
      message.error(err.message || '停止失败');
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
    {
      title: '重启时间',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (ts: number) => formatTime(ts),
    },
    {
      title: '重启来源',
      dataIndex: 'startSrc',
      key: 'startSrc',
      render: (src: any) => <StartSrcBadge src={src} />,
    },
    {
      title: '输出摘要',
      dataIndex: 'log',
      key: 'log',
      ellipsis: true,
      render: (text: string) => text ? text.slice(0, 100) : '无日志输出',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ReStartLog) => (
        <Button
          type="link"
          size="middle"
          icon={<FileTextOutlined />}
          onClick={() => setSelectedLog(record)}
          className="text-xs font-medium"
        >
          查看完整日志
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {!isModal && (
        <PageHeader
          icon={<ControlOutlined />}
          title="应用生命周期管理"
          description="管理 Gorig 宿主进程重启、停止，追踪历史启动记录与崩溃自愈日志"
        />
      )}

      <Alert
        message="进程与看门狗保障说明"
        description="Gorig-OM 内置守护脚本（watchdog）。当应用发生异常 Crash 或 CPU/内存持续超负荷时，守护进程会自动捕获并记录现场日志，完成自愈重启。"
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        className="rounded-xl"
      />

      <Card
        title={<span className="text-sm font-semibold">服务生命周期操作</span>}
        className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2">
          <div>
            <Paragraph className="!mb-1 font-medium text-gray-800 dark:text-gray-200">
              应用进程控制
            </Paragraph>
            <Paragraph className="!mb-0 text-xs text-gray-500">
              重启将向旧进程发送 SIGTERM (10s 超时退为 SIGKILL)，启动新进程并持续探活回环回调；停止将彻底退出。
            </Paragraph>
          </div>
          <Space>
            <Popconfirm
              title="确定要重启该应用吗？"
              description="该操作会短暂中断进行中的请求。"
              onConfirm={handleRestart}
              okText="确认重启"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="primary"
                size="middle"
                icon={<ReloadOutlined />}
                loading={actionLoading}
                className="bg-amber-600 hover:bg-amber-500 border-none shadow-sm rounded-lg text-xs font-medium h-9 px-4"
              >
                平滑重启应用
              </Button>
            </Popconfirm>

            <Popconfirm
              title="确定要停止服务吗？"
              description="停止服务后守护进程将一并关闭，需要运维人员登录机器启动。"
              onConfirm={handleStop}
              okText="确认停止"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                danger
                size="middle"
                icon={<PoweroffOutlined />}
                loading={actionLoading}
                className="rounded-lg text-xs font-medium h-9 px-4"
              >
                停止应用进程
              </Button>
            </Popconfirm>
          </Space>
        </div>
      </Card>

      <Card
        title={<span className="text-sm font-semibold">进程重启历史与自愈日志</span>}
        extra={
          <Button
            icon={<ReloadOutlined />}
            size="middle"
            onClick={() => fetchLogs(page, pageSize)}
            className="rounded-lg text-xs font-medium"
          >
            刷新记录
          </Button>
        }
        className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800"
      >
        <Table
          dataSource={logs}
          columns={columns}
          rowKey={(r) => `${r.startTime}-${r.startSrc}`}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, s) => {
              setPage(p);
              setPageSize(s);
              fetchLogs(p, s);
            },
            showSizeChanger: true,
            showTotal: (cnt) => `共 ${cnt} 条重启记录`,
          }}
          size="middle"
        />
      </Card>

      {/* Log Modal */}
      <Modal
        title={
          <div className="flex items-center space-x-2">
            <span>启动输出与现场日志</span>
            {selectedLog && <StartSrcBadge src={selectedLog.startSrc} />}
          </div>
        }
        open={!!selectedLog}
        onCancel={() => setSelectedLog(null)}
        footer={null}
        width={750}
      >
        {selectedLog && (
          <div className="space-y-3 mt-4">
            <div className="text-xs text-gray-500">
              启动时间: {formatTime(selectedLog.startTime)}
            </div>
            <CodeViewer
              code={selectedLog.log || '（无日志记录）'}
              maxHeight={450}
              title="STDOUT / Crash Context"
            />
          </div>
        )}
      </Modal>
    </div>
  );
};
