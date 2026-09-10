# Google OAuth Setup

Google OAuth is wired into the backend session flow and the frontend login screen.

## Environment Variables

Set these variables before running the backend:

```powershell
$env:GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
$env:GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

Then run from `backend`:

```powershell
.\mvnw.cmd spring-boot:run
```

## Local Config Option

Copy `backend/config/oauth2-google.example.yml` to `backend/config/oauth2-google.yml`, then set `GOOGLE_CLIENT_SECRET` in your environment. The real `oauth2-google.yml` file is ignored by Git.

Alternatively, copy `.env.example` to `.env` at the repo root and fill in the Google values. `.env` is ignored by Git.

## Redirect URIs

Google callback:

```text
http://localhost:8080/login/oauth2/code/google
```

Successful login redirects to:

```text
http://localhost:5500/frontend/index.html
```

Failed or cancelled login redirects to the configured frontend login page:

```text
http://localhost:5500/frontend/login.html?error=oauth
```

Logout redirects to:

```text
http://localhost:5500/frontend/login.html?loggedOut=true
```

## Frontend Flow

- `frontend/login.html` sends the user to `/oauth2/authorization/google`.
- `frontend/js/login.js` can show "Continue as ..." if a backend session already exists.
- `frontend/js/app.js` calls `/api/me`, then syncs profile/vocab/wrong words if authenticated.
- Word create/update/delete use direct CRUD endpoints, with localStorage fallback when the backend is offline.
