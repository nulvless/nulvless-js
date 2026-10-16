# Contributing

Thanks for helping improve `@nulvless/js`.

## Before you start

For anything beyond a small fix, open an issue first so the change can be discussed before you spend time on it. Bugs are easiest to act on with a minimal reproduction, the SDK version and the runtime you use.

## Setup

```bash
git clone https://github.com/nulvless/nulvless-js.git
cd nulvless-js
npm install
```

The `.nvmrc` pins the Node.js version used for development.

## Checks

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm test               # jest
npm run test:coverage  # jest with the coverage thresholds from jest.config.cjs
npm run build          # tsup → dist/
```

CI runs all of them on every pull request.

## Tests

Specs live next to the code in `src/**/tests/*.spec.ts`. They exercise the SDK through a mocked `fetch` (`src/tests/support/fetch.ts`), so a test asserts the exact method, path, query, headers and body a call sends — no network and no running services.

Every behavior change comes with a test, and every bug fix with a test that fails without it.

## Pull requests

- Keep each pull request focused on one change.
- Use [Conventional Commits](https://www.conventionalcommits.org) for commit messages (`fix(session): …`, `feat(auth): …`).
- Describe user-visible changes under an `Unreleased` heading at the top of [CHANGELOG.md](./CHANGELOG.md).
- Update the documentation on [nulvless.com/docs](https://nulvless.com/docs/sdk) when the public API changes.

## Releasing

Maintainers release by pushing a version tag; the [Release workflow](./.github/workflows/release.yml) does the rest.

1. Run `npm version x.y.z --no-git-tag-version` to set the version in `package.json` and the lockfile.
2. Turn the `Unreleased` heading of `CHANGELOG.md` into `## [x.y.z] - YYYY-MM-DD`.
3. Commit, then tag and push: `git tag vx.y.z && git push origin vx.y.z`.

The workflow checks that the tag matches `package.json`, runs every check, publishes to npm with [provenance](https://docs.npmjs.com/generating-provenance-statements) through [trusted publishing](https://docs.npmjs.com/trusted-publishers) — no npm token is stored in the repository — and creates the GitHub release from the changelog entry. A pre-release version such as `0.2.0-beta.1` is published under the `next` dist-tag and marked as a pre-release.
