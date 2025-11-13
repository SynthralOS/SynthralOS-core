import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';

interface SparklineChartProps {
  data: number[];
  color?: string;
  height?: number;
}

export default function SparklineChart({ data, color = '#6366f1', height = 60 }: SparklineChartProps) {
  const { resolvedTheme } = useTheme();
  const chartData = data.map((value, index) => ({ value, index }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={true}
          animationDuration={1000}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: resolvedTheme === 'dark' ? '#1f2937' : '#ffffff',
            border: `1px solid ${resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'}`,
            borderRadius: '8px',
            padding: '8px 12px',
          }}
          labelStyle={{ color: resolvedTheme === 'dark' ? '#9ca3af' : '#6b7280' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

