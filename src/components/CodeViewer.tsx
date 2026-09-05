import React, { useState } from 'react';
import { Button, message } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';

interface CodeViewerProps {
  code: string;
  title?: string;
  maxHeight?: string | number;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  code,
  title,
  maxHeight = 350,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    message.success('已复制到剪贴板');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-900 text-gray-100 font-mono text-xs">
      {title && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
          <span className="text-gray-300 font-semibold">{title}</span>
          <Button
            type="text"
            size="small"
            icon={copied ? <CheckOutlined className="text-green-400" /> : <CopyOutlined className="text-gray-300" />}
            onClick={handleCopy}
            className="text-gray-300 hover:text-white"
          >
            {copied ? '已复制' : '复制'}
          </Button>
        </div>
      )}
      <div
        className="p-3 overflow-auto custom-scrollbar"
        style={{ maxHeight }}
      >
        <pre className="m-0 leading-relaxed whitespace-pre-wrap break-all">{code || '// 无内容'}</pre>
      </div>
    </div>
  );
};
