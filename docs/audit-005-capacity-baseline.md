# AUD-005 Capacity Baseline

Measured on 2026-08-15 in local Spring Boot `MockMvc` tests with H2 and synthetic per-user fixtures. These numbers are regression guardrails, not production SLA evidence.

## Scope

- Measured full snapshot payload growth at 100, 1,000, and 5,000 words.
- Measured `/api/sync` request/response size for 100 submitted words against a 1,000-word account.
- Measured quiz result submission with 100 answers against a 1,000-word account.
- Measured review queue and analytics query counts against a 1,000-word account.
- Counted tombstone payload growth with synthetic tombstones only; no tombstone deletion or compaction was performed.

## Before And After

| Operation | Fixture | Before queries | After queries | After request bytes | After response bytes | After local millis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/api/snapshot` | 100 words / 5 tombstones | 110 | 10 | 0 | 51,771 | 48 |
| `/api/snapshot` | 1,000 words / 50 tombstones | 1,010 | 10 | 0 | 515,360 | 110 |
| `/api/snapshot` | 5,000 words / 250 tombstones | 5,010 | 10 | 0 | 2,583,853 | 351 |
| `/api/sync` submit 100 words | 1,000 words / 20 tombstones | not separately captured before; code path had per-word lookup/full duplicate scan | 113 | 14,637 | 508,492 | 798 |
| `/api/quiz-results` submit 100 answers | 1,000 words / 20 tombstones | 1,456 | 258 | 11,556 | 533,039 | 401 |
| `/api/review/queue?limit=20` | 1,000 words / 20 tombstones | 1,003 | 3 | 0 | 4,288 | 57 |
| `/api/analytics/overview` | 1,000 words / 20 tombstones | 1,008 | 4 | 0 | 339 | 63 |
| `/api/analytics/tag-performance` | 1,000 words / 20 tombstones | 1,003 | 3 | 0 | 297 | 38 |

The remaining full snapshot payload is still linear in live words plus tombstones. At 5,000 words and 250 tombstones the response is about 2.58 MB locally, so delta/page design remains justified before larger public-scale accounts.

## Changes Made

- Added `Audit005CapacityTests` with Hibernate prepared-statement count guardrails and request/response size logging.
- Fetches `VocabularyWord.stats` with repository entity graphs to remove stats lazy-load N+1 in snapshot, review, and analytics paths.
- Bulk-loads quiz answer words and existing wrong-bank entries for quiz result verification.
- Reuses the already loaded live-word map during sync upserts instead of querying each `wordUid` again.
- Prefilters review queue candidates by due date/tag/level at the database query level while keeping the existing Java priority sort.
- Reuses words/history lists inside analytics overview instead of re-querying sub-metrics.

## Remaining Risk

- AUD-005 is only partially fixed: `/api/snapshot` and `/api/sync` still return full snapshots, so payload, heap, and mobile reliability remain bounded by account size.
- Tombstones are intentionally retained; there is still no acknowledgement/watermark design that would make deletion safe.
- No real PostgreSQL, staging, browser, mobile, or production load evidence was collected for this batch.
- AUD-006 remains BLOCKED because real staging OAuth smoke, restore evidence, and release evidence are still missing. The project is not production-ready.
