import { apiClient } from './client';
import { PageResult, ReStartLog } from '../types';

export const appApi = {
  /**
   * Restart host service
   */
  restart: async (): Promise<void> => {
    return apiClient.post('/om/app/restart');
  },

  /**
   * Stop host service
   */
  stop: async (): Promise<void> => {
    return apiClient.post('/om/app/stop');
  },

  /**
   * Fetch paginated restart logs
   */
  getRestartLogs: async (page = 1, size = 10): Promise<PageResult<ReStartLog>> => {
    return apiClient.get('/om/app/restart/logs', {
      params: { page, size },
    });
  },
};
