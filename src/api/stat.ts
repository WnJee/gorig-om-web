import { apiClient } from './client';
import {
  ApiLatencyRank,
  ApiLatencySampleResp,
  ApiLatencySummary,
  BigObjRank,
  ErrSigRank,
  LeakEvent,
  PageResult,
  PageTimeItem,
} from '../types';

export const statApi = {
  // --- API Stats ---
  getApiSummary: async (start: number, end: number, slowMs = 200): Promise<ApiLatencySummary> => {
    return apiClient.get('/om/stat/api/summary', {
      params: { start, end, slowMs },
    });
  },

  getApiTimeRange: async (params: {
    start: number;
    end: number;
    unit?: string;
    filter?: string[];
  }): Promise<PageTimeItem[]> => {
    return apiClient.get('/om/stat/api/time', {
      params: {
        start: params.start,
        end: params.end,
        unit: params.unit || 'hour',
        filter: params.filter && params.filter.length > 0 ? params.filter : ['count', 'count2xx', 'count4xx', 'count5xx', 'countSlow'],
      },
      paramsSerializer: {
        indexes: null,
      },
    });
  },

  getApiTop: async (params: {
    start: number;
    end: number;
    page?: number;
    size?: number;
    methods?: string[];
    negMethods?: string[];
    uriPrefix?: string;
    uriLike?: string;
    statuses?: string[];
    sortBy?: string;
    asc?: boolean;
  }): Promise<PageResult<ApiLatencyRank>> => {
    return apiClient.get('/om/stat/api/top', {
      params,
      paramsSerializer: {
        indexes: null,
      },
    });
  },

  getApiSample: async (method: string, uri: string, types?: string[]): Promise<ApiLatencySampleResp> => {
    return apiClient.get('/om/stat/api/sample', {
      params: { method, uri, types },
      paramsSerializer: {
        indexes: null,
      },
    });
  },

  // --- Error Stats ---
  getErrorTimeRange: async (params: {
    start: number;
    end: number;
    unit?: string;
    filter?: string[];
  }): Promise<PageTimeItem[]> => {
    return apiClient.get('/om/stat/error/time', {
      params: {
        start: params.start,
        end: params.end,
        unit: params.unit || 'day',
        filter: params.filter && params.filter.length > 0 ? params.filter : ['panic', 'error', 'warn'],
      },
      paramsSerializer: {
        indexes: null,
      },
    });
  },

  getErrorTop: async (params: {
    start: number;
    end: number;
    limit?: number;
    filter?: string[];
  }): Promise<ErrSigRank[]> => {
    return apiClient.get('/om/stat/error/top', {
      params: {
        start: params.start,
        end: params.end,
        limit: params.limit || 10,
        filter: params.filter,
      },
      paramsSerializer: {
        indexes: null,
      },
    });
  },

  // --- Goroutine & Memory Stats ---
  getGoroutineTime: async (params: {
    start: number;
    end: number;
    unit?: string;
  }): Promise<PageTimeItem[]> => {
    return apiClient.get('/om/stat/goroutine/time', {
      params: {
        start: params.start,
        end: params.end,
        unit: params.unit || 'minute',
      },
    });
  },

  getMemBigTop: async (params: {
    start: number;
    end: number;
    page?: number;
    size?: number;
    sortBy?: string;
    asc?: boolean;
  }): Promise<PageResult<BigObjRank>> => {
    return apiClient.get('/om/stat/mem/big/top', {
      params: {
        start: params.start,
        end: params.end,
        page: params.page || 1,
        size: params.size || 20,
        sortBy: params.sortBy || 'inuseSpace',
        asc: params.asc || false,
      },
    });
  },

  getMemBigCount: async (start?: number, end?: number): Promise<number> => {
    const s = start && start > 0 ? start : Math.floor(Date.now() / 1000) - 86400;
    const e = end && end > 0 ? end : Math.floor(Date.now() / 1000);
    return apiClient.get('/om/stat/mem/big/count', {
      params: { start: s, end: e },
    });
  },

  getMemLeakLatest: async (): Promise<LeakEvent | null> => {
    return apiClient.get('/om/stat/mem/leak/latest');
  },

  getMemLeakCount: async (start?: number, end?: number): Promise<number> => {
    const s = start && start > 0 ? start : Math.floor(Date.now() / 1000) - 86400;
    const e = end && end > 0 ? end : Math.floor(Date.now() / 1000);
    return apiClient.get('/om/stat/mem/leak/count', {
      params: { start: s, end: e },
    });
  },

  getMemLeakPage: async (params: {
    start?: number;
    end?: number;
    page?: number;
    size?: number;
  }): Promise<PageResult<LeakEvent>> => {
    return apiClient.get('/om/stat/mem/leak/page', {
      params: {
        start: params.start || 0,
        end: params.end || 0,
        page: params.page || 1,
        size: params.size || 10,
      },
    });
  },
};
