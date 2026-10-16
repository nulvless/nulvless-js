# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres
to [Semantic Versioning](https://semver.org/).

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
