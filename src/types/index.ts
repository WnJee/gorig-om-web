// API Response wrapper
export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

// Pagination wrapper from cache.PageCache
export interface PageResult<T> {
  total: number;
  page: number;
  size: number;
  items: T[];
}

// Time-series aggregation point from cache.PageTimeItem
export interface PageTimeItem {
  at: string;
  value: Record<string, number>;
}

// Host Resource Metrics
export interface ResUsage {
  cpuNum: number;
  appCpu: string;
  appMem: string;
  appDisk: string;
  cpu: string;
  mem: string;
  totalMem: string;
  disk: string;
  totalDisk: string;
  at: number;
}

export type ResType = 'cpu' | 'appCpu' | 'mem' | 'appMem' | 'totalMem' | 'disk' | 'appDisk' | 'totalDisk';

// App Lifecycle
export type StartSrc = 'manual' | 'deploy' | 'crash' | 'overuse';

export interface ReStartLog {
  startTime: number;
  startSrc: StartSrc;
  log: string;
}

// Logs
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'dpanic';

export interface LogRecord {
  level: string;
  time: string;
  msg: string;
  _trace_id_?: string;
  error?: string;
  data?: Record<string, string>;
}

export interface MatchedRecord {
  path: string;
  line: number;
  record: LogRecord;
}

export interface ContextLogLine {
  path: string;
  line: number;
  content: string;
  record?: LogRecord;
}

export interface SearchOptions {
  categories?: string[];
  level?: string;
  levels?: string[];
  traceID?: string;
  keyword?: string;
  startTime?: string;
  endTime?: string;
  size?: number;
  lastPath?: string;
  lastLine?: number;
}

// API Stats
export interface ApiLatencySummary {
  count: number;
  avgLatency: number;
  count5xx: number;
  slowCount: number;
  updatedAt: number;
}

export interface ApiLatencyRank {
  method: string;
  uri: string;
  count: number;
  avgLatency: number;
  maxLatency: number;
  count2xx: number;
  count4xx: number;
  count5xx: number;
  countOther: number;
  successRate: number;
  sampleTrace?: string;
}

export interface ApiLogSample {
  msg: string;
  error?: string;
  data?: Record<string, string>;
}

export interface ApiLatencySample {
  traceId: string;
  url: string;
  requestAt: number;
  status: number;
  latencyMs: number;
  inLog?: ApiLogSample;
  outLog?: ApiLogSample;
}

export interface ApiLatencySampleResp {
  latest?: ApiLatencySample;
  sample2xx?: ApiLatencySample;
  sample4xx?: ApiLatencySample;
  sample5xx?: ApiLatencySample;
  sampleSlow?: ApiLatencySample;
}

// Error Stats
export interface ErrStat {
  at: number;
  warn: number;
  error: number;
  panic: number;
  total: number;
}

export interface ErrSigRank {
  sigHash: string;
  signature: string;
  level: string;
  count: number;
  sampleMsg?: string;
  sampleError?: string;
  sampleTrace?: string;
  firstAt: number;
  lastAt: number;
}

// Goroutine & Memory Stats
export interface GoroutineStat {
  at: number;
  count: number;
}

export interface BigObjRank {
  func: string;
  file: string;
  line: number;
  inuseSpace: number;
  inuseObjects: number;
  avgObjSize: number;
  lastAt: number;
}

export interface LeakPoint {
  func: string;
  file: string;
  line: number;
  deltaSpace: number;
  deltaObjects: number;
  avgObjSize: number;
}

export interface LeakEvent {
  at: number;
  allocBytes: number;
  objectCount: number;
  allocDelta: number;
  objectDelta: number;
  baseInuseSpace: number;
  leakInuseSpace: number;
  baseInuseObject: number;
  leakInuseObject: number;
  baseProfile?: string;
  leakProfile?: string;
  points: LeakPoint[];
}

// Deploy & Environment
export interface EnvVersion {
  installed: boolean;
  version: string;
  error?: string;
}

export interface SshKey {
  publicKey: string;
  error?: string;
}

export interface GoEnv {
  key: string;
  value: string;
  default?: boolean;
}

export interface OtherRepo {
  dir: string;
  repo: string;
  branch: string;
}

export interface TaskOptions {
  gitInit: boolean;
  goInit: boolean;
  sshKeyCopy: boolean;
  repo: string;
  branch: string;
  otherRepos?: OtherRepo[];
  autoTrigger: boolean;
  healthCheckUrl?: string;
  healthCheckTimeout?: number;
  autoRollback?: boolean;
}

export type TaskStatus = 'waiting' | 'running' | 'success' | 'failed' | 'timeout' | 'canceled';
export type RollbackStatus = '' | 'ready' | 'cleaned';
export type TaskRecordLogLevel = 'info' | 'warn' | 'error' | 'light';

export interface TaskRecordLog {
  time: string;
  text: string;
  level: TaskRecordLogLevel;
}

export interface TaskRecord extends TaskOptions {
  id: string;
  commit?: string;
  gitHash?: string;
  createAt?: string;
  status: TaskStatus;
  createBy?: string;
  buildFile?: string;
  log?: TaskRecordLog[];
  startAt?: string;
  finishAt?: string;
  rbStatus: RollbackStatus;
  rb: boolean;
  rid?: string;
}

// Alert System
export type ChannelType = 'feishu' | 'dingtalk' | 'wecom' | 'generic';
export type AlertLevel = 'info' | 'warning' | 'critical';
export type AlertType = 'crash' | 'mem_leak' | 'deploy_fail' | 'high_cpu' | 'high_disk' | 'high_goroutine' | 'test';

export interface AlertConfig {
  enabled: boolean;
  channel: ChannelType;
  webhookUrl: string;
  secret?: string;
  cooldownMin: number;
  cpuThreshold: number;
  memThreshold: number;
  diskThreshold: number;
  goroutineThreshold: number;
  notifyOnCrash: boolean;
  notifyOnDeployFail: boolean;
  notifyOnMemLeak: boolean;
}

export interface AlertEvent {
  type: AlertType;
  level: AlertLevel;
  title: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  hostName: string;
}

// Runtime Diagnostics
export interface GoroutineStackFrame {
  function: string;
  file: string;
  line: number;
}

export interface GoroutineInfo {
  id: number;
  state: string;
  waitDuration?: string;
  frames: GoroutineStackFrame[];
}

export interface GoroutineGroup {
  count: number;
  percentage: number;
  state: string;
  topFrame: GoroutineStackFrame;
  frames: GoroutineStackFrame[];
}

export interface GoroutineClusterResult {
  totalGoroutines: number;
  totalGroups: number;
  timestamp: string;
  groups: GoroutineGroup[];
}
