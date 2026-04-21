'use client'

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatNumber } from '@/lib/dateRange'
import type { AITokenDataPoint } from '@/types'

interface TokenTimeSeriesChartProps {
  data: AITokenDataPoint[]
  isLoading: boolean
}

export function TokenTimeSeriesChart({
  data,
  isLoading,
}: TokenTimeSeriesChartProps) {
  if (isLoading) {
    return <div className="h-[320px] rounded-card shimmer" />
  }

  return (
    <div className="rounded-card border border-divider bg-card p-5 shadow-sm">
      <h3 className="mb-4 font-display text-sm font-semibold text-heading">
        Token usage & cost
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#C4A882' }} />
          <YAxis
            yAxisId="left"
            tickFormatter={(v: number) =>
              v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : formatNumber(v)
            }
            tick={{ fontSize: 10, fill: '#C4A882' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            tick={{ fontSize: 10, fill: '#C4A882' }}
          />
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: '1px solid #E8DFD0',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="tokens"
            name="Tokens"
            stroke="#8B6F47"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="costUsd"
            name="Cost ($)"
            stroke="#D97706"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
