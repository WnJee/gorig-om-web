import { apiClient } from './client';
import { PageResult, PageTimeItem, ResType, ResUsage } from '../types';

export const hostApi = {
  /**
   * Get paginated resource usage snapshots
   */
  getUsage: async (page = 1, size = 20): Promise<PageResult<ResUsage>> => {
    return apiClient.get('/om/host/usage', {
      params: { page, size },
    });
  },

  /**
   * Get time-aggregated resource usage metrics for charts
   */
  getTimeRange: async (params: {
    start: number;
    end: number;
    unit?: 'minute' | '5m' | '10m' | '30m' | 'hour' | 'day';
    filter?: ResType[];
  }): Promise<PageTimeItem[]> => {
    return apiClient.get('/om/host/usage/time', {
      params: {
        start: params.start,
        end: params.end,
        unit: params.unit || 'minute',
        filter: params.filter && params.filter.length > 0 ? params.filter : ['cpu', 'appCpu', 'mem', 'appMem', 'totalMem', 'disk', 'appDisk', 'totalDisk'],
      },
      paramsSerializer: {
        indexes: null, // serializes filter=cpu&filter=mem
      },
    });
  },
};
