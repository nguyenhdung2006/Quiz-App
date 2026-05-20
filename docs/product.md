# Vocabulary Quiz Product Notes

## 0. Summary
Vocabulary Quiz is a personal vocabulary trainer: add words, play 4-choice quizzes, review mistakes, and repeat wrong words until they become mastered.

## 1. Scope
The frontend is still a client-first app that works with browser storage. The backend now exists as a clean REST API foundation for future sync, PostgreSQL storage, and Google login.

## 2. Users
Students can review school vocabulary and wrong words. Self-learners can manage custom decks with examples and notes. Busy users can do quick daily or timed challenge rounds.

## 3. Architecture
The repo is organized as:

- `frontend`: HTML, CSS, JavaScript, images, sounds
- `backend`: Spring Boot REST API
- `database`: PostgreSQL SQL scripts
- `docs`: product and backend notes
- `archive`: old duplicated Spring project copied out of the frontend area

## 4. Data Model
A word has English, Vietnamese, POS, tag, example, note, favorite, mastered, and stats: seen, correct, wrong, streak, best streak.

## 5. Main Screens
Home contains dashboard, add-word form, vocabulary table, search, quiz settings, and practice buttons. Quiz screen shows progress, combo, question, answers, timer when needed, and navigation. Result and review screens summarize score and answers. Mistake screen manages wrong words and mastered cleanup.

## 6. Core Flows
Add -> Quiz -> Review -> Practice Wrong is the main loop. Wrong answers are stored in the wrong bank. Favorites create a focused deck. Daily challenge uses a stable daily shuffle. Challenge mode adds a per-question timer.

## 7. Scoring
Score is correct / total * 10. Grades range from A+ to F. Combo increases on correct answers and resets on wrong answers.

## 8. Import And Export
Export downloads JSON with vocab and wrongWords. Import accepts either an array of words or an object with vocab and wrongWords, then lets the user replace or merge.

## 9. Roadmap
Next good upgrades are edit-word, filters by tag/POS/level, backend sync, PostgreSQL persistence, real Google login, and spaced repetition.
