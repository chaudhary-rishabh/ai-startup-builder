import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings'
import type { IntegrationKey } from '@/types'
import { vi } from 'vitest'

const mockKeys: IntegrationKey[] = [
  {
    service: 'anthropic',
    label: 'Anthropic (Claude API)',
    apiKey: 'sk-ant-••••••••1234',
    isSet: true,
    lastValidatedAt: new Date().toISOString(),
    validationStatus: 'valid',
  },
  {
    service: 'pinecone',
    label: 'Pinecone (Vector DB)',
    apiKey: '',
    isSet: false,
    lastValidatedAt: null,
    validationStatus: 'unchecked',
  },
]

describe('IntegrationsSettings', () => {
  it('renders all integration rows', () => {
    render(
      <IntegrationsSettings
        keys={mockKeys}
        isLoading={false}
        onUpdate={vi.fn()}
        onValidate={vi.fn()}
      />,
    )
    expect(screen.getByText('Anthropic (Claude API)')).toBeInTheDocument()
    expect(screen.getByText('Pinecone (Vector DB)')).toBeInTheDocument()
  })

  it('valid integration shows green badge', () => {
    render(
      <IntegrationsSettings
        keys={mockKeys}
        isLoading={false}
        onUpdate={vi.fn()}
        onValidate={vi.fn()}
      />,
    )
    expect(screen.getByText('Valid ✓')).toBeInTheDocument()
  })

  it('unchecked integration shows "Unchecked" badge', () => {
    render(
      <IntegrationsSettings
        keys={mockKeys}
        isLoading={false}
        onUpdate={vi.fn()}
        onValidate={vi.fn()}
      />,
    )
    expect(screen.getByText(/unchecked/i)).toBeInTheDocument()
  })

  it('Validate button calls onValidate with service name', async () => {
    const onValidate = vi
      .fn()
      .mockResolvedValue({ valid: true, message: 'Valid' })
    render(
      <IntegrationsSettings
        keys={mockKeys}
        isLoading={false}
        onUpdate={vi.fn()}
        onValidate={onValidate}
      />,
    )
    const validateBtns = screen.getAllByRole('button', { name: /validate/i })
    fireEvent.click(validateBtns[0])
    await waitFor(() => expect(onValidate).toHaveBeenCalledWith('anthropic'))
  })

  it('security note visible at bottom of page', () => {
    render(
      <IntegrationsSettings
        keys={mockKeys}
        isLoading={false}
        onUpdate={vi.fn()}
        onValidate={vi.fn()}
      />,
    )
    expect(screen.getByText(/AES-256/i)).toBeInTheDocument()
  })

  it('masked API key value shown in input', () => {
    render(
      <IntegrationsSettings
        keys={mockKeys}
        isLoading={false}
        onUpdate={vi.fn()}
        onValidate={vi.fn()}
      />,
    )
    expect(
      screen.getByDisplayValue('sk-ant-••••••••1234'),
    ).toBeInTheDocument()
  })
})
