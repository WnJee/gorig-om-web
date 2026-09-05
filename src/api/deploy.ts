import { apiClient } from './client';
import { EnvVersion, GoEnv, PageResult, SshKey, TaskOptions, TaskRecord } from '../types';

export const deployApi = {
  // Git
  checkGit: async (): Promise<EnvVersion> => {
    return apiClient.get('/om/deploy/git/check');
  },

  installGit: async (): Promise<EnvVersion> => {
    return apiClient.post('/om/deploy/git/install');
  },

  getBranches: async (repoUrl: string): Promise<string[]> => {
    return apiClient.get('/om/deploy/branches', {
      params: { repoUrl },
    });
  },

  // SSH Key
  getSSHKey: async (): Promise<SshKey> => {
    return apiClient.get('/om/deploy/ssh/key');
  },

  genSSHKey: async (): Promise<SshKey> => {
    return apiClient.post('/om/deploy/ssh/key');
  },

  // Go Environment
  checkGo: async (): Promise<EnvVersion> => {
    return apiClient.get('/om/deploy/go/check');
  },

  installGo: async (): Promise<EnvVersion> => {
    return apiClient.post('/om/deploy/go/install');
  },

  getGoEnv: async (): Promise<GoEnv[]> => {
    return apiClient.get('/om/deploy/go/env');
  },

  setGoEnv: async (envList: GoEnv[]): Promise<void> => {
    return apiClient.post('/om/deploy/go/env', envList);
  },

  // Pipeline Task
  getTaskConfig: async (): Promise<TaskOptions> => {
    return apiClient.get('/om/deploy/task/config');
  },

  saveTaskConfig: async (config: TaskOptions): Promise<void> => {
    return apiClient.post('/om/deploy/task/config', config);
  },

  startTask: async (): Promise<void> => {
    return apiClient.post('/om/deploy/task/start');
  },

  stopTask: async (id: string): Promise<void> => {
    return apiClient.post('/om/deploy/task/stop', null, {
      params: { id },
    });
  },

  getTaskPage: async (page = 1, size = 10): Promise<PageResult<TaskRecord>> => {
    return apiClient.get('/om/deploy/task/page', {
      params: { page, size },
    });
  },

  getTask: async (id: string): Promise<TaskRecord> => {
    return apiClient.get('/om/deploy/task/get', {
      params: { id },
    });
  },

  rollbackTask: async (id: string): Promise<void> => {
    return apiClient.post('/om/deploy/task/rollback', null, {
      params: { id },
    });
  },
};
