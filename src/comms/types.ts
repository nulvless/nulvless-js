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
export type TemplateLanguage = 'en-US' | 'pt-BR' | 'pt-PT'

export interface TemplateTranslation {
  language: TemplateLanguage
  subject?: string
  content?: string
  last_submission?: string
  created_at?: string
  updated_at?: string
}

export interface Template {
  slug: string
  channel: NotificationChannel
  name?: string
  description?: string
  url?: string
  config?: Record<string, unknown>
  common: boolean
  customized: boolean
  translations: TemplateTranslation[]
  created_at?: string
  updated_at?: string
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
  url?: string
  config?: Record<string, unknown>
}

export interface TranslationParams {
  subject?: string
  content: string
}

export interface TemplateFilters {
  page?: number
  page_size?: number
  sort?: 'asc' | 'desc'
  channel?: NotificationChannel
  authored?: boolean
}

export interface PaginatedTemplates {
  items: Template[]
  page?: number
  page_size?: number
  total?: number
  sort?: 'asc' | 'desc'
}
