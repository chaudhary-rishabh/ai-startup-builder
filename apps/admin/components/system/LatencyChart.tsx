'use client'

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'
import type { LatencyDataPoint } from '@/types'

interface LatencyChartProps {
  data: LatencyDataPoint[]
  isLoading: boolean
}

export function LatencyChart({ data, isLoading }: LatencyChartProps) {
  if (isLoading) {
    return <div className="h-[320px] rounded-card shimmer" />
  }

  return (
    <div className="rounded-card border border-divider bg-card p-5 shadow-sm">
      <h3 className="mb-4 font-display text-sm font-semibold text-heading">
        Latency (24h)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#E8DFD0"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#C4A882' }}
            interval={3}
          />
          <YAxis
            tickFormatter={(v: number) => `${v}ms`}
            tick={{ fontSize: 10, fill: '#C4A882' }}
          />
          <Tooltip
            contentStyle={{
              border: '1px solid #E8DFD0',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-heading">{value}</span>
            )}
          />
          <Line
            type="monotone"
            dataKey="p50"
            name="P50"
            stroke="#16A34A"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="p95"
            name="P95"
            stroke="#D97706"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="p99"
            name="P99"
            stroke="#DC2626"
            strokeWidth={2}
            dot={false}
          />
          <ReferenceLine
            y={2000}
            stroke="#DC2626"
            strokeDasharray="6 3"
            label={{
              value: 'Alert threshold 2s',
              fill: '#DC2626',
              fontSize: 10,
              position: 'insideTopRight',
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
