# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres
to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-11-05

A template is now one record per channel and slug, holding one translation per language.

### Added

- `comms.templates.putTranslation(channel, slug, language, { subject, content })` creates or replaces the translation of one language, and creates the template when it does not exist.
- `comms.templates.deleteTranslation(channel, slug, language)` deletes one language. Deleting the last one deletes the template.
- `Template.translations` lists every language with its `subject`, `content`, `last_submission`, `created_at` and `updated_at`. `TemplateTranslation` and `TranslationParams` are exported.
- `Template.customized` is `false` for a platform default the project never changed.
- `TemplateFilters.authored` leaves customized platform templates out of `comms.templates.list`.

### Changed

- `comms.templates.get(channel, slug)` returns the template with every translation. It no longer takes a language.
- `comms.templates.update(channel, slug, params)` changes only `name`, `description`, `url` and `config`. Change a subject or content with `putTranslation`.
- `comms.templates.delete(channel, slug)` deletes the template in every language. It no longer takes a language; use `deleteTranslation` for one.
- `comms.templates.list` returns one item per template. Its translations come without `content`.
- `comms.templates.create` fails when the channel already has the slug, instead of adding a language.

### Removed

- `Template.id`, `Template.language`, `Template.subject`, `Template.content` and `Template.last_submission`. They live on each translation now.
- `TemplateFilters.language`.

## [0.1.7] - 2026-11-04

### Added

- `auth.oauth.authorize` accepts the OpenID Connect `prompt` and `max_age` parameters. `prompt: 'login'` or a `max_age` ask the user to confirm their identity again before the app gets access.
- `OAuthAuthorization` returns the `prompt` and `max_age` the app sent.
- `OAuthApp`, `RegisterOAuthAppParams` and `UpdateOAuthAppParams` carry `default_max_age`, the OpenID Connect `max_age` a client applies when the request sends none.
- `login_required` in the error codes: approving a consent fails with it until the user confirms their identity.

## [0.1.6] - 2026-10-20

### Added

- `auth.factors.enroll` accepts `phone` for `sms_otp`, so an SMS factor can use a number other than the user's. A user can hold several authenticator apps and SMS factors, up to 10 combined.
- `auth.challenges.change` accepts `factor_id`, to choose which SMS factor receives the code.
- `mfa_factors_limit_reached`, `mfa_phone_already_enrolled` and `mfa_phone_not_supported` in `AuthErrorCode`.

### Changed

- `auth.challenges.create` takes `{ type, factor_id }` instead of the method string: `create({ type: 'totp' })`. `factor_id` chooses which SMS factor receives the code.

## [0.1.5] - 2026-10-20

### Fixed

- `comms` calls from `createServerClient` go to `/comms`, the path the gateway serves. They were sent to `/notifications`, which the gateway does not route.

## [0.1.4] - 2026-10-19

### Added

- `ErrorCode` types every `error.code` the SDK can return, grouped as `SdkErrorCode`, `GatewayErrorCode`, `AuthErrorCode` and `CommsErrorCode`, so editors autocomplete them. Any other string is still accepted, so codes added later keep compiling. `EdgeFunctionErrorCode` lists the codes an edge function invocation answers with.

## [0.1.2] - 2026-10-19

### Added

- `User.password_enabled` tells whether the user has a password set, regardless of the sign-in methods enabled on the platform. Use it to choose between creating and changing a password.

### Fixed

- `Challenge.preferred` includes `'link'` and `Challenge.token` can be `null`, matching what the API returns when a confirmation link was sent.

## [0.1.1] - 2026-10-19

### Added

- `auth.admin.users.create` accepts `email_verified` and `phone_verified` to create a user with those credentials already verified; when every credential sent is verified, no confirmation is sent.

## [0.1.0] - 2026-10-16

Initial release.

### Added

- `createClient` (browser, public key) and `createServerClient` (server, private key).
- Auth: sign-up, password and OTP sign-in, social sign-in and account linking, ID token sign-in, password recovery, session validation and sign-out.
- Challenges, MFA factors, recovery codes and sudo elevation (`auth.challenges`, `auth.factors`, `auth.sessions`).
- Current-user profile, identities and credential updates (`auth.users`, `auth.security`).
- OAuth 2.1 / OpenID Connect provider (`auth.oauth`).
- Resource grants (`auth.grants`) and platform administration (`auth.admin`) on the server client.
- Transactional email and SMS, and template management (`comms`) on the server client.
- Browser session management: pluggable storage, automatic token renewal coordinated across tabs, multi-account and auth events.
- `NulvlessResult` return type with an opt-in `throwErrors` / `NulvlessException` strategy.
- `forwardUserHeaders` and `applyAuthCacheHeaders` helpers for server-side use.
