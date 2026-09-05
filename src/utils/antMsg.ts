import { App as AntdApp, message as staticMessage } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

let appMessage: MessageInstance = staticMessage;

export const setAppMessage = (msg: MessageInstance) => {
  appMessage = msg;
};

export const message = {
  success: (...args: Parameters<MessageInstance['success']>) => appMessage.success(...args),
  error: (...args: Parameters<MessageInstance['error']>) => appMessage.error(...args),
  info: (...args: Parameters<MessageInstance['info']>) => appMessage.info(...args),
  warning: (...args: Parameters<MessageInstance['warning']>) => appMessage.warning(...args),
  loading: (...args: Parameters<MessageInstance['loading']>) => appMessage.loading(...args),
};

export const AntdAppBridge: React.FC = () => {
  const { message: ctxMsg } = AntdApp.useApp();
  setAppMessage(ctxMsg);
  return null;
};
