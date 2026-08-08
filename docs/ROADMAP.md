# Roadmap

## Release Blockers

- Capture Render Metrics around the confirmed memory-limit restart and classify
  the incident as leak, payload/concurrency spike, or insufficient instance
  headroom.
- Add a pre-deserialization request-body limit for `/api/sync` and test
  oversized payload rejection.
- Re-run production release-gate secret scan on a clean tree and confirm the
  empty env key false positive is gone.
- Load real production/staging env vars and pass `npm run gate:validate-env`.
- Provide restore rehearsal evidence at `docs/restore-rehearsal-evidence.md` or via `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true`.
- Run staging smoke with `STAGING_BACKEND_URL`, `STAGING_FRONTEND_URL`, and `STAGING_TEST_USER_HINT`.
- Re-run source integrity from a clean committed release candidate.

## Near Term

- Add generated OpenAPI documentation or a checked contract spec.
- Add deployed Google OAuth login/logout E2E coverage.
- Add explicit security header assertions for CSP/HSTS/referrer policy after deployment target is finalized.
- Continue incremental backend service split: CRUD, quiz result, snapshot query, and profile use cases.
- Add measured query improvements for duplicate lookup, due review queue, analytics, and history.
- Decide whether `/actuator/metrics/**` remains public or should be restricted to a monitoring channel.

## Later

- Add pagination or delta sync for large accounts.
- Add quiz attempt anti-replay only if product requirements demand it.
- Define tombstone retention and cleanup policy after real data-age needs are known.
- Upgrade AI rate limiting to distributed storage only when the backend runs multiple instances, AI cost risk is material, or abuse evidence appears.
- Add external monitoring/APM when production traffic justifies it.

## Refactor Candidates

Do not combine these with production blocker fixes:

- Split `frontend/js/app.js` into auth, sync, profile, dashboard, and import/export modules.
- Split `frontend/js/learning-studio.js` by studio profile/history, decks, CSV, focus, and AI deck.
- Continue splitting the remaining `frontend/css/modern.css` core only with visual regression coverage; light-theme and responsive tails are already split into dedicated files.
- Split or retire `frontend/css/design-system.css` only after confirming active selector usage.
- Leave `frontend/index.html` intact until a template/build step is introduced; manual HTML fragmentation would change static delivery semantics.
- Split `tests/smoke.spec.js` by feature once current smoke coverage is green.
