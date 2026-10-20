import { createServerClient } from '../../index'
import type { NulvlessServerClient } from '../../client'
import { mockFetch } from '../../tests/support/fetch'
import { expectRequest } from '../../tests/support/requests'
import type { ExpectedRequest } from '../../tests/support/requests'

type Call = (client: NulvlessServerClient) => Promise<unknown>

const phone = { country_code: '+55', number: '11999999999' }

describe('comms', () => {
  it.each<[string, Call, ExpectedRequest]>([
    ['email.send', c => c.comms.email.send({ to: 'a@b.co', template: 'welcome', params: { name: 'Ana' } }), {
      method: 'POST', path: '/notifications/email/welcome', body: { email: 'a@b.co', params: { name: 'Ana' } },
    }],
    ['email.send in a language', c => c.comms.email.send({ to: 'a@b.co', template: 'welcome', language: 'pt-BR' }), {
      method: 'POST', path: '/notifications/email/welcome/pt-BR', body: { email: 'a@b.co' },
    }],
    ['email.test', c => c.comms.email.test('a@b.co'), {
      method: 'POST', path: '/notifications/test/email', body: { email: 'a@b.co' },
    }],
    ['sms.send', c => c.comms.sms.send({ phone, template: 'code', params: { code: '1' } }), {
      method: 'POST', path: '/notifications/sms/code', body: { phone, params: { code: '1' } },
    }],
    ['sms.send in a language', c => c.comms.sms.send({ phone, template: 'code', language: 'en-US' }), {
      method: 'POST', path: '/notifications/sms/code/en-US', body: { phone },
    }],
    ['sms.test', c => c.comms.sms.test('a@b.co'), {
      method: 'POST', path: '/notifications/test/sms', body: { email: 'a@b.co' },
    }],
    ['templates.create', c => c.comms.templates.create({ slug: 'welcome', channel: 'email', language: 'en-US', content: 'Hi' }), {
      method: 'POST', path: '/templates', body: { slug: 'welcome', channel: 'email', language: 'en-US', content: 'Hi' },
    }],
    ['templates.update', c => c.comms.templates.update('email', 'welcome', { subject: 'Hello' }), {
      method: 'PATCH', path: '/templates/email/welcome', body: { subject: 'Hello' },
    }],
    ['templates.update in a language', c => c.comms.templates.update('email', 'welcome', { subject: 'Olá' }, 'pt-BR'), {
      method: 'PATCH', path: '/templates/email/welcome/pt-BR', body: { subject: 'Olá' },
    }],
    ['templates.delete', c => c.comms.templates.delete('sms', 'code'), { method: 'DELETE', path: '/templates/sms/code' }],
    ['templates.delete in a language', c => c.comms.templates.delete('sms', 'code', 'pt-BR'), {
      method: 'DELETE', path: '/templates/sms/code/pt-BR',
    }],
    ['templates.get', c => c.comms.templates.get('webhook', 'order'), { method: 'GET', path: '/templates/webhook/order' }],
    ['templates.get in a language', c => c.comms.templates.get('webhook', 'order', 'en-US'), {
      method: 'GET', path: '/templates/webhook/order/en-US',
    }],
    ['templates.list', c => c.comms.templates.list({ page: 0, page_size: 20, sort: 'desc', channel: 'email', language: 'pt-BR' }), {
      method: 'GET',
      path: '/templates',
      query: { page: '0', page_size: '20', sort: 'desc', channel: 'email', language: 'pt-BR' },
    }],
    ['templates.list without filters', c => c.comms.templates.list(), { method: 'GET', path: '/templates' }],
  ])('%s', async (_name, call, expected) => {
    const { lastRequest } = mockFetch()

    await call(createServerClient('https://app.nulvless.co', 'sk_test'))

    expectRequest(lastRequest(), '/comms', expected)
  })
})
