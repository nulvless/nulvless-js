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
  TranslationParams,
  UpdateTemplateParams,
} from '../types'

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
   * Updates the name, description, URL or config of a template.
   *
   * @example
   * await nulvless.comms.templates.update('email', 'welcome', { name: 'Welcome' })
   */
  update(
    channel: NotificationChannel,
    slug: string,
    params: UpdateTemplateParams,
    options?: RequestOptions,
  ): Promise<NulvlessResult<Template>> {
    return this.http.patch<Template>(route`/templates/${channel}/${slug}`, params, options)
  }

  /**
   * Creates or replaces a template translation.
   *
   * @example
   * await nulvless.comms.templates.putTranslation('email', 'welcome', 'pt-BR', { subject: 'Olá!', content: '<h1>Olá {{name}}</h1>' })
   */
  putTranslation(
    channel: NotificationChannel,
    slug: string,
    language: TemplateLanguage,
    params: TranslationParams,
    options?: RequestOptions,
  ): Promise<NulvlessResult<Template>> {
    return this.http.put<Template>(route`/templates/${channel}/${slug}/${language}`, params, options)
  }

  /**
   * Deletes a template translation.
   *
   * @example
   * await nulvless.comms.templates.deleteTranslation('email', 'welcome', 'pt-BR')
   */
  deleteTranslation(
    channel: NotificationChannel,
    slug: string,
    language: TemplateLanguage,
    options?: RequestOptions,
  ): Promise<NulvlessResult<Template>> {
    return this.http.delete<Template>(route`/templates/${channel}/${slug}/${language}`, options)
  }

  /**
   * Deletes a template and its translations.
   *
   * @example
   * await nulvless.comms.templates.delete('email', 'welcome')
   */
  delete(channel: NotificationChannel, slug: string, options?: RequestOptions): Promise<NulvlessResult<Template>> {
    return this.http.delete<Template>(route`/templates/${channel}/${slug}`, options)
  }

  /**
   * Returns a template by channel and slug, falling back to the common template
   * if no custom one exists.
   *
   * @example
   * const { data } = await nulvless.comms.templates.get('email', 'welcome')
   */
  get(channel: NotificationChannel, slug: string, options?: RequestOptions): Promise<NulvlessResult<Template>> {
    return this.http.get<Template>(route`/templates/${channel}/${slug}`, options)
  }

  /**
   * Returns a paginated list of templates, optionally filtered by channel.
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
        ...(filters?.authored ? { authored: filters.authored } : {}),
      },
    })
  }
}
