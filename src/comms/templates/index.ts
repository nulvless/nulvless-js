import type { HttpClient } from '../../http'
import { route } from '../../http'
import type { NulvlessResult, RequestOptions } from '../../types'
import type {
  CreateTemplateParams,
  NotificationChannel,
  PaginatedTemplates,
  Template,
  TemplateFilters,
  TemplateLanguage,
  UpdateTemplateParams,
} from '../types'

function templatePath(channel: NotificationChannel, slug: string, language?: TemplateLanguage): string {
  return language ? route`/templates/${channel}/${slug}/${language}` : route`/templates/${channel}/${slug}`
}

/**
 * Template management for the notifications service.
 *
 * Available on `createServerClient` only (requires private key).
 *
 * @example
 * const { data } = await nulvless.comms.templates.create({
 *   slug: 'welcome',
 *   channel: 'email',
 *   language: 'en-US',
 *   subject: 'Welcome!',
 *   content: '<h1>Hello {{name}}</h1>',
 * })
 */
export class TemplatesClient {
  constructor(private readonly http: HttpClient) {}

  /**
   * Creates a new notification template.
   *
   * - `email` channel: `subject` required, `url` not allowed.
   * - `sms` channel: `subject` and `url` not allowed.
   * - `webhook` channel: `url` required, `subject` not allowed.
   */
  create(params: CreateTemplateParams, options?: RequestOptions): Promise<NulvlessResult<Template>> {
    return this.http.post<Template>('/templates', params, options)
  }

  /**
   * Updates an existing template.
   *
   * `language` defaults to `'en-US'` when omitted.
   *
   * @example
   * await nulvless.comms.templates.update('email', 'welcome', { subject: 'Welcome aboard!' })
   */
  update(
    channel: NotificationChannel,
    slug: string,
    params: UpdateTemplateParams,
    language?: TemplateLanguage,
    options?: RequestOptions,
  ): Promise<NulvlessResult<Template>> {
    return this.http.patch<Template>(templatePath(channel, slug, language), params, options)
  }

  /**
   * Deletes a template.
   *
   * `language` defaults to `'en-US'` when omitted.
   */
  delete(
    channel: NotificationChannel,
    slug: string,
    language?: TemplateLanguage,
    options?: RequestOptions,
  ): Promise<NulvlessResult<Template>> {
    return this.http.delete<Template>(templatePath(channel, slug, language), options)
  }

  /**
   * Returns a template by channel and slug, falling back to the common template
   * if no custom one exists.
   *
   * `language` defaults to `'en-US'` when omitted.
   *
   * The response includes `common: true` when the returned template is the
   * platform-level fallback rather than a custom override.
   */
  get(
    channel: NotificationChannel,
    slug: string,
    language?: TemplateLanguage,
    options?: RequestOptions,
  ): Promise<NulvlessResult<Template>> {
    return this.http.get<Template>(templatePath(channel, slug, language), options)
  }

  /**
   * Returns a paginated list of templates, optionally filtered by channel and language.
   *
   * @example
   * const { data } = await nulvless.comms.templates.list({ channel: 'email', page_size: 20 })
   */
  list(filters?: TemplateFilters, options?: RequestOptions): Promise<NulvlessResult<PaginatedTemplates>> {
    return this.http.get<PaginatedTemplates>('/templates', {
      ...options,
      query: {
        ...(filters?.page !== undefined ? { page: filters.page } : {}),
        ...(filters?.page_size !== undefined ? { page_size: filters.page_size } : {}),
        ...(filters?.sort ? { sort: filters.sort } : {}),
        ...(filters?.channel ? { channel: filters.channel } : {}),
        ...(filters?.language ? { language: filters.language } : {}),
      },
    })
  }
}
