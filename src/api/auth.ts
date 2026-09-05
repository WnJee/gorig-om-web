import { apiClient } from './client';
import { generateOmKeyHash } from '../utils/bcrypt';

export interface ConnectResult {
  token: string;
}

export const authApi = {
  /**
   * Connect and login using om.key
   * Generates dynamic bcrypt hash with current 10s time window
   */
  connect: async (omKey: string, serverUrl?: string): Promise<string> => {
    const hash = generateOmKeyHash(omKey);
    const baseURL = serverUrl ? serverUrl.trim().replace(/\/+$/, '') : undefined;
    const token = await apiClient.post<any, string>(
      '/om/auth/connect',
      { pwd: hash },
      baseURL ? { baseURL } : undefined
    );
    return token;
  },
};
