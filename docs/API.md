# API Notes

## CSRF

### GET `/api/csrf`

Issues a CSRF token for browser clients using the OAuth2 session model.

Authentication: public.

Response:

```json
{
  "headerName": "X-XSRF-TOKEN",
  "parameterName": "_csrf",
  "token": "csrf-token-value"
}
```

Side effects: sets the `XSRF-TOKEN` cookie only. It does not create application data.

## Logout

### POST `/logout`

Logs out the current session.

Authentication: session based.

CSRF: required.

Response:

- `204 No Content` on success.
- `403` JSON when CSRF token is missing or invalid.

The backend deletes `JSESSIONID` and `XSRF-TOKEN`. The frontend performs the visible redirect after the response.

## Unsafe API CSRF Rule

All unsafe API requests must send `X-XSRF-TOKEN` with the token obtained from `GET /api/csrf`:

- `POST /api/vocab`
- `PUT /api/vocab/{id}`
- `DELETE /api/vocab/{id}`
- `PUT /api/profile`
- `POST /api/sync`
- `POST /api/quiz-results`
- `POST /api/review/answer`
- `POST /api/admin/sample-words`
- `POST /api/ai/explain-wrong-answer`
- `POST /api/ai/generate-deck`

## Sync Contract V2

`POST /api/sync` now requires `syncContractVersion: 2` and `expectedRevision`. Missing or wrong contract version returns `400` with `error: "SYNC_CLIENT_UPGRADE_REQUIRED"`. Missing or stale `expectedRevision` returns `409` with `error: "SYNC_REVISION_CONFLICT"` and performs no mutation.

Vocabulary items in sync must include `wordUid` (UUID). The numeric `id` remains the database primary key and direct CRUD compatibility identifier, but sync identity is `wordUid`; English text is not used as a Sync V2 upsert key. `wrongWords` in the request is deprecated and ignored for vocabulary creation or updates.

Current limitation: list-size validation runs after JSON request-body
deserialization. Add a pre-deserialization body-size cap before relying on this
endpoint for large production accounts.

Request shape:

```json
{
  "syncContractVersion": 2,
  "expectedRevision": 3,
  "profile": {},
  "vocab": [
    {
      "wordUid": "7b8f0d4a-0c87-4e44-9f53-1455f67c4a30",
      "eng": "focus",
      "vie": "tap trung",
      "pos": "v"
    }
  ],
  "deletions": [
    {
      "wordUid": "2a13ee3f-30f3-40e2-a47a-502688fd0f3a"
    }
  ],
  "wrongWords": []
}
```

Response includes `syncContractVersion`, `revision`, live `vocab`, and `tombstones`. Tombstones win over live records with the same `wordUid`.

Tombstone response shape:

```json
{
  "wordUid": "2a13ee3f-30f3-40e2-a47a-502688fd0f3a",
  "legacyWordId": 123,
  "deletedAt": "2026-01-05T00:00:00Z",
  "deletedRevision": 8
}
```

`legacyWordId` is nullable and exists only to let upgraded legacy clients remove old local words that have numeric `id` but never adopted the server `wordUid`.

Direct CRUD changes:

- `POST /api/vocab` accepts optional `wordUid` and returns it.
- `PUT /api/vocab/{id}` rejects attempts to change an existing `wordUid`.
- `DELETE /api/vocab/{id}` creates a tombstone and hard-deletes the live row.
- `DELETE /api/vocab/uid/{wordUid}` is available for frontend fast-path deletion by stable identity.
