# @nulvless/js

The official JavaScript SDK for [Nulvless](https://nulvless.com) — authentication, authorization and communications for the browser and the server.

[![npm](https://img.shields.io/npm/v/@nulvless/js)](https://www.npmjs.com/package/@nulvless/js)
[![CI](https://github.com/nulvless/nulvless-js/actions/workflows/ci.yml/badge.svg)](https://github.com/nulvless/nulvless-js/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[Documentation](https://nulvless.com/docs/sdk) · [Quickstart](https://nulvless.com/docs/quickstart) · [Changelog](./CHANGELOG.md)

## Installation

```bash
npm install @nulvless/js
```

## Quick start

### Browser

Create the client with your project URL and publishable key. The session is stored and renewed for you.

```ts
import { createClient } from '@nulvless/js'

const nulvless = createClient('https://<project>.nulvless.co', 'pk-…')

const { data, error } = await nulvless.auth.signIn({
  email: 'ada@example.com',
  password: 'correct horse battery staple',
})

if (error) {
  console.error(error.code, error.message)
} else if (data.challenge) {
  // a second factor is required — see auth.challenges
}
```

### Server

Use the secret key on the server only, and forward the user's request headers on calls made on their behalf.

```ts
import { createServerClient, forwardUserHeaders } from '@nulvless/js'

const nulvless = createServerClient('https://<project>.nulvless.co', process.env.NULVLESS_SECRET!)

export async function GET(request: Request) {
  const { data, error } = await nulvless.auth.verify(
    { resource: 'acme', scopes: ['members:read'] },
    { headers: forwardUserHeaders(request) },
  )

  return error ? new Response(null, { status: error.status_code }) : Response.json(data)
}
```

Every method returns `{ data, error }` instead of throwing — see [Error handling](https://nulvless.com/docs/sdk/errors).

## What's included

- **Authentication** — password, one-time codes, social sign-in, ID tokens, MFA and sudo. [Docs](https://nulvless.com/docs/sdk/auth)
- **Sessions** — storage, automatic renewal coordinated across tabs, multi-account and auth events. [Docs](https://nulvless.com/docs/sdk/session-manager)
- **Users and security** — profile, identities, credential and password changes. [Docs](https://nulvless.com/docs/sdk/users)
- **Authorization** — roles, grants and invitations. [Docs](https://nulvless.com/docs/guides/authorization/rbac)
- **OAuth 2.1 / OpenID Connect provider** — let third-party apps sign in with your project. [Docs](https://nulvless.com/docs/sdk/oauth)
- **Administration** — users, roles and OAuth apps from your backend. [Docs](https://nulvless.com/docs/sdk/admin)
- **Communications** — transactional email and SMS from templates. [Docs](https://nulvless.com/docs/sdk/comms)

Framework guides: [Next.js](https://nulvless.com/docs/frameworks/nextjs) · [React](https://nulvless.com/docs/frameworks/react) · [Vue](https://nulvless.com/docs/frameworks/vue) · [Angular](https://nulvless.com/docs/frameworks/angular) · [Node.js](https://nulvless.com/docs/frameworks/node) · [Express](https://nulvless.com/docs/frameworks/express) · [Fastify](https://nulvless.com/docs/frameworks/fastify) · [NestJS](https://nulvless.com/docs/nestjs)

## Requirements

Any runtime with a global `fetch`:

- Node.js 18 or later
- Modern browsers
- Deno, Bun, Cloudflare Workers and Vercel Edge

TypeScript types are included; no `@types` package is needed. The package ships both ESM and CommonJS builds.

## Versioning

The SDK follows [Semantic Versioning](https://semver.org). While it is in `0.x`, a minor release (`0.2.0`) may contain breaking changes and a patch release (`0.1.1`) never does. Every change is listed in the [changelog](./CHANGELOG.md).

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to set up the project and run the checks.

## Security

Please do not open public issues for vulnerabilities. See [SECURITY.md](./SECURITY.md) for how to report them.

## License

[MIT](./LICENSE)
