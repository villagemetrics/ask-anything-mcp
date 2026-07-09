# NPM Publishing Setup (Trusted Publishing / OIDC)

How `@villagemetrics-public/ask-anything-mcp` gets published to the public npm registry, and how to troubleshoot it.

## How it works

- **Registry:** public npmjs.org (`publishConfig.registry` in `package.json`). This package is intentionally public — end users install it for Claude Desktop, and the built-in auto-updater polls npmjs for new versions. (Contrast: internal `@villagemetrics/*` packages like `user-data-client` publish privately to GitHub Packages instead.)
- **Trigger:** merging/pushing to `main` runs `.github/workflows/npm-publish.yml`. The `test` job runs on both `develop` and `main`; the `publish` job runs only on `main`.
- **Auth: npm Trusted Publishing (OIDC) — there is no NPM_TOKEN.** The GitHub Actions workflow proves its identity to npm directly via OIDC. Nothing expires, nothing to rotate. Configured on npmjs.com under the package's Settings → Trusted Publisher: org `villagemetrics`, repo `ask-anything-mcp`, workflow `npm-publish.yml`, no environment. Requirements in the workflow: `permissions: id-token: write` on the publish job and npm CLI >= 11.5.1 (hence the `npm install -g npm@latest` step).
- **Version gate:** the workflow publishes only if `package.json`'s version does not already exist on npm. Same-version commits to main (docs, workflow tweaks) skip publish gracefully — they don't fail the build. Remember to bump the version in `package.json` when shipping code changes, or nothing will be published.

## History / troubleshooting

- **Pre-July 2026** this used an `NPM_TOKEN` repo secret (classic/granular npm token). It expired silently (npm's late-2025 security changes capped token lifetimes), and publishes started failing with `npm error code E404: Not Found - PUT ...` — npm masks authorization failures on publish as 404 to avoid leaking package existence. If you ever see **E404 on PUT** during publish, think *auth*, not *missing package*.
- The old workflow also hard-failed if the version wasn't bumped relative to the previous commit; that made any same-version commit to main fail CI and was replaced by the graceful registry-ground-truth check described above.
- If publish fails with an OIDC/auth error, verify the Trusted Publisher config on npmjs.com still matches the repo/workflow filename exactly (renaming the workflow file breaks it).
- **Provenance requires a `repository` field.** Trusted publishing signs a provenance statement, and npm rejects the publish (`E422 ... Error verifying sigstore provenance bundle ... "repository.url" is ""`) unless `package.json` has a `repository.url` matching the GitHub repo. Keep the `repository`, `homepage`, and `bugs` fields in `package.json` accurate.
- The publish job runs on **Node 24** so the runner's bundled npm satisfies trusted publishing's npm >= 11.5.1 requirement. Do **not** add `npm install -g npm@latest` — self-upgrading npm on the runner corrupts the install (`Cannot find module 'sigstore'`).
