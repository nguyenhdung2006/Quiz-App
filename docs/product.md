# Vocabulary Quiz Product Notes

## 0. Summary
Vocabulary Quiz is a private vocabulary trainer for building a word bank, playing 4-choice quiz rounds, reviewing mistakes, and turning weak words into mastered words with lightweight spaced repetition.

## 1. Current Product Shape
The app works in two modes:

- Local-first mode: data is stored per account in browser `localStorage`, so learning still works when the backend is offline.
- Cloud mode: Google OAuth enables backend-backed profile, vocabulary sync, explicit word CRUD, quiz history, achievements, and progress summaries.

## 2. Main User Value
The main loop is:

Add words -> Filter/review deck -> Quiz -> Review answers -> Practice wrong words -> Repeat due words.

The design goal is "learn while playing, without pressure": combo feedback, small achievements, daily challenges, and mistake practice are motivational but not punitive.

## 3. Frontend Features
- Add English/Vietnamese words with POS, tag, example, note, favorite, and mastery status.
- Edit words directly inside the vocabulary table.
- Filter by search text, POS, tag, mastery level, and favorites.
- Practice modes: Eng -> Vie, Vie -> Eng, mixed mode, favorites, wrong words, daily challenge, and timed challenge.
- Browser speech synthesis for English pronunciation.
- Quiz review screen with selected answer, correct answer, examples, and notes.
- Wrong bank with mastered cleanup.
- Local import/export JSON backup.
- CSV bulk import with validation feedback and CSV template download in Learning Studio.
- Starter sample word import.
- Dashboard cards for total words, wrong bank, due reviews, and weekly correct answers.
- Profile editor with name, avatar, birthday, gender, learning goal, and bio.

## 4. Backend Features
- Google OAuth login and session-based API access.
- Per-user vocabulary CRUD.
- Snapshot and sync APIs for local-first data reconciliation.
- Quiz result storage in `quiz_history` and `quiz_history_answers`.
- Word stats with seen/correct/wrong/streak/mastery/last reviewed/next review.
- Achievement unlocks for first word, first quiz, perfect round, combo 10, and daily challenge.
- Progress summary for weekly learning and due review counts.
- Starter word import endpoint.

## 5. Data Model
A word includes English, Vietnamese, POS, tag, example, note, favorite, mastered, and stats.

Stats include seen, correct, wrong, current streak, best streak, mastery level, last reviewed, and next review.

The backend also stores users, wrong bank entries, quiz history, quiz answers, achievements, and unlocked user achievements.

## 6. Roadmap
Good next upgrades:

- Full quiz-history screen with charts.
- Real admin-only deck management.
- Better spaced repetition tuning by difficulty and lapse count.
- Achievement gallery UI.
- CSV export, if learners need spreadsheet round-trips beyond the current JSON backup and CSV import/template flow.
- Mobile PWA install support.
- Tests for service-level quiz history and achievements.
