'use client'

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import type { AIModelBreakdown } from '@/types'
import { formatNumber } from '@/lib/dateRange'

const COLORS = ['#8B6F47', '#D97706', '#C4A882', '#5C4425', '#D0C8C0']

interface ModelBreakdownProps {
  data: AIModelBreakdown[]
  isLoading: boolean
}

export function ModelBreakdown({ data, isLoading }: ModelBreakdownProps) {
  if (isLoading) {
    return (
      <div className="grid h-[280px] grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="shimmer rounded-card" />
        <div className="shimmer rounded-card" />
      </div>
    )
  }

  const pieData = data.map((d) => ({ name: d.model, value: d.tokens }))

  return (
    <div className="rounded-card border border-divider bg-card p-5 shadow-sm">
      <h3 className="mb-4 font-display text-sm font-semibold text-heading">
        Model breakdown
      </h3>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => [formatNumber(v), 'Tokens']}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1">Model</th>
                <th className="py-1">Req</th>
                <th className="py-1">Tokens</th>
                <th className="py-1">Latency</th>
                <th className="py-1">Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.model} className="border-t border-divider">
                  <td className="py-2 pr-2">{row.model}</td>
                  <td className="py-2">{row.requests}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-1">
                      <div className="h-1 flex-1 max-w-[60px] overflow-hidden rounded-full bg-divider">
                        <div
                          className="h-full bg-brand"
                          style={{ width: `${row.sharePercent}%` }}
                        />
                      </div>
                      {row.sharePercent.toFixed(1)}%
                    </div>
                  </td>
                  <td className="py-2">{row.avgLatencyMs}ms</td>
                  <td className="py-2">${row.costUsd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
