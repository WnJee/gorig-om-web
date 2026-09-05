import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert } from 'antd';
import { message } from '../../utils/antMsg';
import { LockOutlined, CloudServerOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { authApi } from '../../api/auth';

const { Title, Text } = Typography;

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();
  const { serverUrl, setServerUrl, setToken } = useAuthStore();

  const handleLogin = async (values: { serverUrl?: string; omKey: string }) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (values.serverUrl !== undefined) {
        setServerUrl(values.serverUrl);
      }
      const token = await authApi.connect(values.omKey);
      setToken(token);
      message.success('连接成功，已进入管理面板');
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || '连接失败，请检查 om.key 与目标地址是否正确');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white text-2xl font-black mb-3 shadow-lg shadow-indigo-500/30">
            G
          </div>
          <Title level={2} className="!text-white !mb-1 tracking-tight">
            Gorig-OM 控制台
          </Title>
          <Text className="text-indigo-200 text-sm">
            Gorig 框架运维监控与服务治理管理系统
          </Text>
        </div>

        <Card className="shadow-2xl border-0 rounded-2xl backdrop-blur bg-white/95 dark:bg-slate-900/90 p-2">
          {errorMsg && (
            <Alert
              message={errorMsg}
              type="error"
              showIcon
              closable
              onClose={() => setErrorMsg(null)}
              className="mb-4"
            />
          )}

          <Form
            layout="vertical"
            initialValues={{ serverUrl, omKey: '' }}
            onFinish={handleLogin}
            size="large"
          >
            <Form.Item
              name="serverUrl"
              label={<span className="text-xs font-semibold text-gray-700 dark:text-gray-300">目标服务地址 (可选)</span>}
              tooltip="若留空，默认使用当前站点或本地域名代理（http://127.0.0.1:9617）"
            >
              <Input
                prefix={<CloudServerOutlined className="text-gray-400" />}
                placeholder="例如: http://127.0.0.1:9617"
                allowClear
              />
            </Form.Item>

            <Form.Item
              name="omKey"
              label={<span className="text-xs font-semibold text-gray-700 dark:text-gray-300">访问口令 (om.key)</span>}
              rules={[{ required: true, message: '请输入宿主服务配置的 om.key' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="输入服务配置文件中的 om.key"
              />
            </Form.Item>

            <div className="mb-6 p-3 rounded-lg bg-indigo-50/60 dark:bg-slate-800 text-xs text-indigo-900/70 dark:text-indigo-300 flex items-start space-x-2">
              <SafetyCertificateOutlined className="mt-0.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <span>
                认证通过客户端实时生成 10 秒时间窗加盐 bcrypt 哈希发送验证，防止网络窃听与重放攻击。
              </span>
            </div>

            <Form.Item className="mb-2">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                className="h-11 bg-indigo-600 hover:bg-indigo-500 font-semibold text-base shadow-md shadow-indigo-600/20"
              >
                {loading ? '正在验证连接...' : '连接并进入控制台'}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <div className="text-center mt-6 text-xs text-slate-400">
          基于 Gorig-OM 原生 REST API 驱动 · 安全 · 高性能
        </div>
      </div>
    </div>
  );
};
