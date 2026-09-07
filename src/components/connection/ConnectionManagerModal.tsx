import React, { useState, useEffect } from "react";
import {
  Modal,
  Table,
  Button,
  Tag,
  Space,
  Form,
  Input,
  Popconfirm,
  Badge,
  Tooltip,
  Alert,
} from "antd";
import {
  ApiOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  KeyOutlined,
  SwapOutlined,
  CloseOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import { useAuthStore, ServiceConnection } from "../../stores/useAuthStore";
import { message } from "../../utils/antMsg";

interface ConnectionManagerModalProps {
  open: boolean;
  onClose: () => void;
}

export const ConnectionManagerModal: React.FC<ConnectionManagerModalProps> = ({
  open,
  onClose,
}) => {
  const {
    connections,
    activeId,
    switchConnection,
    addConnection,
    updateConnection,
    deleteConnection,
    testConnection,
  } = useAuthStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<ServiceConnection | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg?: string } | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const [form] = Form.useForm();

  // When opened with 0 connections, reset form to default values
  useEffect(() => {
    if (open && connections.length === 0) {
      setTestResult(null);
      setEditingConn(null);
      form.setFieldsValue({
        name: "本地服务",
        serverUrl: "http://127.0.0.1:9617",
        omKey: "",
      });
    }
  }, [open, connections.length, form]);

  // Open add form
  const handleOpenAdd = () => {
    setEditingConn(null);
    setTestResult(null);
    setFormOpen(true);
    setTimeout(() => {
      form.resetFields();
      form.setFieldsValue({
        name: "",
        serverUrl: "http://127.0.0.1:9617",
        omKey: "",
      });
    }, 0);
  };

  // Open edit form
  const handleOpenEdit = (record: ServiceConnection) => {
    setEditingConn(record);
    setTestResult(null);
    setFormOpen(true);
    setTimeout(() => {
      form.resetFields();
      form.setFieldsValue({
        name: record.name,
        serverUrl: record.serverUrl,
        omKey: record.omKey,
      });
    }, 0);
  };

  // Switch connection
  const handleSwitch = async (id: string) => {
    setSwitchingId(id);
    try {
      const ok = await switchConnection(id);
      if (ok) {
        message.success("已成功切换并连接至目标服务");
      } else {
        message.error("连接至目标服务失败，请检查服务地址与密钥");
      }
    } finally {
      setSwitchingId(null);
    }
  };

  // Delete connection
  const handleDelete = async (id: string) => {
    try {
      await deleteConnection(id);
      message.success("已删除该服务连接");
    } catch (err: any) {
      message.error(err.message || "删除失败");
    }
  };

  // Test connection in form
  const handleTestInForm = async () => {
    try {
      const omKey = form.getFieldValue("omKey");
      if (!omKey || !omKey.trim()) {
        message.warning("请先输入服务访问秘钥 (om.key)");
        return;
      }
      const serverUrl = form.getFieldValue("serverUrl");
      setTestLoading(true);
      setTestResult(null);
      const res = await testConnection(serverUrl || "", omKey.trim());
      setTestResult(res);
      if (res.success) {
        message.success("连接测试成功！服务端验证正常通过");
      } else {
        message.error(res.msg || "连接测试失败");
      }
    } catch (err: any) {
      message.error(err?.message || "连接测试失败");
    } finally {
      setTestLoading(false);
    }
  };

  // Submit add or edit
  const handleSaveForm = async (andSwitch = true) => {
    try {
      const values = await form.validateFields();
      if (editingConn) {
        await updateConnection(editingConn.id, values);
        message.success("已更新服务配置");
      } else {
        await addConnection(values, andSwitch);
        message.success("已添加并连接新服务");
      }
      setFormOpen(false);
    } catch {
      // Form validation error
    }
  };

  const columns = [
    {
      title: "服务名称",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: ServiceConnection) => {
        const isActive = record.id === activeId;
        return (
          <div className="min-w-[220px]">
            <div className="flex items-center space-x-2 whitespace-nowrap">
              <span className="font-semibold text-gray-900 dark:text-white text-sm whitespace-nowrap">
                {name}
              </span>
              {isActive && (
                <Tag color="success" icon={<CheckCircleOutlined />} className="!m-0 whitespace-nowrap">
                  当前使用
                </Tag>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center">
              <LinkOutlined className="mr-1 text-[11px] flex-shrink-0" />
              <span className="truncate font-mono">{record.serverUrl || "本地代理 (同源)"}</span>
            </div>
          </div>
        );
      },
    },
    {
      title: "连接状态",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: ServiceConnection["status"], record: ServiceConnection) => {
        if (status === "connected") {
          return <Badge status="success" text={<span className="text-emerald-600 font-medium whitespace-nowrap">正常运行</span>} />;
        }
        if (status === "connecting") {
          return <Badge status="processing" text={<span className="text-blue-500 whitespace-nowrap">连接中...</span>} />;
        }
        if (status === "failed") {
          return (
            <Tooltip title={record.errorMsg || "认证或网络错误"}>
              <Badge status="error" text={<span className="text-rose-600 cursor-pointer whitespace-nowrap">连接失败</span>} />
            </Tooltip>
          );
        }
        return <Badge status="default" text={<span className="text-gray-400 whitespace-nowrap">未连接</span>} />;
      },
    },
    {
      title: "访问密钥",
      dataIndex: "omKey",
      key: "omKey",
      width: 120,
      render: (key: string) => (
        <span className="font-mono text-xs text-gray-500 whitespace-nowrap">
          <KeyOutlined className="mr-1 text-gray-400" />
          {key ? key.substring(0, 3) + "****" : "-"}
        </span>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 270,
      render: (_: any, record: ServiceConnection) => {
        const isActive = record.id === activeId;
        return (
          <Space size="small">
            {!isActive && (
              <Button
                type="primary"
                size="middle"
                icon={<SwapOutlined />}
                loading={switchingId === record.id}
                onClick={() => handleSwitch(record.id)}
                className="rounded-lg text-xs font-medium"
              >
                切换连接
              </Button>
            )}

            <Button
              size="middle"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
              className="rounded-lg text-xs font-medium"
            >
              编辑
            </Button>

            <Popconfirm
              title="确定删除此服务连接吗？"
              description={connections.length === 1 ? "删除后系统将无任何服务连接，需重新添加。" : "删除后将无法通过此快捷配置连接该节点。"}
              onConfirm={() => handleDelete(record.id)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                danger
                size="middle"
                icon={<DeleteOutlined />}
                className="rounded-lg text-xs font-medium"
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  // If no connections are configured at all, directly show the Add Connection modal
  if (connections.length === 0) {
    return (
      <Modal
        title={
          <div className="flex items-center space-x-2 text-base">
            <ApiOutlined className="text-indigo-600" />
            <span>添加新服务连接</span>
          </div>
        }
        open={open}
        onCancel={onClose}
        width={520}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          className="pt-2"
          initialValues={{
            name: "本地服务",
            serverUrl: "http://127.0.0.1:9617",
            omKey: "",
          }}
          onFinish={() => handleSaveForm(true)}
        >
          <div className="mb-4 p-3 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-xl border border-indigo-100/80 dark:border-indigo-900/50 text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
            当前尚未配置任何后端服务节点。请配置并连接一个 Gorig-OM 服务节点以开启监控与管理控制台。
          </div>

          <Form.Item
            name="name"
            label="服务名称 / 节点备注"
            rules={[{ required: true, message: "请输入服务名称" }]}
          >
            <Input placeholder="例如：本地开发服务 / 线上生产节点-01" />
          </Form.Item>

          <Form.Item
            name="serverUrl"
            label="服务接口地址"
            tooltip="输入完整的 HTTP/HTTPS 地址，例如 http://127.0.0.1:9617。若与前端同域或走前端反向代理可留空。"
          >
            <Input
              prefix={<LinkOutlined className="text-gray-400" />}
              placeholder="例如：http://127.0.0.1:9617"
            />
          </Form.Item>

          <Form.Item
            name="omKey"
            label="OM 访问秘钥 (om.key)"
            rules={[{ required: true, message: "请输入服务访问秘钥" }]}
            tooltip="对应服务端 local.yaml 或启动配置中指定的 om.key"
          >
            <Input.Password
              prefix={<KeyOutlined className="text-gray-400" />}
              placeholder="例如：test123456"
            />
          </Form.Item>

          {testResult && (
            <Alert
              type={testResult.success ? "success" : "error"}
              message={testResult.success ? "连接测试通过，服务端验证正常" : "连接失败: " + testResult.msg}
              showIcon
              className="mb-4 text-xs"
            />
          )}

          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
            <Button
              icon={<ThunderboltOutlined />}
              loading={testLoading}
              onClick={handleTestInForm}
              size="middle"
              className="rounded-lg"
            >
              测试连通性
            </Button>

            <Space>
              <Button icon={<CloseOutlined />} onClick={onClose} size="middle" className="rounded-lg">
                取消
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                htmlType="submit"
                size="middle"
                className="bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                保存并立即连接
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    );
  }

  return (
    <Modal
      title={
        <div className="flex items-center space-x-2 text-base">
          <ApiOutlined className="text-indigo-600" />
          <span>多服务连接管理与节点切换</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={860}
      footer={null}
      destroyOnHidden
    >
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800/50 px-4 py-3 rounded-xl border border-gray-100 dark:border-slate-800">
          <div>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              已配置 {connections.length} 个节点服务
            </div>
            <div className="text-[11px] text-gray-400">
              点击对应服务的“切换连接”按钮即可直接切换至该服务的监控与管理大盘。
            </div>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="middle"
            onClick={handleOpenAdd}
            className="bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-medium"
          >
            添加新服务
          </Button>
        </div>

        <Table
          dataSource={connections}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="middle"
          className="rounded-xl overflow-hidden border border-gray-100 dark:border-slate-800"
        />

        {/* Add / Edit Sub-Modal */}
        <Modal
          title={editingConn ? "编辑服务连接" : "添加新服务连接"}
          open={formOpen}
          onCancel={() => setFormOpen(false)}
          footer={null}
          width={520}
          destroyOnHidden
        >
          <Form
            form={form}
            layout="vertical"
            className="pt-3"
            onFinish={() => handleSaveForm(true)}
          >
            <Form.Item
              name="name"
              label="服务名称 / 节点备注"
              rules={[{ required: true, message: "请输入服务名称" }]}
            >
              <Input placeholder="例如：线上生产节点-01 / 预发布服务" />
            </Form.Item>

            <Form.Item
              name="serverUrl"
              label="服务接口地址"
              tooltip="输入完整的 HTTP/HTTPS 地址，例如 http://127.0.0.1:9617。若与前端同域或走前端反向代理可留空。"
            >
              <Input
                prefix={<LinkOutlined className="text-gray-400" />}
                placeholder="例如：http://127.0.0.1:9617"
              />
            </Form.Item>

            <Form.Item
              name="omKey"
              label="OM 访问秘钥 (om.key)"
              rules={[{ required: true, message: "请输入服务访问秘钥" }]}
              tooltip="对应服务端 local.yaml 或启动配置中指定的 om.key"
            >
              <Input.Password
                prefix={<KeyOutlined className="text-gray-400" />}
                placeholder="例如：test123456"
              />
            </Form.Item>

            {testResult && (
              <Alert
                type={testResult.success ? "success" : "error"}
                message={testResult.success ? "连接测试通过，服务端验证正常" : "连接失败: " + testResult.msg}
                showIcon
                className="mb-4 text-xs"
              />
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800">
              <Button
                icon={<ThunderboltOutlined />}
                loading={testLoading}
                onClick={handleTestInForm}
                size="middle"
                className="rounded-lg"
              >
                测试连通性
              </Button>

              <Space>
                <Button icon={<CloseOutlined />} onClick={() => setFormOpen(false)} size="middle" className="rounded-lg">
                  取消
                </Button>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  htmlType="submit"
                  size="middle"
                  className="bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  {editingConn ? "保存修改" : "保存并立即连接"}
                </Button>
              </Space>
            </div>
          </Form>
        </Modal>
      </div>
    </Modal>
  );
};
