'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { UserGrowthDataPoint } from '@/types'

interface UserGrowthChartProps {
  data: UserGrowthDataPoint[]
  isLoading: boolean
}

export function UserGrowthChart({ data, isLoading }: UserGrowthChartProps) {
  const totalSignups = data.reduce((acc, d) => acc + d.signups, 0)

  if (isLoading) {
    return (
      <div className="bg-card rounded-card shadow-sm p-5">
        <div className="h-6 w-32 shimmer rounded mb-2" />
        <div className="h-5 w-24 shimmer rounded mb-4" />
        <div className="h-[220px] shimmer rounded-card" />
      </div>
    )
  }

  return (
    <div className="bg-card rounded-card shadow-sm p-5">
      <div className="flex flex-col gap-1 mb-4">
        <h2 className="text-[13px] font-medium text-heading">User Growth</h2>
        <p className="text-xs text-muted">
          {totalSignups.toLocaleString('en-US')} new signups this period
        </p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
          barCategoryGap="30%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#D0C8C0"
            vertical={false}
          />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 10, fill: '#C4A882' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: string) => v.replace('Week of ', '')}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#C4A882' }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: '#FFFFFF',
              border: '1px solid #D0C8C0',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(v: number | string) => [Number(v), 'New Signups']}
          />
          <Bar
            dataKey="signups"
            fill="#8B6F47"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
