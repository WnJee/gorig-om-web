import React, { useState } from 'react';
import { Layout, Menu, Button, Space, Select, Tooltip, theme } from 'antd';
import { message } from '../utils/antMsg';
import {
  DashboardOutlined,
  FileTextOutlined,
  CloudUploadOutlined,
  ReloadOutlined,
  BulbOutlined,
  BulbFilled,
  ApiOutlined,
  CheckCircleFilled,
  ExclamationCircleFilled,
  LoadingOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useAppStore } from '../stores/useAppStore';
import { ConnectionManagerModal } from '../components/connection/ConnectionManagerModal';

const { Header, Sider, Content } = Layout;

export const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [connModalOpen, setConnModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const { connections, activeId, switchConnection, getActiveConnection } = useAuthStore();
  const activeConn = getActiveConnection();
  const { theme: appTheme, toggleTheme } = useAppStore();

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '概览',
    },
    {
      key: '/logs',
      icon: <FileTextOutlined />,
      label: '日志',
    },
    {
      key: '/deploy',
      icon: <CloudUploadOutlined />,
      label: '部署',
    },
  ];

  const handleManualRefresh = () => {
    setRefreshLoading(true);
    window.dispatchEvent(new CustomEvent('gorig_manual_refresh'));
    message.success('已刷新最新监控数据');
    setTimeout(() => setRefreshLoading(false), 500);
  };

  // If no connections configured, auto pop up the add connection modal
  React.useEffect(() => {
    if (connections.length === 0) {
      setConnModalOpen(true);
    }
  }, [connections.length]);

  // Global listener to open connection modal
  React.useEffect(() => {
    const handleOpen = () => setConnModalOpen(true);
    window.addEventListener('gorig_open_connection_modal', handleOpen);
    return () => window.removeEventListener('gorig_open_connection_modal', handleOpen);
  }, []);

  return (
    <Layout className="min-h-screen">
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        theme={appTheme === 'dark' ? 'dark' : 'light'}
        className="border-r border-gray-100 dark:border-slate-800 shadow-sm z-10"
        width={220}
      >
        <div className="h-16 flex items-center px-4 space-x-3 border-b border-gray-100 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            G
          </div>
          {!collapsed && (
            <div className="overflow-hidden whitespace-nowrap">
              <div className="font-bold text-base text-gray-800 dark:text-white leading-tight">
                Gorig-OM
              </div>
              <div className="text-[11px] text-gray-400">运维管理控制台</div>
            </div>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="mt-2 border-r-0"
        />
      </Sider>

      <Layout>
        <Header
          style={{ background: colorBgContainer }}
          className="h-14 px-5 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 shadow-sm"
        >
          {/* Left: Multi-service Connection Switcher */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs text-gray-400 font-medium hidden sm:inline">服务连接:</span>
              <Select
                size="small"
                value={connections.length > 0 && activeId ? activeId : undefined}
                placeholder="未配置服务"
                onChange={(val) => switchConnection(val)}
                className="w-56 text-xs"
                popupMatchSelectWidth={false}
                notFoundContent={<div className="p-2 text-xs text-gray-400 text-center">暂无可用连接</div>}
                options={connections.map((c) => ({
                  value: c.id,
                  label: (
                    <div className="flex items-center justify-between space-x-3 py-0.5">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            c.status === 'connected'
                              ? 'bg-emerald-500'
                              : c.status === 'connecting'
                              ? 'bg-blue-500 animate-pulse'
                              : c.status === 'failed'
                              ? 'bg-rose-500'
                              : 'bg-gray-300'
                          }`}
                        />
                        <span className="font-medium text-xs text-gray-800 dark:text-gray-200">
                          {c.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400 font-mono">
                        {c.serverUrl || '本地代理'}
                      </span>
                    </div>
                  ),
                }))}
              />
            </div>

            {/* Connection Status Indicator */}
            {connections.length === 0 ? (
              <span className="inline-flex items-center text-xs font-medium text-gray-400">
                未配置服务
              </span>
            ) : activeConn?.status === 'connected' ? (
              <span className="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircleFilled className="mr-1 text-emerald-500 text-sm" />
                已连通
              </span>
            ) : activeConn?.status === 'connecting' ? (
              <span className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400">
                <LoadingOutlined className="mr-1 text-blue-500 text-sm" />
                连接中
              </span>
            ) : activeConn?.status === 'failed' ? (
              <Tooltip title={activeConn.errorMsg || '无法连接该节点服务，请检查地址与秘钥'}>
                <span className="inline-flex items-center text-xs font-medium text-rose-600 dark:text-rose-400 cursor-pointer">
                  <ExclamationCircleFilled className="mr-1 text-rose-500 text-sm" />
                  连接失败
                </span>
              </Tooltip>
            ) : (
              <span className="inline-flex items-center text-xs font-medium text-gray-400">
                未连接
              </span>
            )}

            <Button
              size="small"
              icon={<ApiOutlined />}
              onClick={() => setConnModalOpen(true)}
              className="text-xs font-medium rounded-md"
            >
              服务管理
            </Button>
          </div>

          {/* Right: Only Manual Refresh & Theme Switch */}
          <Space size="middle">
            <Tooltip title="手动重新加载最新指标数据">
              <Button
                type="default"
                size="small"
                icon={<ReloadOutlined spin={refreshLoading} />}
                loading={refreshLoading}
                onClick={handleManualRefresh}
                className="text-xs font-medium rounded-md text-gray-600 dark:text-gray-300"
              >
                刷新数据
              </Button>
            </Tooltip>

            <Tooltip title={appTheme === 'dark' ? '切换亮色模式' : '切换暗色模式'}>
              <Button
                type="text"
                size="middle"
                icon={appTheme === 'dark' ? <BulbFilled className="text-amber-400" /> : <BulbOutlined />}
                onClick={toggleTheme}
              />
            </Tooltip>
          </Space>
        </Header>

        <Content
          style={{
            margin: '12px 14px',
            minHeight: 280,
            borderRadius: borderRadiusLG,
          }}
          className="custom-scrollbar"
        >
          <Outlet />
        </Content>

        {/* Connection Manager Modal */}
        <ConnectionManagerModal
          open={connModalOpen}
          onClose={() => setConnModalOpen(false)}
        />
      </Layout>
    </Layout>
  );
};
