import type { Phone, Language } from '../types'

export interface SendEmailParams {
  /** Recipient address. */
  to: string
  /** Template slug — e.g. `"welcome"`, `"password-reset"`. */
  template: string
  /** Language variant of the template. Uses platform default when omitted. */
  language?: Language
  /** Variables injected into the template. */
  params?: Record<string, unknown>
}

export interface SendSMSParams {
  phone: Phone
  /** Template slug. */
  template: string
  /** Language variant of the template. Uses platform default when omitted. */
  language?: Language
  /** Variables injected into the template. */
  params?: Record<string, unknown>
}

export type NotificationChannel = 'email' | 'sms' | 'webhook'
export type TemplateLanguage = 'en-US' | 'pt-BR'

export interface Template {
  id: string
  name?: string
  description?: string
  slug: string
  channel: NotificationChannel
  subject?: string
  content: string
  url?: string
  config?: Record<string, unknown>
  language: TemplateLanguage
  last_submission?: string
  /** `true` when this is a platform-level common template, not a custom one. */
  common: boolean
  created_at: string
  updated_at: string
}

export interface CreateTemplateParams {
  slug: string
  channel: NotificationChannel
  content: string
  language: TemplateLanguage
  name?: string
  description?: string
  /** Email subject. Required for `email` channel. */
  subject?: string
  /** Webhook URL. Required for `webhook` channel. */
  url?: string
  config?: Record<string, unknown>
}

export interface UpdateTemplateParams {
  name?: string
  description?: string
  subject?: string
  content?: string
  url?: string
  config?: Record<string, unknown>
}

export interface TemplateFilters {
  page?: number
  page_size?: number
  sort?: 'asc' | 'desc'
  channel?: NotificationChannel
  language?: TemplateLanguage
}

export interface PaginatedTemplates {
  items: Template[]
  page?: number
  page_size?: number
  total?: number
  sort?: 'asc' | 'desc'
}
