# WordArena Desktop UI Before/After Checklist

## Purpose

This document is the approval gate for the WordArena desktop UI refactor. No UI implementation should begin until the proposed order and acceptance criteria are approved.

Scope:

- Desktop-first only.
- Primary viewport: 1366x768.
- Secondary viewport: 1920x1080.
- Preserve business logic, backend, database, auth, sync, API contracts, routing behavior, element IDs, and JavaScript data hooks.
- Improvements are ordered from easy to hard.
- Learning-related UI is prioritized before Studio, navigation cleanup, decoration, CSS cleanup, and accessibility polish.
- Cloud sync is available only after Google sign-in. Guest local mode is expected behavior and must not be presented as a sync defect.

## Baseline Method

The baseline uses a deterministic local dataset with 12 words, 5 due reviews, focus words, accuracy history, and wrong-answer data. Backend-dependent responses are intentionally unavailable so local-first UI states remain visible.

Measured baseline:

- At 1366x768, the Dashboard document is approximately 1842px tall.
- At 1366x768, Today Focus begins around y=308px.
- At 1366x768, Quiz Settings begins around y=1480px.
- At 1366x768, quiz practice actions begin around y=1647px.
- At 1920x1080, Quiz Settings still begins around y=1561px.
- Analytics contains 10 top-level KPI cards.
- At 1366x768, the first Analytics chart area begins around y=741px.
- The Analytics document is approximately 2457px tall for the baseline dataset.

## Baseline Evidence Index

| Evidence | Purpose |
|---|---|
| `docs/ui-audit-evidence/before-dashboard-1366.png` | Dashboard first viewport at 1366x768 |
| `docs/ui-audit-evidence/before-dashboard-1920.png` | Dashboard first viewport at 1920x1080 |
| `docs/ui-audit-evidence/before-dashboard-onboarding.png` | New-user onboarding density |
| `docs/ui-audit-evidence/before-dashboard-progress.png` | Progress/leaderboard area and distance to quiz settings |
| `docs/ui-audit-evidence/before-quiz-01-start.png` | Current quiz settings and competing quiz actions |
| `docs/ui-audit-evidence/before-quiz-02-question.png` | Quiz question with full application shell visible |
| `docs/ui-audit-evidence/before-quiz-03-feedback.png` | Wrong-answer feedback and Next action |
| `docs/ui-audit-evidence/before-vocabulary.png` | Add Word area, filters, and table entrance |
| `docs/ui-audit-evidence/before-vocabulary-edit.png` | Full inline edit state |
| `docs/ui-audit-evidence/before-analytics.png` | Analytics first viewport and KPI density |
| `docs/ui-audit-evidence/before-studio.png` | Learning Studio modal and seven-tab organization |

## Phase 1 - Easy, Learning-Related, High ROI

### 1. Reduce Dashboard hero height

- **Priority number:** 1
- **Area:** Dashboard / first viewport
- **Current problem:** The product hero occupies roughly 200px before showing current learning status. It repeats the brand and generic value proposition instead of helping a returning learner act.
- **Why it matters for learning:** The first viewport should spend its limited vertical space on due reviews, focus words, and starting practice.
- **Proposed fix:** Reduce the hero to a compact identity strip or compact welcome header. Preserve the WordArena identity but remove excess vertical padding and oversized title treatment.
- **Difficulty:** Easy
- **Required change type:** CSS only
- **Risk level:** Low
- **Before evidence file:** `docs/ui-audit-evidence/before-dashboard-1366.png`, `docs/ui-audit-evidence/before-dashboard-1920.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-dashboard-1366.png`, `docs/ui-audit-evidence/after-dashboard-1920.png`
- **Acceptance criteria:** Hero height is at most 110px at both desktop viewports; Dashboard title and WordArena identity remain obvious; no text clipping; Today learning content moves visibly upward.

### 2. Move Review Due, Quick Quiz, and Focus Words into the first viewport

- **Priority number:** 2
- **Area:** Dashboard learning actions
- **Current problem:** Review Today appears early, but actual quiz configuration is around y=1480px at 1366x768. Focus Words begins near the bottom of the first viewport and does not provide a compact decision summary.
- **Why it matters for learning:** These are the three highest-value paths: scheduled repetition, active recall, and targeted correction.
- **Proposed fix:** Create one compact learning-plan region containing Review Due count/action, Quick Quiz action, and Focus Words count/action. Keep advanced quiz settings lower or reveal them only when needed.
- **Difficulty:** Easy
- **Required change type:** HTML + CSS
- **Risk level:** Low, provided existing IDs and click handlers remain attached to the same controls.
- **Before evidence file:** `docs/ui-audit-evidence/before-dashboard-1366.png`, `docs/ui-audit-evidence/before-quiz-01-start.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-dashboard-1366.png`, `docs/ui-audit-evidence/after-quiz-01-start.png`
- **Acceptance criteria:** At 1366x768, the user can see Review Due, Quick Quiz, and Focus Words without scrolling; every action has a visible count or status; no duplicate primary Start Quiz CTA is shown in the same viewport.

### 3. Compact onboarding

- **Priority number:** 3
- **Area:** Dashboard / new-user state
- **Current problem:** The onboarding panel shows four explanatory cards, three recommended decks, status copy, and four actions. It dominates the page after Today Focus.
- **Why it matters for learning:** New learners need one clear first action, not a full product manual before practice.
- **Proposed fix:** Reduce onboarding to a compact three-step checklist: add/import words, take a quiz, review due words. Show one primary CTA and one secondary alternative. Keep detailed explanations behind How it works.
- **Difficulty:** Easy
- **Required change type:** HTML + CSS
- **Risk level:** Low
- **Before evidence file:** `docs/ui-audit-evidence/before-dashboard-onboarding.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-dashboard-onboarding.png`
- **Acceptance criteria:** The full onboarding block is no more than 220px tall at 1366x768; no more than three steps are visible; exactly one primary CTA; recommended decks remain accessible without showing three large cards simultaneously.

### 4. Make Dashboard answer: "What should I study next?"

- **Priority number:** 4
- **Area:** Dashboard information hierarchy
- **Current problem:** The current Dashboard presents branding, a generic Today message, five metrics, focus words, profile statistics, momentum, and quiz settings. It provides data but no single ranked recommendation.
- **Why it matters for learning:** Learners should not have to interpret every metric before selecting a useful session.
- **Proposed fix:** Turn Today Focus into a decision block with a single recommended next action determined by already available state. Present the two alternatives as secondary actions without changing underlying logic.
- **Difficulty:** Easy
- **Required change type:** HTML + CSS
- **Risk level:** Low if recommendation copy is based only on states already rendered; Requires JS approval if the recommended action changes dynamically.
- **Before evidence file:** `docs/ui-audit-evidence/before-dashboard-1366.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-dashboard-1366.png`
- **Acceptance criteria:** Within five seconds, an evaluator can identify one recommended learning action, the reason for it, and its size such as "Review 5 due words"; alternatives are visually secondary.

### 5. Improve button hierarchy for primary learning actions

- **Priority number:** 5
- **Area:** Dashboard and quiz entry controls
- **Current problem:** Review Today, Generate AI Deck, Add Words, Start Quiz, Practice Wrong Words, Favorites, Daily Challenge, and Challenge use similarly strong filled gradients.
- **Why it matters for learning:** Equal visual weight makes core learning actions compete with optional generation and gamification actions.
- **Proposed fix:** Define one primary learning CTA, secondary learning CTAs, and tertiary utility actions. Review Due or Start Quiz should be primary according to context; AI Deck and Challenge should not share primary emphasis.
- **Difficulty:** Easy
- **Required change type:** CSS only
- **Risk level:** Low
- **Before evidence file:** `docs/ui-audit-evidence/before-dashboard-1366.png`, `docs/ui-audit-evidence/before-quiz-01-start.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-dashboard-1366.png`, `docs/ui-audit-evidence/after-quiz-01-start.png`
- **Acceptance criteria:** Each learning region has no more than one primary filled button; secondary actions remain discoverable; disabled states are visibly distinct; labels and functionality remain unchanged unless separately approved.

### 6. Reduce Analytics top section to actionable learning metrics

- **Priority number:** 6
- **Area:** Analytics first viewport
- **Current problem:** Ten KPI cards compete equally: Words, Mastered, Learning, Focus Words, Review Due, Accuracy, Quiz Sessions, Streak, XP, and Weekly XP.
- **Why it matters for learning:** Inventory and gamification metrics hide the signals that determine the next study block.
- **Proposed fix:** Promote Review Due, Focus Words, Average Accuracy, and one recent-progress metric. Move total words, sessions, streak, XP, and Weekly XP into a compact secondary summary below.
- **Difficulty:** Easy
- **Required change type:** HTML + CSS
- **Risk level:** Low if existing metric elements and IDs remain in the DOM.
- **Before evidence file:** `docs/ui-audit-evidence/before-analytics.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-analytics.png`
- **Acceptance criteria:** No more than four primary KPI cards appear before the first chart; Review Due and Focus Words are visually prominent; all existing metrics remain available lower on the page; no analytics calculation changes.

### 7. Rename unclear "+" button to "Add Word"

- **Priority number:** 7
- **Area:** Vocabulary / Add Word
- **Current problem:** The primary submit control is a large icon-only plus button placed beside Add + Quiz, Speak, and Example.
- **Why it matters for learning:** Adding vocabulary is a core content-creation action; ambiguity increases hesitation and input mistakes.
- **Proposed fix:** Give the button a visible "Add Word" label and reserve the plus icon as supporting decoration. Keep Add + Quiz secondary.
- **Difficulty:** Easy
- **Required change type:** HTML + CSS
- **Risk level:** Low if the current class, event handler, and accessible name are preserved.
- **Before evidence file:** `docs/ui-audit-evidence/before-vocabulary.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-vocabulary.png`
- **Acceptance criteria:** A first-time evaluator correctly identifies the submit action without hovering; the button remains connected to the existing addWord behavior; Add + Quiz is not mistaken for the default submit path.

### 8. Reduce visual noise around learning cards

- **Priority number:** 8
- **Area:** Dashboard, quiz, vocabulary, Analytics
- **Current problem:** Neon background art, gradients, glows, outlined pills, colored card borders, and multiple accent colors compete with learning content.
- **Why it matters for learning:** High decorative contrast weakens question, answer, due-state, and focus-word hierarchy.
- **Proposed fix:** Reduce glow intensity and decorative borders on supporting surfaces. Reserve strong color for current priority, answer feedback, and primary action.
- **Difficulty:** Easy
- **Required change type:** CSS only
- **Risk level:** Low
- **Before evidence file:** `docs/ui-audit-evidence/before-dashboard-1366.png`, `docs/ui-audit-evidence/before-quiz-03-feedback.png`, `docs/ui-audit-evidence/before-analytics.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-dashboard-1366.png`, `docs/ui-audit-evidence/after-quiz-03-feedback.png`, `docs/ui-audit-evidence/after-analytics.png`
- **Acceptance criteria:** Primary learning content remains the highest-contrast element; decorative glow does not reduce text readability; correct/wrong feedback colors remain unambiguous; dark theme identity is preserved.

## Phase 2 - Medium, Still Learning-Related

### 9. Create a more focused quiz layout on desktop

- **Priority number:** 9
- **Area:** Quiz session
- **Current problem:** The full sidebar, topbar, account control, sync warning, page background, and footer remain visible during a quiz.
- **Why it matters for learning:** A quiz is a focused recall task. Navigation and account state add irrelevant cognitive load.
- **Proposed fix:** Introduce a desktop focus presentation while quiz state is active. Keep a compact exit/back control, progress, combo/timer, question, answers, and next action. Do not change quiz logic.
- **Difficulty:** Medium
- **Required change type:** CSS only if current hidden/active screen classes are sufficient; Requires JS only if a new body state class is necessary.
- **Risk level:** Medium because global shell visibility may affect result and review screens.
- **Before evidence file:** `docs/ui-audit-evidence/before-quiz-02-question.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-quiz-02-question.png`
- **Acceptance criteria:** Sidebar, utility tools, account menu, sync warning, and footer do not compete with the active question; question and all four answers fit comfortably at 1366x768; an obvious exit path remains; result and answer-review screens still work.

### 10. Make quiz feedback more visible

- **Priority number:** 10
- **Area:** Quiz answer feedback
- **Current problem:** Correct/wrong styling is visible, but the explanatory text and Next action sit beneath the answer grid and are visually separated from the selected answer.
- **Why it matters for learning:** Immediate, unmistakable feedback is the main instructional value of each question.
- **Proposed fix:** Create a consolidated feedback region directly adjacent to the answer grid. Make state, correct answer, and Next hierarchy obvious. Avoid adding new explanation logic.
- **Difficulty:** Medium
- **Required change type:** HTML + CSS if existing feedback element can be repositioned; Requires JS only if controls must change visibility by state.
- **Risk level:** Medium because quiz keyboard behavior and answer locking must remain intact.
- **Before evidence file:** `docs/ui-audit-evidence/before-quiz-03-feedback.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-quiz-03-feedback.png`
- **Acceptance criteria:** The feedback state is visible without searching; the selected wrong answer and correct answer are both identifiable without color alone; Next is the only visually primary continuation control after answering; Enter-key behavior remains unchanged.

### 11. Improve Vocabulary add-form hierarchy

- **Priority number:** 11
- **Area:** Vocabulary / Add Word form
- **Current problem:** English, Vietnamese, Tag, POS, and CEFR share one dense row and nearly equal emphasis. Learning Details and four actions create a broad control surface.
- **Why it matters for learning:** Fast capture depends on prioritizing the word and meaning, while metadata should remain optional and secondary.
- **Proposed fix:** Give English and Vietnamese dominant width and emphasis. Group Tag, POS, and CEFR as metadata. Keep Learning Details collapsed by default and distinguish submit from Speak/Example helpers.
- **Difficulty:** Medium
- **Required change type:** HTML + CSS
- **Risk level:** Medium because existing IDs and form references must not move outside expected containers without verification.
- **Before evidence file:** `docs/ui-audit-evidence/before-vocabulary.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-vocabulary.png`
- **Acceptance criteria:** English and Vietnamese are the first two obvious fields; optional metadata is visibly secondary; Add Word is the only primary action; all current fields and helper actions remain available; existing validation still targets the correct controls.

### 12. Make Vocabulary edit less overwhelming

- **Priority number:** 12
- **Area:** Vocabulary table / inline edit
- **Current problem:** Editing one word expands a table row into a large multi-column form containing basic fields and all learning metadata. Several controls extend below the visible row area while Save/Cancel remain far to the right.
- **Why it matters for learning:** Users must be able to correct meaning, context, and examples without losing orientation in the vocabulary list.
- **Proposed fix:** First attempt a safer layout-only improvement: separate basic fields from advanced details inside the existing row and keep Save/Cancel sticky and visible. A drawer/modal is deferred until JS coupling is reviewed and explicitly approved.
- **Difficulty:** Medium
- **Required change type:** HTML + CSS for grouping; Requires JS only for a drawer/modal solution.
- **Risk level:** Medium to High because row rendering and save/cancel handlers are generated in JavaScript.
- **Before evidence file:** `docs/ui-audit-evidence/before-vocabulary-edit.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-vocabulary-edit.png`
- **Acceptance criteria:** Save and Cancel remain visible while editing; basic fields can be understood without scanning across five table columns; no field, ID, index mapping, save behavior, or cloud-sync call changes; if safe layout cannot be achieved without restructuring generated DOM, stop and request approval before JS changes.

### 13. Reorganize Analytics to suggest the next learning action

- **Priority number:** 13
- **Area:** Analytics information hierarchy
- **Current problem:** The page says to choose a useful next step but presents KPI cards and charts without a clearly ranked action linked to Review, Focus Words, or Quiz.
- **Why it matters for learning:** Analytics is useful only when it changes what the learner studies next.
- **Proposed fix:** Add a prominent recommendation summary using existing due, weak-word, accuracy, and tag data. Position supporting charts below the recommendation. Reuse existing navigation/actions.
- **Difficulty:** Medium
- **Required change type:** HTML + CSS if static priority copy is acceptable; Requires JS to select recommendations dynamically from existing data.
- **Risk level:** Medium; no new metric calculation should be introduced without separate validation.
- **Before evidence file:** `docs/ui-audit-evidence/before-analytics.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-analytics.png`
- **Acceptance criteria:** The first viewport contains one recommended action, its evidence, and a direct existing action path; charts remain available below; recommendation never contradicts displayed due/focus counts; no backend or analytics contract changes.

## Phase 3 - Harder or Less Directly Learning-Related

### 14. Reorganize Learning Studio grouping

- **Priority number:** 14
- **Area:** Learning Studio
- **Current problem:** Profile, History, Badges, Focus, Decks, AI Deck, and CSV are seven equal tabs in one large modal. They represent different goals and do not feel like one coherent workflow.
- **Why it matters for learning:** Poor grouping makes supporting tools harder to find, but it is less urgent than quiz, review, vocabulary, and Analytics.
- **Proposed fix:** Group existing features into Progress, Practice, Deck Builder, and Data Tools. Do not add features or alter their internal logic.
- **Difficulty:** Hard
- **Required change type:** HTML + CSS; likely Requires JS for tab-state mapping.
- **Risk level:** High because tab selectors and view IDs are JavaScript-coupled.
- **Before evidence file:** `docs/ui-audit-evidence/before-studio.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-studio.png`
- **Acceptance criteria:** Every existing Studio feature remains reachable; no duplicate tab state; existing IDs and data attributes are preserved or compatibility is proven by tests; a user can predict where Decks, AI Deck, CSV, History, and Focus belong.

### 15. Clean up sidebar utility actions

- **Priority number:** 15
- **Area:** Sidebar
- **Current problem:** How it works, Export Backup, Import JSON, Starter Samples, and Theme use the same persistent sidebar presence as destination navigation.
- **Why it matters for learning:** Utility controls increase scan time but do not directly block core learning on desktop.
- **Proposed fix:** Keep Dashboard, Vocabulary, Review, Analytics, and Studio as primary destinations. Visually group or collapse utility actions under Tools without changing their handlers.
- **Difficulty:** Hard
- **Required change type:** HTML + CSS; Requires JS if a collapsible Tools menu is introduced.
- **Risk level:** Medium because import file triggers and theme hooks must remain connected.
- **Before evidence file:** `docs/ui-audit-evidence/before-dashboard-1366.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-dashboard-1366.png`
- **Acceptance criteria:** Five primary destinations are distinguishable at a glance; all utility actions remain reachable in one click or one menu expansion; import/export/theme behavior is unchanged.

### 16. Remove fake leaderboard-style presentation

- **Priority number:** 16
- **Area:** Dashboard progress section
- **Current problem:** Learning Momentum uses ranking/leaderboard patterns for personal metrics and occupies a large vertical region with substantial empty space before quiz settings.
- **Why it matters for learning:** It consumes attention and space without helping the learner choose the next task.
- **Proposed fix:** Replace the ranking presentation with a compact personal progress summary or remove it from the main Dashboard. Preserve XP, streak, mastery, badges, due count, and weekly correct values where useful.
- **Difficulty:** Hard
- **Required change type:** HTML + CSS
- **Risk level:** Medium because metric element IDs may be updated by JavaScript.
- **Before evidence file:** `docs/ui-audit-evidence/before-dashboard-progress.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-dashboard-progress.png`
- **Acceptance criteria:** No ranking numbers imply competition with other users; the progress region is no more than 220px tall at 1366x768; existing metric values continue to update; quiz settings move materially upward.

### 17. Improve visual-system consistency

- **Priority number:** 17
- **Area:** Entire frontend
- **Current problem:** Cards and controls use many radius values, gradients, glow levels, button heights, small label sizes, and overlapping legacy/modern styles.
- **Why it matters for learning:** Consistency reduces interpretation cost, but it should follow learning-flow improvements so styling does not polish the wrong hierarchy.
- **Proposed fix:** Standardize surface hierarchy, spacing, border radius, button variants, muted text, headings, and state colors using the existing visual identity.
- **Difficulty:** Hard
- **Required change type:** CSS only
- **Risk level:** Medium because broad selectors may affect login, modal, quiz, and table states.
- **Before evidence file:** All baseline PNG files
- **After evidence file placeholder:** All matching after PNG files
- **Acceptance criteria:** One documented radius scale, spacing scale, and button hierarchy is visible across Dashboard, Quiz, Vocabulary, Analytics, and Studio; correct/wrong/warning colors remain distinct; no component loses layout or readability.

### 18. Clean up CSS architecture

- **Priority number:** 18
- **Area:** Frontend stylesheets
- **Current problem:** Base, layout, components, typography, quiz, design-system, and modern styles contain overlapping definitions and overrides.
- **Why it matters for learning:** It does not directly improve learning, but unresolved overlap makes later learning UI changes fragile.
- **Proposed fix:** Only after visual behavior is approved, identify dead or fully overridden rules and consolidate ownership gradually. Do not combine this with behavior changes.
- **Difficulty:** Hard
- **Required change type:** CSS only
- **Risk level:** High due to cascade and specificity regressions.
- **Before evidence file:** All baseline PNG files
- **After evidence file placeholder:** All matching after PNG files plus regression-test results
- **Acceptance criteria:** No visual regression against approved after screenshots; no removed selector is still referenced by HTML or JavaScript; frontend smoke tests pass; cleanup is split into small reviewable changes.

### 19. Accessibility polish

- **Priority number:** 19
- **Area:** Quiz, modal, tabs, controls, contrast, keyboard
- **Current problem:** Studio modal does not visibly demonstrate focus containment; tab semantics and focus restoration need review; some small controls and decorative contrast may reduce usability.
- **Why it matters for learning:** Accessibility is required for a polished product, but risky modal and tab behavior changes should follow core learning layout work and receive explicit JS approval.
- **Proposed fix:** Verify and improve focus trap, focus restoration, modal background inertness, tab roles/state, keyboard order, visible focus, non-color feedback, control sizes, and contrast.
- **Difficulty:** Hard
- **Required change type:** CSS only for focus/contrast sizing; HTML + CSS for semantics; Requires JS for focus trap, restoration, and dynamic ARIA state.
- **Risk level:** Medium to High
- **Before evidence file:** `docs/ui-audit-evidence/before-studio.png`, `docs/ui-audit-evidence/before-quiz-03-feedback.png`, `docs/ui-audit-evidence/before-vocabulary.png`
- **After evidence file placeholder:** `docs/ui-audit-evidence/after-studio.png`, `docs/ui-audit-evidence/after-quiz-03-feedback.png`, `docs/ui-audit-evidence/after-vocabulary.png`
- **Acceptance criteria:** Modal focus enters the dialog, stays inside, and returns to the opener; tabs expose correct role/selected state; all interactive controls have visible keyboard focus; correct/wrong states remain understandable without color alone; no keyboard regression in quiz.

## Required After-Change Evidence

After implementation, Codex must capture the same deterministic desktop states and create at least:

- `docs/ui-audit-evidence/after-dashboard-1366.png`
- `docs/ui-audit-evidence/after-dashboard-1920.png`
- `docs/ui-audit-evidence/after-dashboard-onboarding.png`
- `docs/ui-audit-evidence/after-dashboard-progress.png`
- `docs/ui-audit-evidence/after-quiz-01-start.png`
- `docs/ui-audit-evidence/after-quiz-02-question.png`
- `docs/ui-audit-evidence/after-quiz-03-feedback.png`
- `docs/ui-audit-evidence/after-vocabulary.png`
- `docs/ui-audit-evidence/after-vocabulary-edit.png`
- `docs/ui-audit-evidence/after-analytics.png`
- `docs/ui-audit-evidence/after-studio.png`
- `docs/ui-audit-evidence/after-wordarena-desktop-flow.webm`
- `docs/ui-audit-evidence/before-after-wordarena-comparison.webm`

The final comparison video must show synchronized Before and After states, measurement callouts, learning-flow impact, acceptance results, and regressions. It must follow `docs/ui-video-comparison-plan.md`. Matching screenshots remain required for pixel-level review.

## Final Comparison Report Requirement

After implementation, create `docs/ui-before-after-comparison.md`.

For every implemented checklist item, include:

- Priority number and area.
- Before screenshot or video reference.
- After screenshot or video reference.
- What changed.
- Whether the learning flow improved and why.
- Whether every acceptance criterion passed.
- Any visual, interaction, keyboard, data-display, or responsive regression noticed.
- Test/check commands run.
- Deferred issues and the reason they were deferred.

The comparison must use the same viewport, deterministic dataset, scroll position, theme, and application state for each before/after pair.

## Stop Conditions

Stop and report before implementation when any of the following applies:

- The app cannot be opened locally.
- Neither video nor screenshot evidence can be captured.
- Test data is missing and a learning flow cannot be demonstrated.
- A recommendation requires backend, database, auth, sync, API-contract, or routing changes.
- A recommendation requires risky JavaScript changes that have not been approved.
- Existing IDs, `data-*` attributes, generated table structure, or event hooks are tightly coupled and cannot be moved safely.
- A CSS-only recommendation unexpectedly requires behavior changes.
- A proposed layout would hide an existing feature or metric without explicit approval.

## Recommended Implementation Sequence

Implementation should proceed in small approval batches:

1. **Batch A - CSS-first Dashboard density:** priorities 1, 5, and 8.
2. **Batch B - Dashboard learning hierarchy:** priorities 2, 3, and 4.
3. **Batch C - Analytics first viewport:** priority 6.
4. **Batch D - Vocabulary clarity:** priorities 7 and 11.
5. **Batch E - Quiz focus:** priorities 9 and 10.
6. **Batch F - Vocabulary edit safety review:** priority 12; stop before JS restructuring if generated row coupling is unsafe.
7. **Batch G - Analytics recommendation:** priority 13; approve dynamic JS behavior separately if required.
8. **Batch H - Supporting product structure:** priorities 14, 15, and 16.
9. **Batch I - System polish:** priorities 17, 18, and 19.

After each batch:

- Capture matching after evidence for affected screens.
- Run frontend smoke tests.
- Compare against the acceptance criteria before starting the next batch.
- Do not combine CSS cleanup with a functional or structural batch.
