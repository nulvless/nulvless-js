# @nulvless/js — Agent Instructions

Official TypeScript SDK for the Nulvless platform.

## Commands

```bash
npm run typecheck   # tsc --noEmit — run after every change
npm run build       # tsup — produces dist/
npm run lint        # eslint src
npm test            # jest — specs live in src/**/tests/*.spec.ts
```

Always run `typecheck` after editing any `.ts` file. The build is clean when there is no output.

## Architecture

```
src/
  http.ts              # HttpClient — all fetch logic, timeout, retry, debug
  client.ts            # NulvlessClient (browser) / NulvlessServerClient (server)
  types.ts             # Shared types: NulvlessResult, RequestOptions, ClientOptions
  index.ts             # Public exports + createClient / createServerClient
  auth/
    index.ts           # AuthClient, AuthBrowserClient, AuthServerClient
    types.ts           # All auth-specific types and DTOs
    factors/           # auth.factors.*
    users/             # auth.users.*
    sessions/          # auth.sessions.*
    security/          # auth.security.*
    grants/       # auth.grants.* (server only)
    admin/             # auth.admin.*     (server only)
  comms/               # comms.email.* / comms.sms.*
  session/             # SessionManager — token storage, proactive refresh
  storage/             # Storage adapters: Local, Session, Memory, Cache
  helpers/             # forwardUserHeaders
  exceptions/          # NulvlessException
```

### Key patterns

**Client hierarchy**
- `AuthClient` — base, public + private endpoints, all sub-namespaces
- `AuthBrowserClient extends AuthClient` — adds `auth.get()` / `auth.set()` (browser only)
- `AuthServerClient extends AuthClient` — adds `auth.grants` + `auth.admin` (server only)

**Bearer token resolution in sub-clients**
Every authenticated call goes through `resolveBearer` (`auth/base.ts`; sub-clients call it via `bearer(options)`):
1. If an `Authorization` header is already present — in `options.headers` or in the client-level `headers` option, any letter case → use it as-is (server pattern)
2. Otherwise → call `getToken()` callback injected at construction (browser pattern), failing with `no_session` when there is none

**`_getToken` protected field**
Defined on `AuthClient`, passed to every sub-client constructor. Resolves the valid token from `SessionManager` (with auto-refresh), or `null` when there is no session.

**NulvlessResult**
Every public method returns `NulvlessResult<T>`:
```ts
type NulvlessResult<T> = { data: T; error: null } | { data: null; error: NulvlessError }
```
Check `error` first — if null, `data` is guaranteed.

**HttpClient base URL**
`NulvlessClient` and `NulvlessServerClient` both set `baseUrl: ${base}/auth` for auth calls. The gateway routes `/auth/*` → auth service and strips the prefix, so controller paths like `/factors/challenges/verify` resolve correctly.

**`exactOptionalPropertyTypes: true`**
Do not assign `undefined` to optional fields. Use conditional spreads:
```ts
// correct
...(value ? { key: value } : {})
// wrong
{ key: value ?? undefined }
```

**`redirect_uri` convention**
Never add `redirect_uri` to param interfaces — always pass via `options.redirect_uri`. Methods that need it in the request body inject it explicitly:
```ts
{ ...params, ...(options?.redirect_uri ? { redirect_uri: options.redirect_uri } : {}) }
```

**Path parameters**
Build every path that interpolates a value with the `route` tag from `http.ts` (``route`/grants/${id}` ``) — it encodes each value as a single segment.

**Timeout**
Configurable at two levels: `ClientOptions.timeout` (all requests) and `RequestOptions.timeout` (per-request, overrides client level).

## Auth service — controller prefixes

The auth service exposes multiple NestJS controllers. All are routed under `/auth` at the gateway:

| Controller prefix | Client namespace |
|---|---|
| `/auth` | `AuthClient` (top-level methods) |
| `/factors` | `auth.factors` + challenge methods on `AuthClient` |
| `/users` | `auth.users` |
| `/sessions` | `auth.sessions` |
| `/security` | `auth.security` |
| `/grants` | `auth.grants` |
| `/admin` | `auth.admin` |

Challenge methods (`verifyChallenge`, `getChallenge`, `changeChallenge`) live on `AuthClient` even though they hit `/factors/challenges/*` — they are unauthenticated operations used during the sign-in/sign-up flow, not factor management.
