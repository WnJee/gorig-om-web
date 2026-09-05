import dayjs from 'dayjs';

/**
 * Format timestamp (seconds or milliseconds, or ISO string) to readable string
 */
export function formatTime(ts?: number | string | null, format = 'YYYY-MM-DD HH:mm:ss'): string {
  if (!ts) return '-';
  const num = typeof ts === 'string' && /^\d+$/.test(ts.trim()) ? Number(ts) : typeof ts === 'number' ? ts : NaN;
  if (!isNaN(num) && num > 0) {
    const ms = num < 1e11 ? num * 1000 : num;
    return dayjs(ms).format(format);
  }
  return dayjs(ts).format(format);
}

/**
 * Format byte count to human-readable size
 */
export function formatBytes(bytes?: number | null, decimals = 2): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '-';
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

  return `${val} ${sizes[i] || 'B'}`;
}

/**
 * Format milliseconds to duration
 */
export function formatLatency(ms?: number | null): string {
  if (ms === undefined || ms === null || isNaN(ms)) return '-';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num?: number | null): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return num.toLocaleString();
}

/**
 * Format timestamp for charts based on time span
 */
export function formatChartTime(ts?: number | string | null, spanSeconds = 3600): string {
  if (!ts) return '';
  const format = spanSeconds > 86400 ? 'MM-DD HH:mm' : 'HH:mm';
  return formatTime(ts, format);
}

/**
 * Format megabyte number to readable MB / GB string
 */
export function formatMB(mb?: number | string | null, decimals = 1): string {
  if (mb === undefined || mb === null) return '-';
  const val = typeof mb === 'string' ? parseFloat(mb) : mb;
  if (isNaN(val)) return '-';
  if (val >= 1024) {
    return `${(val / 1024).toFixed(decimals)} GB`;
  }
  return `${val.toFixed(decimals)} MB`;
}
