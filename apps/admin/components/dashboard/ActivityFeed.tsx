'use client'

import { formatDistanceToNow } from 'date-fns'
import {
  UserPlus,
  TrendingUp,
  UserX,
  FolderPlus,
  Rocket,
  DollarSign,
  AlertCircle,
  Cpu,
  Shield,
} from 'lucide-react'
import type { ActivityEvent } from '@/types'
import { cn } from '@/lib/cn'

interface ActivityFeedProps {
  events: ActivityEvent[]
  isLoading: boolean
}

function EventIcon({ type }: { type: ActivityEvent['type'] }) {
  const map: Record<
    ActivityEvent['type'],
    { Icon: typeof UserPlus; wrap: string; color: string }
  > = {
    'user.signup': { Icon: UserPlus, wrap: 'bg-green-100', color: 'text-green-700' },
    'user.upgrade': {
      Icon: TrendingUp,
      wrap: 'bg-brand/10',
      color: 'text-brand',
    },
    'user.suspend': { Icon: UserX, wrap: 'bg-red-100', color: 'text-red-700' },
    'project.created': {
      Icon: FolderPlus,
      wrap: 'bg-blue-100',
      color: 'text-blue-700',
    },
    'project.launched': {
      Icon: Rocket,
      wrap: 'bg-purple-100',
      color: 'text-purple-700',
    },
    'payment.received': {
      Icon: DollarSign,
      wrap: 'bg-green-100',
      color: 'text-green-700',
    },
    'payment.failed': {
      Icon: AlertCircle,
      wrap: 'bg-red-100',
      color: 'text-red-700',
    },
    'agent.run': { Icon: Cpu, wrap: 'bg-brand/10', color: 'text-brand' },
    'admin.action': {
      Icon: Shield,
      wrap: 'bg-amber-100',
      color: 'text-amber-800',
    },
  }
  const { Icon, wrap, color } = map[type]
  return (
    <div
      className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        wrap,
      )}
    >
      <Icon className={cn('w-4 h-4', color)} />
    </div>
  )
}

export function ActivityFeed({ events, isLoading }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="divide-y divide-divider">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-3 min-h-[44px]">
            <div className="w-8 h-8 rounded-full shimmer flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-40 shimmer rounded" />
              <div className="h-2 w-full shimmer rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {events.map((event, index) => (
        <div
          key={event.id}
          className={cn(
            'flex gap-3 px-4 py-3 min-h-[44px] items-start',
            index % 2 === 0 ? 'bg-bg' : 'bg-card',
          )}
        >
          <EventIcon type={event.type} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-heading">
              {event.actorName}
            </p>
            <p className="text-xs text-muted">{event.description}</p>
            <p className="text-[11px] text-muted/60 mt-1">
              {formatDistanceToNow(new Date(event.occurredAt), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
