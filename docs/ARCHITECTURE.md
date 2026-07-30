# Architecture

Quiz App is a static frontend plus Spring Boot backend using a layered backend architecture:

```text
Controller -> Service -> Repository -> Database
```

The backend packages are organized by feature:

| Package | Role |
| --- | --- |
| `com.quizapp.auth` | Session profile endpoints and CSRF token endpoint. |
| `com.quizapp.config` | Spring Security, CORS, OAuth2, CSRF, and production database safety configuration. |
| `com.quizapp.user` | User entity, repository, and current OAuth user resolution. |
| `com.quizapp.vocab` | Vocabulary CRUD, sync, quiz history, wrong bank, achievements, and progress. |
| `com.quizapp.review` | Spaced repetition queue and answer processing. |
| `com.quizapp.analytics` | Aggregated learning analytics. |
| `com.quizapp.ai` | Optional OpenAI clients and rule-based fallbacks. |
| `com.quizapp.health` | Public health and safe startup diagnostics. |
| `com.quizapp.shared` | API error DTO and global exception handling. |

Production database lifecycle is separated from business logic. Flyway migrations are the schema source of truth, `application-prod.yml` pins safe production values, and `ProductionDatabaseSafetyGuard` fails startup if the effective production configuration is unsafe.

## Sync V2 Architecture

Vocabulary sync uses stable client/server UUID identity:

```text
Frontend local word.wordUid
  -> POST /api/sync syncContractVersion=2
  -> VocabularyController
  -> SyncService
  -> AppUserRepository.findByIdForSyncUpdate(...)
  -> VocabularyRepository / WordTombstoneRepository
  -> PostgreSQL
```

`SyncService` owns the V2 contract. It validates the contract version before revision comparison, requires `expectedRevision`, locks the `AppUser` row with `PESSIMISTIC_WRITE`, computes whether real state will change, increments `sync_revision` at most once, then applies deletions before live upserts. Tombstones override live payload items with the same `wordUid`. `VocabularyService` still owns direct CRUD and quiz-result logic but delegates snapshot, sync, and tombstone delete behavior to `SyncService`.
