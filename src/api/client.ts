import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from '../utils/antMsg';
import { useAuthStore } from '../stores/useAuthStore';
import { ApiResponse } from '../types';

export const apiClient = axios.create({
  timeout: 30000,
});

let tokenFetchPromise: Promise<string | null> | null = null;

const ensureValidToken = async (): Promise<string | null> => {
  const state = useAuthStore.getState();
  if (state.token) return state.token;

  if (!tokenFetchPromise) {
    tokenFetchPromise = (async () => {
      try {
        const ok = await state.reconnectActive();
        if (ok) {
          return useAuthStore.getState().token;
        }
        return null;
      } finally {
        tokenFetchPromise = null;
      }
    })();
  }
  return tokenFetchPromise;
};

// In-flight deduplication & client-side rate-limiting / throttle
// To prevent 429 Too Many Requests (backend has 200ms debounce on same route+query)
const inFlightRequests = new Map<string, Promise<AxiosResponse>>();
const recentGetCache = new Map<string, { time: number; res: AxiosResponse }>();
const lastRequestTimestamp = new Map<string, number>();

const defaultAdapter = axios.getAdapter(axios.defaults.adapter);

apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  const method = (config.method || 'get').toUpperCase();

  let fullUri = '';
  try {
    fullUri = apiClient.getUri(config);
  } catch {
    fullUri = `${config.baseURL || ''}${config.url || ''}`;
  }
  const auth = (config.headers?.Authorization as string) || '';
  const dataKey = method === 'GET' ? '' : (typeof config.data === 'string' ? config.data : JSON.stringify(config.data || ''));
  const cacheKey = `${method}:${fullUri}:${auth}:${dataKey}`;

  // 1. In-flight request deduplication for GET and connect requests
  if (method === 'GET' || config.url?.includes('/om/auth/connect')) {
    const cached = recentGetCache.get(cacheKey);
    if (cached && Date.now() - cached.time < 300) {
      return { ...cached.res, config };
    }

    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight.then((res) => ({ ...res, config }));
    }
  }

  // 2. Client-side throttle to avoid server debounce (< 200ms)
  const lastTime = lastRequestTimestamp.get(cacheKey) || 0;
  const elapsed = Date.now() - lastTime;
  if (elapsed < 230) {
    await new Promise((resolve) => setTimeout(resolve, 230 - elapsed));
  }
  lastRequestTimestamp.set(cacheKey, Date.now());

  // 3. Dispatch through base adapter
  const promise = (async () => {
    try {
      const res = await defaultAdapter(config);
      if (method === 'GET') {
        recentGetCache.set(cacheKey, { time: Date.now(), res });
      }
      return res;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  if (method === 'GET' || config.url?.includes('/om/auth/connect')) {
    inFlightRequests.set(cacheKey, promise);
  }

  return promise;
};

// Request interceptor
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const { serverUrl } = useAuthStore.getState();

    // If a custom server URL is set, prepend it to relative URLs
    if (serverUrl && config.url && !config.url.startsWith('http://') && !config.url.startsWith('https://')) {
      config.baseURL = serverUrl;
    }

    // Skip auth token injection for connect itself and public endpoints
    if (!config.url?.includes('/om/auth/connect') && !config.url?.includes('/om/app/restarted')) {
      let currentToken = useAuthStore.getState().token;
      if (!currentToken) {
        currentToken = await ensureValidToken();
      }
      if (currentToken) {
        config.headers.Authorization = `Bearer ${currentToken}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    // If response is raw binary/blob (like log download)
    if (response.config.responseType === 'blob') {
      return response.data;
    }

    const res = response.data as ApiResponse;

    // Gorig framework standard response: { code: 200, data: ..., msg: "..." }
    if (res && typeof res.code === 'number') {
      if (res.code === 200) {
        return res.data;
      } else {
        const errorMsg = res.msg || '操作失败';
        message.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
      }
    }

    return response.data;
  },
  async (error: AxiosError<any>) => {
    const status = error.response?.status;
    const resData = error.response?.data;
    const config = error.config as any;

    // Auto-retry 429 Too Many Requests (caused by backend debounce) with 250ms delay
    if ((status === 429 || resData?.code === 429) && config && (!config.__retryCount || config.__retryCount < 3)) {
      config.__retryCount = (config.__retryCount || 0) + 1;
      await new Promise((resolve) => setTimeout(resolve, 250 * config.__retryCount));
      return apiClient.request(config);
    }

    // Auto-retry 401/403 with re-authentication once
    if (
      (status === 401 || status === 403) &&
      config &&
      !config.__authRetry &&
      !config.url?.includes('/om/auth/connect')
    ) {
      config.__authRetry = true;
      useAuthStore.getState().setToken(null);
      const newToken = await ensureValidToken();
      if (newToken) {
        config.headers.Authorization = `Bearer ${newToken}`;
        return apiClient.request(config);
      }
    }

    let errorMsg = resData?.msg || error.message || '网络请求错误';
    message.error(errorMsg);

    return Promise.reject(new Error(errorMsg));
  }
);
