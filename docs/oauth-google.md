# Google OAuth Setup

Google OAuth is prepared but not wired into the app flow yet. Keep secrets out of source control.

## Environment Variables

Use these local variables when enabling OAuth:

```powershell
$env:GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
$env:GOOGLE_CLIENT_SECRET="your-google-client-secret"
$env:SPRING_PROFILES_ACTIVE="oauth"
```

Then run from `backend`:

```powershell
.\mvnw.cmd spring-boot:run
```

## Local Config Option

Copy `backend/config/oauth2-google.example.yml` to `backend/config/oauth2-google.yml` and set `GOOGLE_CLIENT_SECRET` in your environment. The real `oauth2-google.yml` file is ignored by Git.

Alternatively, copy `.env.example` to `.env` at the repo root, fill in the two Google values locally, and run Spring Boot normally. The `.env` file is ignored by Git.

The current Google redirect URI is:

```text
http://localhost:8080/login/oauth2/code/google
```

JWT integration and real auth flow belong to a later phase.
