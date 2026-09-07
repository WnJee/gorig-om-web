import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

import { useAppStore } from './stores/useAppStore';
import { useAuthStore } from './stores/useAuthStore';
import { MainLayout } from './layouts/MainLayout';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { AppManagePage } from './pages/app/AppManagePage';
import { LogsPage } from './pages/logs/LogsPage';
import { ApiStatPage } from './pages/stats/ApiStatPage';
import { ErrorStatPage } from './pages/stats/ErrorStatPage';
import { RuntimeStatPage } from './pages/stats/RuntimeStatPage';
import { DeployPage } from './pages/deploy/DeployPage';
import { DiagPage } from './pages/diag/DiagPage';
import { AlertConfigPage } from './pages/alert/AlertConfigPage';
import { AntdAppBridge } from './utils/antMsg';

dayjs.locale('zh-cn');

export const App: React.FC = () => {
  const { theme } = useAppStore();
  const { init } = useAuthStore();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#6366f1',
          borderRadius: 8,
          fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
        },
      }}
    >
      <AntdApp>
        <AntdAppBridge />
        <HashRouter>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="app" element={<AppManagePage />} />
              <Route path="logs" element={<LogsPage />} />
              <Route path="stats/api" element={<ApiStatPage />} />
              <Route path="stats/error" element={<ErrorStatPage />} />
              <Route path="stats/runtime" element={<RuntimeStatPage />} />
              <Route path="deploy" element={<DeployPage />} />
              <Route path="diag" element={<DiagPage />} />
              <Route path="alert" element={<AlertConfigPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
            <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </HashRouter>
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;
