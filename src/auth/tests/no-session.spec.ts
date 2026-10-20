import { createClient, createServerClient } from '../../index'
import { MemoryStorageAdapter } from '../../storage/adapters/memory'
import { mockFetch } from '../../tests/support/fetch'

type Call = (auth: ReturnType<typeof createServerClient>['auth']) => Promise<{ error: { code: string } | null }>

describe('authenticated methods without a session', () => {
  it.each<[string, Call]>([
    ['factors.list', auth => auth.factors.list()],
    ['factors.getRecoveryCodes', auth => auth.factors.getRecoveryCodes()],
    ['factors.deleteRecoveryCodes', auth => auth.factors.deleteRecoveryCodes()],
    ['factors.enroll', auth => auth.factors.enroll({ type: 'totp' })],
    ['factors.enable', auth => auth.factors.enable({ token: 't', code: '1' })],
    ['factors.unenroll', auth => auth.factors.unenroll({ id: 'f' })],
    ['users.me', auth => auth.users.me()],
    ['users.update', auth => auth.users.update({})],
    ['users.getIdentities', auth => auth.users.getIdentities()],
    ['users.addEmailIdentity', auth => auth.users.addEmailIdentity({ email: 'a@b.co' })],
    ['users.addPhoneIdentity', auth => auth.users.addPhoneIdentity({ phone: { country_code: '+1', number: '5' } })],
    ['users.verifyIdentity', auth => auth.users.verifyIdentity({ token: 't', code: '1' })],
    ['users.updateIdentity', auth => auth.users.updateIdentity({ id: 'i', primary: true })],
    ['users.removeIdentity', auth => auth.users.removeIdentity({ id: 'i' })],
    ['users.sendOTPToUpdateEmail', auth => auth.users.sendOTPToUpdateEmail({ email: 'a@b.co' })],
    ['users.confirmEmailUpdate', auth => auth.users.confirmEmailUpdate({ token: 't', code: '1' })],
    ['users.sendOTPToUpdatePhone', auth => auth.users.sendOTPToUpdatePhone({ phone: { country_code: '+1', number: '5' } })],
    ['users.confirmPhoneUpdate', auth => auth.users.confirmPhoneUpdate({ token: 't', code: '1' })],
    ['sessions.list', auth => auth.sessions.list()],
    ['sessions.revoke', auth => auth.sessions.revoke({ id: 's' })],
    ['sessions.sudo', auth => auth.sessions.sudo()],
    ['sessions.sudoVerify', auth => auth.sessions.sudoVerify({ code: '1' })],
    ['sessions.checkSudo', auth => auth.sessions.checkSudo()],
    ['security.changePassword', auth => auth.security.changePassword({ password: 'a', new_password: 'b' })],
    ['challenges.create', auth => auth.challenges.create({ type: 'totp' })],
    ['grants.list', auth => auth.grants.list()],
    ['grants.getMembers', auth => auth.grants.getMembers('r')],
    ['grants.invite', auth => auth.grants.invite({ resource: 'r', invites: [] })],
    ['grants.get', auth => auth.grants.get('g')],
    ['grants.revoke', auth => auth.grants.revoke({ id: 'g' })],
    ['grants.accept', auth => auth.grants.accept('g')],
    ['grants.cancel', auth => auth.grants.cancel('g')],
    ['grants.block', auth => auth.grants.block({ id: 'g' })],
    ['grants.update', auth => auth.grants.update('g', {})],
    ['grants.leave', auth => auth.grants.leave({ id: 'g' })],
    ['oauth.getAuthorization', auth => auth.oauth.getAuthorization('a')],
    ['oauth.consent', auth => auth.oauth.consent('a', 'deny')],
    ['oauth.userinfo', auth => auth.oauth.userinfo()],
    ['oauth.grants.list', auth => auth.oauth.grants.list()],
    ['oauth.grants.revoke', auth => auth.oauth.grants.revoke('c')],
  ])('%s fails with no_session without calling the API', async (_name, call) => {
    const { fetchMock } = mockFetch()

    const result = await call(createServerClient('https://app.nulvless.co', 'sk_test').auth)

    expect(result.error?.code).toBe('no_session')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('applies to the browser client as well', async () => {
    const { fetchMock } = mockFetch()
    const client = createClient('https://app.nulvless.co', 'pk_test', {
      storage: new MemoryStorageAdapter(),
      autoRefresh: false,
    })

    const result = await client.auth.getMethods()

    expect(result.error?.code).toBe('no_session')
    expect(fetchMock).not.toHaveBeenCalled()
    client.auth.dispose()
  })
})
