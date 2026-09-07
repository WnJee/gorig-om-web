import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Slider,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Alert,
  Divider,
  Tooltip,
} from 'antd';
import {
  BellOutlined,
  SendOutlined,
  SaveOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  SlidersOutlined,
} from '@ant-design/icons';
import { alertApi } from '../../api/alert';
import { AlertConfig } from '../../types';
import { message } from '../../utils/antMsg';
import { PageHeader } from '../../components/PageHeader';

const { Text } = Typography;

const channelOptions = [
  {
    value: 'feishu',
    label: (
      <div className="flex items-center space-x-2">
        <span className="w-2 h-2 rounded-full bg-blue-500" />
        <span>飞书机器人 (Feishu)</span>
      </div>
    ),
  },
  {
    value: 'dingtalk',
    label: (
      <div className="flex items-center space-x-2">
        <span className="w-2 h-2 rounded-full bg-cyan-500" />
        <span>钉钉自定义机器人 (DingTalk)</span>
      </div>
    ),
  },
  {
    value: 'wecom',
    label: (
      <div className="flex items-center space-x-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span>企业微信机器人 (WeCom)</span>
      </div>
    ),
  },
  {
    value: 'generic',
    label: (
      <div className="flex items-center space-x-2">
        <span className="w-2 h-2 rounded-full bg-purple-500" />
        <span>通用 Webhook (Generic JSON)</span>
      </div>
    ),
  },
];

export const AlertConfigPage: React.FC = () => {
  const [form] = Form.useForm<AlertConfig>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await alertApi.getConfig();
      if (cfg) {
        form.setFieldsValue({
          enabled: cfg.enabled ?? false,
          channel: cfg.channel || 'feishu',
          webhookUrl: cfg.webhookUrl || '',
          secret: cfg.secret || '',
          cooldownMin: cfg.cooldownMin ?? 10,
          cpuThreshold: cfg.cpuThreshold ?? 85,
          memThreshold: cfg.memThreshold ?? 85,
          diskThreshold: cfg.diskThreshold ?? 90,
          goroutineThreshold: cfg.goroutineThreshold ?? 5000,
          notifyOnCrash: cfg.notifyOnCrash ?? true,
          notifyOnDeployFail: cfg.notifyOnDeployFail ?? true,
          notifyOnMemLeak: cfg.notifyOnMemLeak ?? true,
        });
      }
    } catch (err: any) {
      message.error(err.message || '获取告警配置失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await alertApi.saveConfig(values);
      message.success('告警配置已成功保存并即时生效');
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '保存告警配置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await alertApi.testSend();
      message.success('测试告警消息已发出，请前往对应群聊或接收端查看');
    } catch (err: any) {
      message.error(err.message || '发送测试告警失败，请检查 Webhook 地址与通道设置');
    } finally {
      setTesting(false);
    }
  };

  const currentChannel = Form.useWatch('channel', form);
  const isEnabled = Form.useWatch('enabled', form);

  return (
    <div className="space-y-3 pb-4">
      {/* 1. Unified Page Header */}
      <PageHeader
        icon={<BellOutlined />}
        title="Webhook 告警配置"
        description="支持飞书、钉钉、企业微信机器人及通用 Webhook，自动监测指标越限与异常事件"
        extra={
          <Space size="middle">
            <Button
              size="middle"
              icon={<ReloadOutlined spin={loading} className="text-base" />}
              onClick={fetchConfig}
              className="text-sm font-medium rounded-lg h-9 px-4"
            >
              刷新
            </Button>
            <Button
              size="middle"
              icon={<SendOutlined className="text-base" />}
              loading={testing}
              onClick={handleTest}
              className="text-sm font-medium rounded-lg h-9 px-4 border-amber-400 text-amber-600 dark:text-amber-400 hover:!border-amber-500 hover:!text-amber-500"
            >
              发送测试消息
            </Button>
            <Button
              type="primary"
              size="middle"
              icon={<SaveOutlined className="text-base" />}
              loading={saving}
              onClick={handleSave}
              className="bg-indigo-600 hover:!bg-indigo-700 text-sm font-medium rounded-lg h-9 px-4"
            >
              保存配置
            </Button>
          </Space>
        }
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          enabled: false,
          channel: 'feishu',
          cooldownMin: 10,
          cpuThreshold: 85,
          memThreshold: 85,
          diskThreshold: 90,
          goroutineThreshold: 5000,
          notifyOnCrash: true,
          notifyOnDeployFail: true,
          notifyOnMemLeak: true,
        }}
      >
        <Row gutter={[12, 12]}>
          {/* Channel & Webhook Settings */}
          <Col xs={24} lg={14}>
            <Card
              className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 h-full"
              title={
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                    <SafetyCertificateOutlined className="text-indigo-500" />
                    <span>推送通道与鉴权</span>
                  </div>
                  <Form.Item name="enabled" valuePropName="checked" noStyle>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500 font-normal">告警总开关:</span>
                      <Switch checkedChildren="已启用" unCheckedChildren="已关闭" />
                    </div>
                  </Form.Item>
                </div>
              }
            >
              {!isEnabled && (
                <Alert
                  type="info"
                  showIcon
                  className="mb-4 text-xs"
                  message="当前告警总开关已关闭，保存后系统将跳过事件告警和指标超限推送。"
                />
              )}

              <Form.Item
                name="channel"
                label={<span className="text-xs font-medium text-gray-700 dark:text-gray-300">告警通道 (Channel)</span>}
                rules={[{ required: true, message: '请选择告警推送通道' }]}
              >
                <Select options={channelOptions} className="w-full" size="middle" />
              </Form.Item>

              <Form.Item
                name="webhookUrl"
                label={
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Webhook 机器人地址</span>
                    <Text type="secondary" className="text-[11px]">需包含完整 http(s):// 前缀</Text>
                  </div>
                }
                rules={[
                  {
                    validator: async (_, value) => {
                      if (form.getFieldValue('enabled') && !value) {
                        return Promise.reject(new Error('启用告警时 Webhook 地址不能为空'));
                      }
                      if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
                        return Promise.reject(new Error('Webhook 地址必须以 http:// 或 https:// 开头'));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Input
                  placeholder={
                    currentChannel === 'feishu'
                      ? 'https://open.feishu.cn/open-apis/bot/v2/hook/...'
                      : currentChannel === 'dingtalk'
                      ? 'https://oapi.dingtalk.com/robot/send?access_token=...'
                      : currentChannel === 'wecom'
                      ? 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...'
                      : 'https://your-domain.com/webhook/alerts'
                  }
                  allowClear
                />
              </Form.Item>

              <Form.Item
                name="secret"
                label={
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">安全加签密钥 (Secret)</span>
                    <Text type="secondary" className="text-[11px]">可选：钉钉/飞书签名校验</Text>
                  </div>
                }
                extra={
                  <span className="text-[11px] text-gray-400">
                    如在钉钉机器人开启了「加签」安全设置或飞书机器人配置了「签名校验」，请在此填入 Secret。
                  </span>
                }
              >
                <Input.Password placeholder="SEC... 或飞书自定义 Secret 密钥 (留空则不进行签名)" />
              </Form.Item>

              <Form.Item
                name="cooldownMin"
                label={
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">抑制冷却时长 (Cooldown)</span>
                    <Tooltip title="同一种类型的告警在此时间窗口内最多推送一次，避免故障发生时连续刷屏">
                      <InfoCircleOutlined className="text-gray-400 text-xs" />
                    </Tooltip>
                  </div>
                }
                rules={[{ required: true, message: '请配置冷却时间' }]}
              >
                <InputNumber
                  min={1}
                  max={1440}
                  addonAfter="分钟"
                  className="w-48"
                />
              </Form.Item>

              <div className="mt-4 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-lg text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <div className="font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-1.5">
                  <InfoCircleOutlined className="text-indigo-500" />
                  <span>通道提示说明</span>
                </div>
                <div>• <strong>飞书</strong>: 发送高颜值富文本卡片 (包含标题、告警等级色块与关键明细)。</div>
                <div>• <strong>钉钉</strong>: 发送 Markdown 消息，支持 Secret 加签防篡改。</div>
                <div>• <strong>企业微信</strong>: 发送 Markdown 格式通知卡片。</div>
                <div>• <strong>通用 Webhook</strong>: 发送标准 JSON Payload，方便对接自建网关或报警服务。</div>
              </div>
            </Card>
          </Col>

          {/* Thresholds & Event Switches */}
          <Col xs={24} lg={10}>
            <div className="space-y-3">
              <Card
                className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800"
                title={
                  <div className="flex items-center space-x-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                    <SlidersOutlined className="text-indigo-500" />
                    <span>指标越限告警阈值</span>
                  </div>
                }
              >
                {/* CPU */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">CPU 使用率告警</span>
                    <Form.Item name="cpuThreshold" noStyle>
                      <InputNumber<number> min={50} max={100} addonAfter="%" size="small" className="w-24" />
                    </Form.Item>
                  </div>
                  <Form.Item name="cpuThreshold" noStyle>
                    <Slider min={50} max={100} marks={{ 50: '50%', 80: '80%', 90: '90%', 100: '100%' }} />
                  </Form.Item>
                </div>

                {/* Memory */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">内存使用率告警</span>
                    <Form.Item name="memThreshold" noStyle>
                      <InputNumber<number> min={50} max={100} addonAfter="%" size="small" className="w-24" />
                    </Form.Item>
                  </div>
                  <Form.Item name="memThreshold" noStyle>
                    <Slider min={50} max={100} marks={{ 50: '50%', 80: '80%', 90: '90%', 100: '100%' }} />
                  </Form.Item>
                </div>

                {/* Disk */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">磁盘空间使用率告警</span>
                    <Form.Item name="diskThreshold" noStyle>
                      <InputNumber<number> min={50} max={100} addonAfter="%" size="small" className="w-24" />
                    </Form.Item>
                  </div>
                  <Form.Item name="diskThreshold" noStyle>
                    <Slider min={50} max={100} marks={{ 50: '50%', 80: '80%', 90: '90%', 100: '100%' }} />
                  </Form.Item>
                </div>

                {/* Goroutine */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">Goroutine 数量阈值</span>
                    <Form.Item name="goroutineThreshold" noStyle>
                      <InputNumber min={100} max={100000} step={500} size="small" className="w-24" />
                    </Form.Item>
                  </div>
                  <Form.Item name="goroutineThreshold" noStyle>
                    <Slider min={500} max={20000} step={500} marks={{ 500: '500', 5000: '5k', 10000: '10k', 20000: '20k' }} />
                  </Form.Item>
                </div>
              </Card>

              {/* Event Switches */}
              <Card
                className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800"
                title={
                  <div className="flex items-center space-x-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                    <ThunderboltOutlined className="text-amber-500" />
                    <span>系统与事件告警开关</span>
                  </div>
                }
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <div className="text-xs font-medium text-gray-800 dark:text-gray-200">
                        应用崩溃 / 异常退出 (Crash & Panic)
                      </div>
                      <div className="text-[11px] text-gray-400">
                        捕获程序 Panic 崩溃及守护进程自愈拉起事件
                      </div>
                    </div>
                    <Form.Item name="notifyOnCrash" valuePropName="checked" noStyle>
                      <Switch size="small" />
                    </Form.Item>
                  </div>

                  <Divider className="!my-2" />

                  <div className="flex items-center justify-between py-1">
                    <div>
                      <div className="text-xs font-medium text-gray-800 dark:text-gray-200">
                        发布构建失败与自动回滚
                      </div>
                      <div className="text-[11px] text-gray-400">
                        部署构建失败或健康探针检测不通过触发回滚时告警
                      </div>
                    </div>
                    <Form.Item name="notifyOnDeployFail" valuePropName="checked" noStyle>
                      <Switch size="small" />
                    </Form.Item>
                  </div>

                  <Divider className="!my-2" />

                  <div className="flex items-center justify-between py-1">
                    <div>
                      <div className="text-xs font-medium text-gray-800 dark:text-gray-200">
                        内存持续增长 / 疑似泄漏预警
                      </div>
                      <div className="text-[11px] text-gray-400">
                        内存连续多轮增长且达到分析阈值时推送快照诊断
                      </div>
                    </div>
                    <Form.Item name="notifyOnMemLeak" valuePropName="checked" noStyle>
                      <Switch size="small" />
                    </Form.Item>
                  </div>
                </div>
              </Card>
            </div>
          </Col>
        </Row>
      </Form>
    </div>
  );
};
