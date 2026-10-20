# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres
to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
