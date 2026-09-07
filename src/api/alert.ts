import { apiClient } from './client';
import { AlertConfig } from '../types';

export const alertApi = {
  getConfig: async (): Promise<AlertConfig> => {
    return apiClient.get('/om/alert/config');
  },

  saveConfig: async (config: AlertConfig): Promise<void> => {
    return apiClient.post('/om/alert/config', config);
  },

  testSend: async (): Promise<string> => {
    return apiClient.post('/om/alert/test');
  },
};
