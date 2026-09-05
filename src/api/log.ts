import { apiClient } from './client';
import { useAuthStore } from '../stores/useAuthStore';
import { ContextLogLine, LogLevel, MatchedRecord, SearchOptions } from '../types';

export const logApi = {
  /**
   * Fetch available log categories
   */
  getCategories: async (): Promise<string[]> => {
    return apiClient.get('/om/log/categories');
  },

  /**
   * Fetch supported log levels
   */
  getLevels: async (): Promise<LogLevel[]> => {
    return apiClient.get('/om/log/levels');
  },

  /**
   * Search logs by options
   */
  searchLogs: async (options: SearchOptions): Promise<MatchedRecord[]> => {
    return apiClient.post('/om/log/search', options);
  },

  /**
   * Fetch context lines around a specific log line
   */
  getNearLogs: async (path: string, line: number, range = 20): Promise<ContextLogLine[]> => {
    return apiClient.get('/om/log/near', {
      params: { path, line, range },
    });
  },

  /**
   * Download a raw .jsonl log file
   */
  downloadLog: async (path: string): Promise<Blob> => {
    return apiClient.get('/om/log/download', {
      params: { path },
      responseType: 'blob',
    });
  },

  /**
   * Helper to construct SSE EventSource URL for real-time monitoring
   */
  buildMonitorUrl: (options: SearchOptions): string => {
    const { serverUrl, token } = useAuthStore.getState();
    const base = serverUrl ? serverUrl : '';
    const params = new URLSearchParams();

    if (token) {
      params.append('token', token);
    }
    if (options.categories?.length) {
      options.categories.forEach((cat) => params.append('categories', cat));
    }
    if (options.level) {
      params.append('level', options.level);
    }
    if (options.levels?.length) {
      options.levels.forEach((lvl) => params.append('levels', lvl));
    }
    if (options.traceID) {
      params.append('traceID', options.traceID);
    }
    if (options.keyword) {
      params.append('keyword', options.keyword);
    }

    return `${base}/om/log/monitor?${params.toString()}`;
  },
};
