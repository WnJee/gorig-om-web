import { create } from 'zustand';
import { authApi } from '../api/auth';

export interface ServiceConnection {
  id: string;
  name: string;
  serverUrl: string; // e.g. "http://127.0.0.1:9617" or ""
  omKey: string;
  status: 'connected' | 'connecting' | 'failed' | 'disconnected';
  lastConnectedAt?: number;
  errorMsg?: string;
}

interface AuthState {
  connections: ServiceConnection[];
  activeId: string;

  // Backwards compatibility for apiClient and current page
  serverUrl: string;
  token: string | null;
  isConnected: boolean;
  connecting: boolean;

  // Getters & Actions
  getActiveConnection: () => ServiceConnection | null;
  init: () => Promise<void>;
  switchConnection: (id: string) => Promise<boolean>;
  addConnection: (
    conn: { name: string; serverUrl: string; omKey: string },
    andSwitch?: boolean
  ) => Promise<boolean>;
  updateConnection: (
    id: string,
    conn: Partial<{ name: string; serverUrl: string; omKey: string }>
  ) => Promise<boolean>;
  deleteConnection: (id: string) => Promise<void>;
  testConnection: (serverUrl: string, omKey: string) => Promise<{ success: boolean; msg?: string }>;
  reconnectActive: () => Promise<boolean>;

  setServerUrl: (url: string) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

const STORAGE_CONNECTIONS_KEY = 'gorig_om_connections_v2';
const STORAGE_ACTIVE_ID_KEY = 'gorig_om_active_id';
const STORAGE_TOKEN_KEY = 'gorig_om_token';

let inFlightConnectPromise: Promise<boolean> | null = null;

const loadSavedConnections = (): ServiceConnection[] => {
  try {
    const raw = localStorage.getItem(STORAGE_CONNECTIONS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((c) => ({
          ...c,
          status: 'disconnected',
        }));
      }
    }
  } catch (e) {
    console.error('Failed to load saved connections', e);
  }
  return [];
};

const loadSavedActiveId = (connections: ServiceConnection[]): string => {
  if (!connections || connections.length === 0) {
    return '';
  }
  try {
    const saved = localStorage.getItem(STORAGE_ACTIVE_ID_KEY);
    if (saved && connections.some((c) => c.id === saved)) {
      return saved;
    }
  } catch (e) {
    console.error('Failed to load saved active connection ID', e);
  }
  return connections[0]?.id || '';
};

const saveConnections = (connections: ServiceConnection[]) => {
  try {
    const toSave = connections.map(({ id, name, serverUrl, omKey, lastConnectedAt }) => ({
      id,
      name,
      serverUrl,
      omKey,
      lastConnectedAt,
    }));
    localStorage.setItem(STORAGE_CONNECTIONS_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('Failed to persist connections', e);
  }
};

const saveActiveId = (activeId: string) => {
  try {
    localStorage.setItem(STORAGE_ACTIVE_ID_KEY, activeId);
  } catch (e) {
    console.error('Failed to persist active connection ID', e);
  }
};

export const useAuthStore = create<AuthState>((set, get) => {
  const initialConnections = loadSavedConnections();
  const initialActiveId = loadSavedActiveId(initialConnections);
  const activeConn = initialConnections.find((c) => c.id === initialActiveId) || initialConnections[0];

  const initialToken = (() => {
    try {
      return (
        localStorage.getItem(`${STORAGE_TOKEN_KEY}_${initialActiveId}`) ||
        localStorage.getItem(STORAGE_TOKEN_KEY) ||
        null
      );
    } catch {
      return null;
    }
  })();

  return {
    connections: initialConnections,
    activeId: initialActiveId,
    serverUrl: activeConn ? activeConn.serverUrl : '',
    token: initialToken,
    isConnected: !!initialToken,
    connecting: false,

    getActiveConnection: () => {
      const { connections, activeId } = get();
      return connections.find((c) => c.id === activeId) || null;
    },

    init: async () => {
      const active = get().getActiveConnection();
      if (!active) return;
      await get().reconnectActive();
    },

    switchConnection: async (id: string) => {
      const { connections } = get();
      const target = connections.find((c) => c.id === id);
      if (!target) return false;

      set((state) => ({
        connecting: true,
        activeId: id,
        serverUrl: target.serverUrl,
        connections: state.connections.map((c) =>
          c.id === id ? { ...c, status: 'connecting', errorMsg: undefined } : c
        ),
      }));
      saveActiveId(id);

      try {
        const token = await authApi.connect(target.omKey, target.serverUrl);
        const now = Date.now();

        try {
          localStorage.setItem(STORAGE_TOKEN_KEY, token);
          localStorage.setItem(`${STORAGE_TOKEN_KEY}_${id}`, token);
        } catch {}

        set((state) => ({
          token,
          isConnected: true,
          connecting: false,
          serverUrl: target.serverUrl,
          connections: state.connections.map((c) =>
            c.id === id
              ? { ...c, status: 'connected', lastConnectedAt: now, errorMsg: undefined }
              : c
          ),
        }));
        saveConnections(get().connections);

        // Notify subscribers (like DashboardPage) that the active service changed
        window.dispatchEvent(new CustomEvent('gorig_service_switched', { detail: { id, target } }));
        return true;
      } catch (err: any) {
        const errorMsg = err.message || '连接服务器失败';
        try {
          localStorage.removeItem(STORAGE_TOKEN_KEY);
          localStorage.removeItem(`${STORAGE_TOKEN_KEY}_${id}`);
        } catch {}

        set((state) => ({
          token: null,
          isConnected: false,
          connecting: false,
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, status: 'failed', errorMsg } : c
          ),
        }));
        return false;
      }
    },

    reconnectActive: async () => {
      if (inFlightConnectPromise) {
        return inFlightConnectPromise;
      }
      const active = get().getActiveConnection();
      if (!active) return false;

      inFlightConnectPromise = (async () => {
        try {
          return await get().switchConnection(active.id);
        } finally {
          inFlightConnectPromise = null;
        }
      })();
      return inFlightConnectPromise;
    },

    addConnection: async (
      conn: { name: string; serverUrl: string; omKey: string },
      andSwitch = true
    ) => {
      const newId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const cleanUrl = conn.serverUrl.trim().replace(/\/+$/, '');
      const newConnection: ServiceConnection = {
        id: newId,
        name: conn.name.trim() || '未命名服务',
        serverUrl: cleanUrl,
        omKey: conn.omKey.trim(),
        status: 'disconnected',
      };

      set((state) => {
        const next = [...state.connections, newConnection];
        saveConnections(next);
        return { connections: next };
      });

      if (andSwitch) {
        return get().switchConnection(newId);
      }
      return true;
    },

    updateConnection: async (
      id: string,
      conn: Partial<{ name: string; serverUrl: string; omKey: string }>
    ) => {
      set((state) => {
        const next = state.connections.map((c) => {
          if (c.id !== id) return c;
          return {
            ...c,
            ...(conn.name !== undefined ? { name: conn.name.trim() } : {}),
            ...(conn.serverUrl !== undefined ? { serverUrl: conn.serverUrl.trim().replace(/\/+$/, '') } : {}),
            ...(conn.omKey !== undefined ? { omKey: conn.omKey.trim() } : {}),
          };
        });
        saveConnections(next);
        return { connections: next };
      });

      if (get().activeId === id) {
        return get().switchConnection(id);
      }
      return true;
    },

    deleteConnection: async (id: string) => {
      const { connections, activeId } = get();
      const next = connections.filter((c) => c.id !== id);
      saveConnections(next);

      if (next.length === 0) {
        saveActiveId('');
        try {
          localStorage.removeItem(`${STORAGE_TOKEN_KEY}_${id}`);
          localStorage.removeItem(STORAGE_TOKEN_KEY);
        } catch {
          // ignore
        }
        set({
          connections: [],
          activeId: '',
          serverUrl: '',
          token: null,
          isConnected: false,
        });
        return;
      }

      if (activeId === id) {
        const newActive = next[0];
        set({ connections: next, activeId: newActive.id });
        saveActiveId(newActive.id);
        await get().switchConnection(newActive.id);
      } else {
        set({ connections: next });
      }
    },

    testConnection: async (serverUrl?: string | null, omKey?: string) => {
      try {
        if (!omKey || !omKey.trim()) {
          return { success: false, msg: '请输入服务访问秘钥 (om.key)' };
        }
        const cleanUrl = (serverUrl || '').trim().replace(/\/+$/, '');
        await authApi.connect(omKey.trim(), cleanUrl);
        return { success: true };
      } catch (err: any) {
        return { success: false, msg: err.message || '连接失败' };
      }
    },

    setServerUrl: (url: string) => {
      const clean = url.trim().replace(/\/+$/, '');
      set({ serverUrl: clean });
    },

    setToken: (token: string | null) => {
      set({ token, isConnected: !!token });
    },

    logout: () => {
      set({ token: null, isConnected: false });
    },
  };
});
