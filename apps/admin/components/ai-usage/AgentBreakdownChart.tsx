'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { AIAgentBreakdown } from '@/types'

interface AgentBreakdownChartProps {
  data: AIAgentBreakdown[]
  isLoading: boolean
}

function titleCaseSnake(s: string) {
  return s
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function AgentBreakdownChart({
  data,
  isLoading,
}: AgentBreakdownChartProps) {
  if (isLoading) {
    return <div className="h-[280px] rounded-card shimmer" />
  }

  return (
    <div className="rounded-card border border-divider bg-card p-5 shadow-sm">
      <h3 className="mb-4 font-display text-sm font-semibold text-heading">
        Agents
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" horizontal />
          <XAxis
            type="number"
            tickFormatter={(n: number) =>
              n > 1000 ? `${(n / 1000).toFixed(0)}K` : String(n)
            }
            tick={{ fontSize: 10, fill: '#C4A882' }}
          />
          <YAxis
            type="category"
            dataKey="agentType"
            width={160}
            tick={{ fontSize: 10, fill: '#C4A882' }}
            tickFormatter={(v: string) => titleCaseSnake(v)}
          />
          <Tooltip
            contentStyle={{
              border: '1px solid #E8DFD0',
              borderRadius: 8,
              fontSize: 12,
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const p = payload[0].payload as AIAgentBreakdown
              return (
                <div className="rounded border border-divider bg-card px-3 py-2 text-xs shadow">
                  <p className="font-medium">{titleCaseSnake(p.agentType)}</p>
                  <p>
                    {formatTokens(p.tokens)} tokens — ${p.costUsd.toFixed(2)}
                  </p>
                </div>
              )
            }}
          />
          <Bar
            dataKey="tokens"
            fill="#8B6F47"
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function formatTokens(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : String(n)
}
