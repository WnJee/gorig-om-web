import { App as AntdApp, message as staticMessage } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

let appMessage: MessageInstance = staticMessage;

export const setAppMessage = (msg: MessageInstance) => {
  appMessage = msg;
};

// Deduplication map to prevent double-firing identical toasts within 1200ms
const recentMessages = new Map<string, number>();

const shouldShow = (type: string, args: any[]): boolean => {
  const first = args[0];
  const content =
    typeof first === 'string'
      ? first
      : first && typeof first === 'object' && first.content
      ? first.content
      : JSON.stringify(first);

  if (!content) return true;

  const key = `${type}:${content}`;
  const now = Date.now();
  const lastTime = recentMessages.get(key) || 0;
  if (now - lastTime < 1200) {
    return false;
  }
  recentMessages.set(key, now);

  // Periodic cleanup
  if (recentMessages.size > 50) {
    for (const [k, v] of recentMessages.entries()) {
      if (now - v > 3000) recentMessages.delete(k);
    }
  }
  return true;
};

export const message = {
  success: (...args: Parameters<MessageInstance['success']>) => {
    if (shouldShow('success', args)) return appMessage.success(...args);
    return Promise.resolve(null as any);
  },
  error: (...args: Parameters<MessageInstance['error']>) => {
    if (shouldShow('error', args)) return appMessage.error(...args);
    return Promise.resolve(null as any);
  },
  info: (...args: Parameters<MessageInstance['info']>) => {
    if (shouldShow('info', args)) return appMessage.info(...args);
    return Promise.resolve(null as any);
  },
  warning: (...args: Parameters<MessageInstance['warning']>) => {
    if (shouldShow('warning', args)) return appMessage.warning(...args);
    return Promise.resolve(null as any);
  },
  loading: (...args: Parameters<MessageInstance['loading']>) => appMessage.loading(...args),
};

export const AntdAppBridge: React.FC = () => {
  const { message: ctxMsg } = AntdApp.useApp();
  setAppMessage(ctxMsg);
  return null;
};
