import { createServerClient } from '../../index'
import type { NulvlessServerClient } from '../../client'
import { mockFetch } from '../../tests/support/fetch'
import { expectRequest } from '../../tests/support/requests'
import type { ExpectedRequest } from '../../tests/support/requests'

type Call = (client: NulvlessServerClient) => Promise<unknown>

const user = { headers: { Authorization: 'Bearer user-token' } }
const phone = { country_code: '+55', number: '11999999999' }

function run(cases: Array<[string, Call, ExpectedRequest]>): void {
  it.each(cases)('%s', async (_name, call, expected) => {
    const { lastRequest } = mockFetch()

    await call(createServerClient('https://app.nulvless.co', 'sk_test'))

    expectRequest(lastRequest(), '/auth', expected)
  })
}

describe('auth', () => {
  run([
    ['signUp', c => c.auth.signUp({ email: 'a@b.co', password: 'pw' }), {
      method: 'POST', path: '/signup', body: { email: 'a@b.co', password: 'pw' },
    }],
    ['signIn', c => c.auth.signIn({ username: 'ana', password: 'pw' }), {
      method: 'POST', path: '/token', query: { grant_type: 'password' }, body: { username: 'ana', password: 'pw' },
    }],
    ['signInWithOTP', c => c.auth.signInWithOTP({ phone }), {
      method: 'POST', path: '/otp', body: { phone },
    }],
    ['lookup', c => c.auth.lookup({ email: 'a@b.co' }), {
      method: 'POST', path: '/lookup', body: { email: 'a@b.co' },
    }],
    ['authorize', c => c.auth.authorize('google', { redirect_uri: 'https://app.co/cb' }), {
      method: 'GET', path: '/oauth/google/authorize', query: { redirect_uri: 'https://app.co/cb' },
    }],
    ['authorize without redirect', c => c.auth.authorize('github'), {
      method: 'GET', path: '/oauth/github/authorize',
    }],
    ['connect', c => c.auth.connect('github', { ...user, redirect_uri: 'https://app.co/settings' }), {
      method: 'GET', path: '/oauth/github/connect', query: { redirect_uri: 'https://app.co/settings' },
    }],
    ['signInWithIdToken', c => c.auth.signInWithIdToken('apple', 'id-token'), {
      method: 'GET', path: '/signin/apple/id_token', query: { id_token: 'id-token' },
    }],
    ['exchangeCodeForToken', c => c.auth.exchangeCodeForToken('the-code'), {
      method: 'POST', path: '/token', query: { grant_type: 'authorization_code' }, body: 'code=the-code',
    }],
    ['verifyChallenge', c => c.auth.verifyChallenge({ token: 't', code: '123456' }), {
      method: 'POST', path: '/challenges/verify', body: { token: 't', code: '123456' },
    }],
    ['activate', c => c.auth.activate('activation-token'), {
      method: 'GET', path: '/activate', query: { token: 'activation-token' },
    }],
    ['refreshToken', c => c.auth.refreshToken({ refresh_token: 'rt' }), {
      method: 'POST', path: '/token', query: { grant_type: 'refresh_token' }, body: { refresh_token: 'rt' },
    }],
    ['recover', c => c.auth.recover({ email: 'a@b.co' }, { redirect_uri: 'https://app.co/reset' }), {
      method: 'POST', path: '/recover', body: { email: 'a@b.co', redirect_uri: 'https://app.co/reset' },
    }],
    ['resetPassword', c => c.auth.resetPassword({ token: 't', password: 'new' }), {
      method: 'POST', path: '/recover/reset-password', body: { token: 't', password: 'new' },
    }],
    ['verify', c => c.auth.verify({
      resource: 'project-1', scopes: ['read', 'write'], roles: ['owner'], reject_assurance_level_error: false,
    }, user), {
      method: 'GET',
      path: '/session/validate',
      query: { resource: 'project-1', scopes: 'read write', roles: 'owner', reject_assurance_level_error: 'false' },
    }],
    ['verify without a grant', c => c.auth.verify(undefined, user), {
      method: 'GET', path: '/session/validate',
    }],
    ['getSession', c => c.auth.getSession(user), { method: 'GET', path: '/session' }],
    ['getMethods', c => c.auth.getMethods(user), { method: 'GET', path: '/methods' }],
    ['signOut', c => c.auth.signOut('global', user), {
      method: 'POST', path: '/signout', query: { scope: 'global' },
    }],
    ['signOut with the default scope', c => c.auth.signOut(undefined, user), {
      method: 'POST', path: '/signout',
    }],
  ])
})

describe('auth.factors', () => {
  run([
    ['list', c => c.auth.factors.list(user), { method: 'GET', path: '/factors' }],
    ['getRecoveryCodes', c => c.auth.factors.getRecoveryCodes({ nonce: 'n' }, user), {
      method: 'GET', path: '/factors/codes', nonce: 'n',
    }],
    ['deleteRecoveryCodes', c => c.auth.factors.deleteRecoveryCodes({ nonce: 'n' }, user), {
      method: 'DELETE', path: '/factors/codes', nonce: 'n',
    }],
    ['enroll', c => c.auth.factors.enroll({ type: 'totp', name: 'Phone', nonce: 'n' }, user), {
      method: 'POST', path: '/factors/totp', body: { name: 'Phone' }, nonce: 'n',
    }],
    ['enroll without a name', c => c.auth.factors.enroll({ type: 'sms_otp' }, user), {
      method: 'POST', path: '/factors/sms_otp', body: {},
    }],
    ['enable', c => c.auth.factors.enable({ token: 't', code: '123456' }, user), {
      method: 'POST', path: '/factors', body: { token: 't', code: '123456' },
    }],
    ['unenroll', c => c.auth.factors.unenroll({ id: 'factor-1', nonce: 'n' }, user), {
      method: 'DELETE', path: '/factors/factor-1', nonce: 'n',
    }],
  ])
})

describe('auth.users', () => {
  run([
    ['me', c => c.auth.users.me(user), { method: 'GET', path: '/users/me' }],
    ['update', c => c.auth.users.update({ username: 'ana' }, user), {
      method: 'PATCH', path: '/users', body: { username: 'ana' },
    }],
    ['getIdentities', c => c.auth.users.getIdentities('email', user), {
      method: 'GET', path: '/users/identities', query: { type: 'email' },
    }],
    ['getIdentities of every type', c => c.auth.users.getIdentities(undefined, user), {
      method: 'GET', path: '/users/identities',
    }],
    ['addEmailIdentity', c => c.auth.users.addEmailIdentity({ email: 'a@b.co', nonce: 'n' }, user), {
      method: 'POST', path: '/users/identities/emails', body: { email: 'a@b.co' }, nonce: 'n',
    }],
    ['addPhoneIdentity', c => c.auth.users.addPhoneIdentity({ phone, nonce: 'n' }, user), {
      method: 'POST', path: '/users/identities/phones', body: phone, nonce: 'n',
    }],
    ['verifyIdentity', c => c.auth.users.verifyIdentity({ token: 't', code: '1' }, user), {
      method: 'POST', path: '/users/identities/verify', body: { token: 't', code: '1' },
    }],
    ['updateIdentity', c => c.auth.users.updateIdentity({ id: 'id-1', primary: true, nonce: 'n' }, user), {
      method: 'PATCH', path: '/users/identities/id-1', body: { primary: true }, nonce: 'n',
    }],
    ['removeIdentity', c => c.auth.users.removeIdentity({ id: 'id-1', nonce: 'n' }, user), {
      method: 'DELETE', path: '/users/identities/id-1', nonce: 'n',
    }],
    ['sendOTPToUpdateEmail', c => c.auth.users.sendOTPToUpdateEmail({ email: 'a@b.co', nonce: 'n' }, user), {
      method: 'POST', path: '/users/emails/code/send', body: { email: 'a@b.co' }, nonce: 'n',
    }],
    ['confirmEmailUpdate', c => c.auth.users.confirmEmailUpdate({ token: 't', code: '1' }, user), {
      method: 'PATCH', path: '/users/emails/code/confirm', body: { token: 't', code: '1' },
    }],
    ['sendOTPToUpdatePhone', c => c.auth.users.sendOTPToUpdatePhone({ phone, nonce: 'n' }, user), {
      method: 'POST', path: '/users/phones/code/send', body: phone, nonce: 'n',
    }],
    ['confirmPhoneUpdate', c => c.auth.users.confirmPhoneUpdate({ token: 't', code: '1' }, user), {
      method: 'PATCH', path: '/users/phones/code/confirm', body: { token: 't', code: '1' },
    }],
  ])
})

describe('auth.sessions', () => {
  run([
    ['list', c => c.auth.sessions.list(user), { method: 'GET', path: '/sessions' }],
    ['revoke', c => c.auth.sessions.revoke({ id: 'session-1', nonce: 'n' }, user), {
      method: 'DELETE', path: '/sessions/session-1', nonce: 'n',
    }],
    ['sudo', c => c.auth.sessions.sudo('email_otp', user), {
      method: 'GET', path: '/sessions/sudo/request', query: { method: 'email_otp' },
    }],
    ['sudo with the default method', c => c.auth.sessions.sudo(undefined, user), {
      method: 'GET', path: '/sessions/sudo/request',
    }],
    ['sudoVerify', c => c.auth.sessions.sudoVerify({ code: '123456' }, user), {
      method: 'POST', path: '/sessions/sudo/verify', body: { code: '123456' },
    }],
    ['checkSudo', c => c.auth.sessions.checkSudo({ nonce: 'n' }, user), {
      method: 'GET', path: '/sessions/sudo', nonce: 'n',
    }],
  ])
})

describe('auth.security', () => {
  run([
    ['changePassword', c => c.auth.security.changePassword({ password: 'old', new_password: 'new', nonce: 'n' }, user), {
      method: 'PUT', path: '/security/password', body: { password: 'old', new_password: 'new' }, nonce: 'n',
    }],
  ])
})

describe('auth.challenges', () => {
  run([
    ['create', c => c.auth.challenges.create('totp', user), { method: 'POST', path: '/challenges/totp' }],
    ['get', c => c.auth.challenges.get('t'), { method: 'GET', path: '/challenges', query: { token: 't' } }],
    ['change', c => c.auth.challenges.change({ token: 't', type: 'sms_otp' }), {
      method: 'PATCH', path: '/challenges/sms_otp', body: { token: 't' },
    }],
    ['verify', c => c.auth.challenges.verify({ token: 't', code: '1' }), {
      method: 'POST', path: '/challenges/verify', body: { token: 't', code: '1' },
    }],
  ])
})

describe('auth.grants', () => {
  const invites = [{ email: 'a@b.co', scopes: ['read'] }]

  run([
    ['list', c => c.auth.grants.list('org', user), { method: 'GET', path: '/grants', query: { context: 'org' } }],
    ['list every context', c => c.auth.grants.list(undefined, user), { method: 'GET', path: '/grants' }],
    ['getMembers', c => c.auth.grants.getMembers('project-1', user), {
      method: 'GET', path: '/grants/members', query: { resource: 'project-1' },
    }],
    ['invite', c => c.auth.grants.invite(
      { resource: 'project-1', invites, nonce: 'n' },
      { ...user, redirect_uri: 'https://app.co/accept' },
    ), {
      method: 'POST',
      path: '/grants/invites',
      body: { resource: 'project-1', invites, redirect_uri: 'https://app.co/accept' },
      nonce: 'n',
    }],
    ['get', c => c.auth.grants.get('grant-1', user), { method: 'GET', path: '/grants/grant-1' }],
    ['revoke', c => c.auth.grants.revoke({ id: 'grant-1', nonce: 'n' }, user), {
      method: 'DELETE', path: '/grants/grant-1/revoke', nonce: 'n',
    }],
    ['accept', c => c.auth.grants.accept('grant-1', user), { method: 'PATCH', path: '/grants/grant-1/accept' }],
    ['cancel', c => c.auth.grants.cancel('grant-1', user), { method: 'PATCH', path: '/grants/grant-1/cancel' }],
    ['block', c => c.auth.grants.block({ id: 'grant-1', nonce: 'n' }, user), {
      method: 'PATCH', path: '/grants/grant-1/block', nonce: 'n',
    }],
    ['update', c => c.auth.grants.update('grant-1', { scopes: ['read'], nonce: 'n' }, user), {
      method: 'PATCH', path: '/grants/grant-1', body: { scopes: ['read'] }, nonce: 'n',
    }],
    ['leave', c => c.auth.grants.leave({ id: 'grant-1', nonce: 'n' }, user), {
      method: 'PATCH', path: '/grants/grant-1/leave', nonce: 'n',
    }],
  ])
})

describe('auth.oauth', () => {
  run([
    ['exchangeCodeForToken', c => c.auth.oauth.exchangeCodeForToken({ code: 'c', code_verifier: 'v' }), {
      method: 'POST',
      path: '/oauth/token',
      body: { grant_type: 'authorization_code', code: 'c', code_verifier: 'v' },
      apiKey: false,
    }],
    ['refreshToken', c => c.auth.oauth.refreshToken({ refresh_token: 'rt', client_id: 'app' }), {
      method: 'POST',
      path: '/oauth/token',
      body: { grant_type: 'refresh_token', refresh_token: 'rt', client_id: 'app' },
      apiKey: false,
    }],
    ['register', c => c.auth.oauth.register({
      client_type: 'public', token_endpoint_auth_method: 'none', redirect_uris: ['https://app.co/cb'], grant_types: ['authorization_code'],
    }), {
      method: 'POST',
      path: '/oauth/register',
      body: {
        client_type: 'public', token_endpoint_auth_method: 'none', redirect_uris: ['https://app.co/cb'], grant_types: ['authorization_code'],
      },
      apiKey: false,
    }],
    ['getAuthorization', c => c.auth.oauth.getAuthorization('authz-1', user), {
      method: 'GET', path: '/oauth/authorizations/authz-1',
    }],
    ['consent', c => c.auth.oauth.consent('authz-1', 'approve', user), {
      method: 'POST', path: '/oauth/authorizations/authz-1/consent', body: { action: 'approve' },
    }],
    ['userinfo', c => c.auth.oauth.userinfo(user), { method: 'GET', path: '/oauth/userinfo' }],
    ['discovery', c => c.auth.oauth.discovery(), {
      method: 'GET', path: '/.well-known/openid-configuration', apiKey: false,
    }],
    ['jwks', c => c.auth.oauth.jwks(), { method: 'GET', path: '/.well-known/jwks.json', apiKey: false }],
    ['grants.list', c => c.auth.oauth.grants.list(user), { method: 'GET', path: '/user/oauth/grants' }],
    ['grants.revoke', c => c.auth.oauth.grants.revoke('client-1', user), {
      method: 'DELETE', path: '/user/oauth/grants', query: { client_id: 'client-1' },
    }],
  ])
})

describe('auth.admin', () => {
  const app = {
    client_type: 'confidential' as const,
    token_endpoint_auth_method: 'client_secret_post' as const,
    redirect_uris: ['https://app.co/cb'],
    grant_types: ['authorization_code' as const],
  }

  run([
    ['getPlatform', c => c.auth.admin.getPlatform(), { method: 'GET', path: '/admin/platform' }],
    ['users.create', c => c.auth.admin.users.create({ email: 'a@b.co' }), {
      method: 'POST', path: '/admin/users', body: { email: 'a@b.co' },
    }],
    ['users.create verified', c => c.auth.admin.users.create({ email: 'a@b.co', email_verified: true }), {
      method: 'POST', path: '/admin/users', body: { email: 'a@b.co', email_verified: true },
    }],
    ['users.list', c => c.auth.admin.users.list({ page: 1, is_banned: true }), {
      method: 'GET', path: '/admin/users', query: { page: '1', is_banned: 'true' },
    }],
    ['users.list without filters', c => c.auth.admin.users.list(), { method: 'GET', path: '/admin/users' }],
    ['users.get', c => c.auth.admin.users.get('user-1'), { method: 'GET', path: '/admin/users/user-1' }],
    ['users.update', c => c.auth.admin.users.update('user-1', { username: 'ana' }), {
      method: 'PATCH', path: '/admin/users/user-1', body: { username: 'ana' },
    }],
    ['users.delete', c => c.auth.admin.users.delete('user-1'), { method: 'DELETE', path: '/admin/users/user-1' }],
    ['users.ban', c => c.auth.admin.users.ban('user-1'), { method: 'PATCH', path: '/admin/users/user-1/ban' }],
    ['users.unban', c => c.auth.admin.users.unban('user-1'), { method: 'PATCH', path: '/admin/users/user-1/unban' }],
    ['users.getSessions', c => c.auth.admin.users.getSessions('user-1'), {
      method: 'GET', path: '/admin/users/user-1/sessions',
    }],
    ['users.signOutAll', c => c.auth.admin.users.signOutAll('user-1'), {
      method: 'DELETE', path: '/admin/users/user-1/sessions',
    }],
    ['users.revokeSession', c => c.auth.admin.users.revokeSession('user-1', 'session-1'), {
      method: 'DELETE', path: '/admin/users/user-1/sessions/session-1',
    }],
    ['users.getFactors', c => c.auth.admin.users.getFactors('user-1'), {
      method: 'GET', path: '/admin/users/user-1/factors',
    }],
    ['users.removeFactor', c => c.auth.admin.users.removeFactor('user-1', 'factor-1'), {
      method: 'DELETE', path: '/admin/users/user-1/factors/factor-1',
    }],
    ['roles.list', c => c.auth.admin.roles.list('org'), { method: 'GET', path: '/admin/roles', query: { context: 'org' } }],
    ['roles.list every context', c => c.auth.admin.roles.list(), { method: 'GET', path: '/admin/roles' }],
    ['roles.create', c => c.auth.admin.roles.create({ name: 'Owner', key: 'owner', context: 'org', scopes: ['*'] }), {
      method: 'POST', path: '/admin/roles', body: { name: 'Owner', key: 'owner', context: 'org', scopes: ['*'] },
    }],
    ['roles.update', c => c.auth.admin.roles.update('role-1', { name: 'Admin' }), {
      method: 'PATCH', path: '/admin/roles/role-1', body: { name: 'Admin' },
    }],
    ['roles.delete', c => c.auth.admin.roles.delete('role-1'), { method: 'DELETE', path: '/admin/roles/role-1' }],
    ['grants.list', c => c.auth.admin.grants.list({ resource: 'project-1' }), {
      method: 'GET', path: '/admin/grants', query: { resource: 'project-1' },
    }],
    ['grants.list without filters', c => c.auth.admin.grants.list(), { method: 'GET', path: '/admin/grants' }],
    ['grants.set', c => c.auth.admin.grants.set({ resource: 'project-1', granted_to_user_id: 'user-1' }), {
      method: 'POST', path: '/admin/grants', body: { resource: 'project-1', granted_to_user_id: 'user-1' },
    }],
    ['grants.delete', c => c.auth.admin.grants.delete('grant-1'), { method: 'DELETE', path: '/admin/grants/grant-1' }],
    ['grants.deleteByResource', c => c.auth.admin.grants.deleteByResource('org:1/project'), {
      method: 'DELETE', path: '/admin/resources/org%3A1%2Fproject/grants',
    }],
    ['oauthClients.create', c => c.auth.admin.oauthClients.create(app), {
      method: 'POST', path: '/admin/oauth/clients', body: app,
    }],
    ['oauthClients.list', c => c.auth.admin.oauthClients.list(), { method: 'GET', path: '/admin/oauth/clients' }],
    ['oauthClients.get', c => c.auth.admin.oauthClients.get('app-1'), {
      method: 'GET', path: '/admin/oauth/clients/app-1',
    }],
    ['oauthClients.update', c => c.auth.admin.oauthClients.update('app-1', { client_name: 'App' }), {
      method: 'PUT', path: '/admin/oauth/clients/app-1', body: { client_name: 'App' },
    }],
    ['oauthClients.delete', c => c.auth.admin.oauthClients.delete('app-1'), {
      method: 'DELETE', path: '/admin/oauth/clients/app-1',
    }],
    ['oauthClients.regenerateSecret', c => c.auth.admin.oauthClients.regenerateSecret('app-1'), {
      method: 'POST', path: '/admin/oauth/clients/app-1/regenerate_secret',
    }],
  ])
})
