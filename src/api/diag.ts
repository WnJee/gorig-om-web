import { apiClient } from './client';
import { GoroutineClusterResult } from '../types';

export const diagApi = {
  getGoroutines: async (): Promise<GoroutineClusterResult> => {
    return apiClient.get('/om/diag/goroutines');
  },

  getRawGoroutines: async (): Promise<string> => {
    return apiClient.get('/om/diag/goroutines/raw', {
      responseType: 'text',
    });
  },

  downloadCPUProfile: async (seconds = 10): Promise<void> => {
    const res = await apiClient.get('/om/diag/cpu/profile', {
      params: { seconds },
      responseType: 'blob',
    });
    const blob = new Blob([res as any], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cpu_${seconds}s.pprof`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  downloadHeapProfile: async (): Promise<void> => {
    const res = await apiClient.get('/om/diag/heap/profile', {
      responseType: 'blob',
    });
    const blob = new Blob([res as any], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'heap.pprof';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
