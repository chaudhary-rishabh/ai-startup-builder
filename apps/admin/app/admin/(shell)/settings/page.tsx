'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as settingsApi from '@/lib/api/settings.api'
import { GeneralSettings } from '@/components/settings/GeneralSettings'
import { EmailSettings } from '@/components/settings/EmailSettings'
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings'
import { FeatureFlagsTable } from '@/components/settings/FeatureFlagsTable'
import { SecuritySettings } from '@/components/settings/SecuritySettings'
import type { FeatureFlag, SettingsTab } from '@/types'
import { toast } from 'sonner'
import { Cog, Mail, Link, Flag, Shield } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { LucideIcon } from 'lucide-react'

const TABS: { key: SettingsTab; label: string; icon: LucideIcon }[] = [
  { key: 'general', label: 'General', icon: Cog },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'integrations', label: 'Integrations', icon: Link },
  { key: 'feature-flags', label: 'Feature Flags', icon: Flag },
  { key: 'security', label: 'Security', icon: Shield },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const qc = useQueryClient()

  const generalQuery = useQuery({
    queryKey: ['admin', 'settings', 'general'],
    queryFn: settingsApi.getGeneralSettings,
    enabled: activeTab === 'general',
  })

  const emailQuery = useQuery({
    queryKey: ['admin', 'settings', 'email'],
    queryFn: settingsApi.getEmailSettings,
    enabled: activeTab === 'email',
  })

  const templatesQuery = useQuery({
    queryKey: ['admin', 'settings', 'email-templates'],
    queryFn: settingsApi.getEmailTemplatePreviews,
    enabled: activeTab === 'email',
  })

  const integrationsQuery = useQuery({
    queryKey: ['admin', 'settings', 'integrations'],
    queryFn: settingsApi.getIntegrationKeys,
    enabled: activeTab === 'integrations',
  })

  const flagsQuery = useQuery({
    queryKey: ['admin', 'settings', 'flags'],
    queryFn: settingsApi.getFeatureFlags,
    enabled: activeTab === 'feature-flags',
  })

  const securityQuery = useQuery({
    queryKey: ['admin', 'settings', 'security'],
    queryFn: settingsApi.getSecuritySettings,
    enabled: activeTab === 'security',
  })

  const updateGeneral = useMutation({
    mutationFn: settingsApi.updateGeneralSettings,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'settings', 'general'] })
    },
    onError: () => toast.error('Failed to save settings'),
  })

  const updateEmail = useMutation({
    mutationFn: settingsApi.updateEmailSettings,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'settings', 'email'] })
    },
    onError: () => toast.error('Failed to save email settings'),
  })

  const updateIntegration = useMutation({
    mutationFn: ({
      service,
      apiKey,
    }: {
      service: string
      apiKey: string
    }) => settingsApi.updateIntegrationKey(service, apiKey),
    onSuccess: (_, { service }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'settings', 'integrations'] })
      toast.success(`${service} API key saved`)
    },
    onError: () => toast.error('Failed to save key'),
  })

  const validateKey = useMutation({
    mutationFn: (service: string) =>
      settingsApi.validateIntegrationKey(service),
  })

  const updateFlag = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Partial<
        Pick<FeatureFlag, 'enabled' | 'rolloutPercent' | 'planRestriction'>
      >
    }) => settingsApi.updateFeatureFlag(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'settings', 'flags'] })
    },
    onError: () => toast.error('Failed to update feature flag'),
  })

  const updateSecurity = useMutation({
    mutationFn: settingsApi.updateSecuritySettings,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'settings', 'security'] })
    },
    onError: () => toast.error('Failed to save security settings'),
  })

  return (
    <div className="flex gap-6 max-w-5xl">
      <aside className="w-[200px] flex-shrink-0">
        <nav className="bg-card rounded-card shadow-sm p-2 space-y-0.5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              data-testid={`settings-tab-${key}`}
              onClick={() => setActiveTab(key)}
              className={cn(
                'w-full flex items-center gap-2.5 h-9 px-3 rounded-chip',
                'text-sm text-left transition-colors',
                activeTab === key
                  ? 'bg-divider text-heading font-medium border-l-[3px] border-brand'
                  : 'text-muted hover:text-heading hover:bg-divider/60',
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        {activeTab === 'general' ? (
          <GeneralSettings
            settings={generalQuery.data}
            isLoading={generalQuery.isLoading}
            onSave={async (payload) => {
              await updateGeneral.mutateAsync(payload)
            }}
          />
        ) : null}
        {activeTab === 'email' ? (
          <EmailSettings
            settings={emailQuery.data}
            templates={templatesQuery.data ?? []}
            isLoading={emailQuery.isLoading}
            onSave={async (payload) => {
              await updateEmail.mutateAsync(payload)
            }}
          />
        ) : null}
        {activeTab === 'integrations' ? (
          <IntegrationsSettings
            keys={integrationsQuery.data ?? []}
            isLoading={integrationsQuery.isLoading}
            onUpdate={async (service, apiKey) => {
              await updateIntegration.mutateAsync({ service, apiKey })
            }}
            onValidate={validateKey.mutateAsync}
          />
        ) : null}
        {activeTab === 'feature-flags' ? (
          <FeatureFlagsTable
            flags={flagsQuery.data ?? []}
            isLoading={flagsQuery.isLoading}
            onUpdate={async (id, payload) => {
              await updateFlag.mutateAsync({ id, payload })
            }}
          />
        ) : null}
        {activeTab === 'security' ? (
          <SecuritySettings
            settings={securityQuery.data}
            isLoading={securityQuery.isLoading}
            onSave={async (payload) => {
              await updateSecurity.mutateAsync(payload)
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
