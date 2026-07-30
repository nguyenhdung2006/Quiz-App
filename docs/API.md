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

