import React from 'react';
import { Radio, DatePicker, Space } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

export type QuickRange = '15m' | '1h' | '6h' | '24h' | '7d' | 'custom';

interface TimeRangeSelectorProps {
  value?: [number, number]; // [start Unix seconds, end Unix seconds]
  onChange: (range: [number, number], quick: QuickRange) => void;
  defaultQuick?: QuickRange;
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  onChange,
  defaultQuick = '1h',
}) => {
  const [quick, setQuick] = React.useState<QuickRange>(defaultQuick);

  const handleQuickChange = (e: any) => {
    const q = e.target.value as QuickRange;
    setQuick(q);
    const now = dayjs();
    let start = now.subtract(1, 'hour');

    switch (q) {
      case '15m':
        start = now.subtract(15, 'minute');
        break;
      case '1h':
        start = now.subtract(1, 'hour');
        break;
      case '6h':
        start = now.subtract(6, 'hour');
        break;
      case '24h':
        start = now.subtract(24, 'hour');
        break;
      case '7d':
        start = now.subtract(7, 'day');
        break;
      case 'custom':
        return;
    }

    onChange([start.unix(), now.unix()], q);
  };

  const handleCustomRange = (dates: any) => {
    if (dates && dates[0] && dates[1]) {
      setQuick('custom');
      onChange([dates[0].unix(), dates[1].unix()], 'custom');
    }
  };

  return (
    <Space wrap>
      <Radio.Group value={quick} onChange={handleQuickChange} size="middle" buttonStyle="solid">
        <Radio.Button value="15m">15分钟</Radio.Button>
        <Radio.Button value="1h">1小时</Radio.Button>
        <Radio.Button value="6h">6小时</Radio.Button>
        <Radio.Button value="24h">24小时</Radio.Button>
        <Radio.Button value="7d">7天</Radio.Button>
      </Radio.Group>
      <RangePicker
        showTime
        size="middle"
        onChange={handleCustomRange}
        format="YYYY-MM-DD HH:mm"
        placeholder={['开始时间', '结束时间']}
        className="w-68 rounded-lg"
      />
    </Space>
  );
};
