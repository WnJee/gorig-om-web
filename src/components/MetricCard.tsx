import React from 'react';
import { Card, Typography } from 'antd';

const { Text } = Typography;

interface MetricCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  prefix?: React.ReactNode;
  icon?: React.ReactNode;
  subText?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendText?: string;
  color?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  suffix,
  prefix,
  icon,
  subText,
  color = '#4f46e5',
}) => {
  return (
    <Card
      className="rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow"
      styles={{ body: { padding: '20px' } }}
    >
      <div className="flex items-start justify-between">
        <div>
          <Text className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider block mb-1">
            {title}
          </Text>
          <div className="flex items-baseline space-x-1">
            {prefix && <span className="text-gray-600 dark:text-gray-300 text-lg mr-1">{prefix}</span>}
            <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {value}
            </span>
            {suffix && (
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-1">{suffix}</span>
            )}
          </div>
          {subText && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-1">
              <span>{subText}</span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};
