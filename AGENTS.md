# @nulvless/nulvless-js — Agent Instructions

Official TypeScript SDK for the Nulvless platform. User-facing documentation lives on [nulvless.com/docs/sdk](https://nulvless.com/docs/sdk), in the `nulvless-site` repository — not in this repo.

## Commands

```bash
npm run typecheck      # tsc --noEmit — run after every change
npm run lint           # eslint src
npm test               # jest — specs live in src/**/tests/*.spec.ts
npm run test:coverage  # jest with the thresholds from jest.config.cjs
npm run build          # tsup → dist/
```

Run `typecheck`, `lint` and `test` after editing any `.ts` file. CI runs all of them on Node 20, 22 and 24.

## Architecture

```
src/
  index.ts             # Public exports + createClient / createServerClient
  client.ts            # NulvlessClient (browser) / NulvlessServerClient (server), default storage
  http.ts              # HttpClient — fetch, headers, timeout, reactive token refresh, `route` tag
  types.ts             # NulvlessResult, NulvlessError, ClientOptions, RequestOptions
  auth/
    index.ts           # AuthClient, AuthBrowserClient, AuthServerClient
    base.ts            # resolveBearer + AuthSubClient
    types.ts           # Auth types and DTOs
    accounts.ts        # Multi-account store, extractUserId
    emitter.ts         # Auth events
    challenges/        # auth.challenges.*
    factors/           # auth.factors.*
    users/             # auth.users.*
    sessions/          # auth.sessions.* (sudo included)
    security/          # auth.security.*
    oauth/             # auth.oauth.* — OAuth 2.1 / OIDC provider
    grants/            # auth.grants.* (server only)
    admin/             # auth.admin.*  (server only)
  comms/               # comms.email.* / comms.sms.* / comms.templates.* (server only)
  session/
    manager.ts         # SessionManager — storage, renewal on use, scheduled renewal
    locks.ts           # Cross-tab lock (Web Locks, in-process fallback)
    tabChannel.ts      # BroadcastChannel wrapper
    refreshFailure.ts  # Temporary failure vs. refused session
    stored.ts          # Authenticated ⇄ StoredSession conversion
  storage/             # Storage adapters: Local, Session, Memory, Cache
  helpers/             # forwardUserHeaders, applyAuthCacheHeaders
  exceptions/          # NulvlessException
```

## Key patterns

**Client hierarchy**
- `AuthClient` — base, endpoints available to both keys and every shared sub-namespace.
- `AuthBrowserClient extends AuthClient` — session helpers, multi-account, events, `refreshSession`, `deselect`, `dispose`.
- `AuthServerClient extends AuthClient` — adds `auth.grants` and `auth.admin`.

**Bearer token resolution**
Every authenticated call goes through `resolveBearer` (`auth/base.ts`; sub-clients call it via `bearer(options)`):
1. An `Authorization` header already present — in `options.headers` or in the client-level `headers` option, any letter case — is used as is (server pattern).
2. Otherwise the `getToken()` callback injected at construction supplies it (browser pattern), and the call fails with `no_session` when there is none.

**NulvlessResult**
Every method that calls the API returns `NulvlessResult<T>` and never throws unless `throwErrors` is set:
```ts
type NulvlessResult<T> = { data: T; error: null } | { data: null; error: NulvlessError }
```

**Headers**
`HttpClient` merges defaults, client-level headers and request headers case-insensitively. Never build a header map by spreading objects that may carry the same header in different cases.

**Path parameters**
Build every path that interpolates a value with the `route` tag from `http.ts` (``route`/grants/${id}` ``) — it encodes each value as a single segment.

**`exactOptionalPropertyTypes: true`**
Do not assign `undefined` to optional fields. Use conditional spreads:
```ts
...(value ? { key: value } : {})
```

**`redirect_uri` convention**
Never add `redirect_uri` to param interfaces — it is passed via `options.redirect_uri`. Methods that need it in the body inject it explicitly:
```ts
{ ...params, ...(options?.redirect_uri ? { redirect_uri: options.redirect_uri } : {}) }
```

**Sudo nonce**
Params of sudo-protected methods extend `Nonce`; the method destructures `nonce` out of the body and passes it to `HttpClient`, which sends it as the `nlv-sudo-nonce` header.

## Routing

`createClient` and `createServerClient` set `baseUrl` to `${url}/auth` for auth calls and `${url}/notifications` for comms. The gateway strips the prefix before the request reaches the service.

| Auth service controller | SDK namespace |
|---|---|
| root (`/signup`, `/token`, `/session`, …) | `auth.*` |
| `/challenges` | `auth.challenges` (+ `auth.verifyChallenge`) |
| `/factors` | `auth.factors` |
| `/users` | `auth.users` |
| `/sessions` | `auth.sessions` |
| `/security` | `auth.security` |
| `/oauth`, `/user/oauth/grants`, `/.well-known/*` | `auth.oauth` |
| `/grants` | `auth.grants` |
| `/admin`, `/admin/oauth/clients` | `auth.admin` |

## Tests

Specs exercise the SDK through a mocked `fetch` (`src/tests/support/fetch.ts`) and assert the exact method, path, query, headers and body of each call. Endpoint mappings are table-driven (`src/auth/tests/endpoints.spec.ts`, `src/comms/tests/comms.spec.ts`) — add a row for every new method.

## Releases

Pushing a `vX.Y.Z` tag runs `.github/workflows/release.yml`, which publishes to npm through trusted publishing and creates the GitHub release from `CHANGELOG.md`. See `CONTRIBUTING.md`.
