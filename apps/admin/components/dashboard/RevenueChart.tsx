'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { formatCents } from '@/lib/dateRange'
import type { RevenueDataPoint } from '@/types'

interface RevenueChartProps {
  data: RevenueDataPoint[]
  isLoading: boolean
}

export function RevenueChart({ data, isLoading }: RevenueChartProps) {
  const lastMrr = data[data.length - 1]?.mrr ?? 0

  if (isLoading) {
    return (
      <div className="bg-card rounded-card shadow-sm p-5">
        <div className="h-6 w-48 shimmer rounded mb-4" />
        <div className="h-8 w-32 shimmer rounded mb-6" />
        <div className="h-[280px] shimmer rounded-card" />
      </div>
    )
  }

  return (
    <div className="bg-card rounded-card shadow-sm p-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
        <h2 className="text-[13px] font-medium text-heading">
          Monthly Recurring Revenue
        </h2>
        <p className="font-display text-xl font-bold text-heading">
          {formatCents(lastMrr)}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B6F47" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#8B6F47" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#D0C8C0"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#C4A882' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => `$${(v / 100 / 1000).toFixed(0)}k`}
            tick={{ fontSize: 11, fill: '#C4A882' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: '#FFFFFF',
              border: '1px solid #D0C8C0',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number | string) => [
              formatCents(Number(value)),
              'MRR',
            ]}
          />
          <Area
            type="monotone"
            dataKey="mrr"
            stroke="none"
            fill="url(#revenueGradient)"
          />
          <Line
            type="monotone"
            dataKey="mrr"
            stroke="#8B6F47"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4,
              fill: '#8B6F47',
              stroke: '#FFFFFF',
              strokeWidth: 2,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
