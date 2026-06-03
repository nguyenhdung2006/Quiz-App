# Quiz App

Vocabulary Quiz is a local-first vocabulary trainer with Google-login cloud sync. It helps learners add words, play quick quiz rounds, review mistakes, practice due words, and build progress without making study feel heavy.

## Features

- Add, edit, delete, favorite, search, and filter vocabulary words.
- Store learning-focused word profiles: POS, tag, IPA, CEFR/IELTS level, context, example meaning, collocations, synonyms, antonyms, common mistakes, notes, mastery, and review stats.
- Quiz modes: English to Vietnamese, Vietnamese to English, mixed, favorites, wrong words, daily challenge, and timed challenge.
- Answer review, wrong bank, combo feedback, sound effects, pronunciation, and JSON backup.
- Profile, XP, level, achievements, weekly progress, due reviews, starter sample words, topic decks, and CSV import templates.
- Spring Boot backend with Google OAuth, PostgreSQL/H2, vocabulary CRUD, sync, quiz history, achievements, and spaced repetition.

## Project Structure

```text
frontend/   Static HTML, CSS, JavaScript, images, sounds
backend/    Spring Boot REST API and Google OAuth
database/   PostgreSQL schema
docs/       Product, OAuth, and backend notes
archive/    Old project snapshots kept for reference
```

## Run Frontend

Open `frontend/login.html` or serve the repo with a static server such as Live Server on port `5500`.

## Run Backend

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

By default the backend uses H2 memory storage. For PostgreSQL, see `docs/backend-postgres.md`.

## Google Login

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then run the backend. The Google callback is:

```text
http://localhost:8080/login/oauth2/code/google
```

More detail is in `docs/oauth-google.md`.

## Verify

```powershell
cd backend
.\mvnw.cmd test
```
