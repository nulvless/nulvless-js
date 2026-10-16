import type { HttpClient } from '../http'
import { route } from '../http'
import type { NulvlessResult, RequestOptions } from '../types'
import type { SendEmailParams, SendSMSParams } from './types'
import { TemplatesClient } from './templates'

export class EmailClient {
  constructor(private readonly http: HttpClient) {}

  /**
   * Sends a transactional email using a pre-configured template.
   *
   * Returns `null` on success — the API responds with `200` and no body.
   *
   * @example
   * const { error } = await nulvless.comms.email.send({
   *   to: 'user@example.com',
   *   template: 'welcome',
   *   params: { name: 'Gleisson' },
   * })
   */
  send(params: SendEmailParams, options?: RequestOptions): Promise<NulvlessResult<null>> {
    const { to, template, language, params: templateParams } = params

    const path = language
      ? route`/notifications/email/${template}/${language}`
      : route`/notifications/email/${template}`

    return this.http.post<null>(path, { email: to, params: templateParams }, options)
  }

  /**
   * Sends a test email to validate the platform's email provider configuration.
   *
   * Returns `null` on success.
   *
   * @example
   * const { error } = await nulvless.comms.email.test('user@example.com')
   */
  test(email: string, options?: RequestOptions): Promise<NulvlessResult<null>> {
    return this.http.post<null>('/notifications/test/email', { email }, options)
  }
}

export class SmsClient {
  constructor(private readonly http: HttpClient) {}

  /**
   * Sends a transactional SMS using a pre-configured template.
   *
   * Returns `null` on success — the API responds with `200` and no body.
   *
   * @example
   * const { error } = await nulvless.comms.sms.send({
   *   phone: { country_code: '+55', number: '11999999999' },
   *   template: 'verification-code',
   *   params: { code: '123456' },
   * })
   */
  send(params: SendSMSParams, options?: RequestOptions): Promise<NulvlessResult<null>> {
    const { phone, template, language, params: templateParams } = params

    const path = language
      ? route`/notifications/sms/${template}/${language}`
      : route`/notifications/sms/${template}`

    return this.http.post<null>(path, { phone, params: templateParams }, options)
  }

  /**
   * Sends a test SMS to validate the platform's SMS provider configuration.
   *
   * Returns `null` on success.
   *
   * @example
   * const { error } = await nulvless.comms.sms.test('user@example.com')
   */
  test(email: string, options?: RequestOptions): Promise<NulvlessResult<null>> {
    return this.http.post<null>('/notifications/test/sms', { email }, options)
  }
}

export class CommsClient {
  readonly email: EmailClient
  readonly sms: SmsClient
  readonly templates: TemplatesClient

  constructor(http: HttpClient) {
    this.email = new EmailClient(http)
    this.sms = new SmsClient(http)
    this.templates = new TemplatesClient(http)
  }
}
