import React from 'react';

export interface PageHeaderProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  title,
  description,
  extra,
  className = '',
}) => {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl px-5 py-3.5 sm:py-4 shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 ${className}`}
    >
      <div className="flex items-center space-x-3.5 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-lg sm:text-xl shadow-sm shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 leading-snug flex items-center gap-2">
            {title}
          </div>
          {description && (
            <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {description}
            </div>
          )}
        </div>
      </div>

      {extra && <div className="shrink-0 flex items-center">{extra}</div>}
    </div>
  );
};
