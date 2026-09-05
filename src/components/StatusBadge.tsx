import React from 'react';
import { Tag } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { LogLevel, StartSrc, TaskStatus } from '../types';

interface TaskStatusBadgeProps {
  status: TaskStatus;
}

export const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'waiting':
      return (
        <Tag icon={<ClockCircleOutlined />} color="default">
          排队中
        </Tag>
      );
    case 'running':
      return (
        <Tag icon={<SyncOutlined spin />} color="processing">
          执行中
        </Tag>
      );
    case 'success':
      return (
        <Tag icon={<CheckCircleOutlined />} color="success">
          构建成功
        </Tag>
      );
    case 'failed':
      return (
        <Tag icon={<CloseCircleOutlined />} color="error">
          执行失败
        </Tag>
      );
    case 'timeout':
      return (
        <Tag icon={<ExclamationCircleOutlined />} color="warning">
          超时
        </Tag>
      );
    case 'canceled':
      return (
        <Tag icon={<StopOutlined />} color="default">
          已取消
        </Tag>
      );
    default:
      return <Tag>{status}</Tag>;
  }
};

interface StartSrcBadgeProps {
  src: StartSrc;
}

export const StartSrcBadge: React.FC<StartSrcBadgeProps> = ({ src }) => {
  switch (src) {
    case 'manual':
      return <Tag color="blue">手动触发</Tag>;
    case 'deploy':
      return <Tag color="purple">CI/CD 部署</Tag>;
    case 'crash':
      return <Tag color="red">崩溃自愈</Tag>;
    case 'overuse':
      return <Tag color="orange">超载重启</Tag>;
    default:
      return <Tag>{src}</Tag>;
  }
};

interface LogLevelBadgeProps {
  level: LogLevel | string;
}

export const LogLevelBadge: React.FC<LogLevelBadgeProps> = ({ level }) => {
  const l = level.toLowerCase();
  switch (l) {
    case 'debug':
      return <Tag color="default">DEBUG</Tag>;
    case 'info':
      return <Tag color="blue">INFO</Tag>;
    case 'warn':
      return <Tag color="gold">WARN</Tag>;
    case 'error':
      return <Tag color="error">ERROR</Tag>;
    case 'fatal':
    case 'dpanic':
      return <Tag color="magenta">{l.toUpperCase()}</Tag>;
    default:
      return <Tag>{l.toUpperCase()}</Tag>;
  }
};
