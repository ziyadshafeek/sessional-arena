# Sessional Arena — Integration Report (assembled + smoke-tested locally only)

**Status: NOT live, NOT fully verified.** The site is assembled under
`~/workspace/sessional-arena/` and smoke-tested against a local
`python3 -m http.server` only. Nothing was pushed and no Cloudflare
action was taken. A dedicated verification agent runs the harness
formally afterwards.

## 1. Per-subject counts (merged site data)

| Subject | Topics | Questions | Tables | Figures |
|---|---|---|---|---|
| Surgery | 42 | 84 | 9 | 91 |
| ENT | 38 | 89 | 13 | 59 |
| Medicine | 145 | 315 | 30 | 39 |
| Gynecology | 85 | 177 | 14 | 99 |
| Ophthalmology | 37 | 120 | 15 | 68 |
| Pediatrics | 71 | 193 | 30 | 33 |
| **Total** | **418** | **978** | **111** | **389** |

All totals match the expected sums. Note: the Ophthalmology table
count is **15** as extracted (`_extract/ophthalmology/tables.json`);
an earlier summary mentioned 8 — the file on disk is authoritative.

## 2. Merge + renumbering notes

- `data/topics.json`: straight concatenation in subject order
  surgery, ent, medicine, gynecology, ophthalmology, pediatrics,
  preserving within-subject order. All 418 ids unique; every topic's
  `subject` field matches the file it came from.
- `data/tables.json`: straight concatenation (111). Shape check
  against the `js/tables.js` marker model (`columns` = header cells,
  `rows` = data rows): every row length equals its `columns` length
  (zero shape mismatches), no table carries legacy `before`/`after`
  text.
- `data/questions.json`: all quiz files merged; Medicine halves
  (`questions-a.json` = t01–t72, `questions-b.json` = t73–t145)
  merged into one sequence. Renumbered per subject sequentially in
  **topic order first, then original file order within a topic**:
  `<subject>-q001`, `<subject>-q002`, … (e.g. surgery-q001…q084,
  medicine-q001…q315, pediatrics-q001…q193). Only the `id` field
  changed; question text, options, answerIndex and passages are
  byte-identical to the sources (verified: same multiset ignoring
  id/order). No question was dropped.
- `data/figures.json`: straight concatenation (389). Every figure
  file from `_extract/<subject>/figures/` was copied into
  `assets/figures/`. **Zero filename collisions** (names are already
  subject-prefixed), so no rename was needed; every figures.json
  entry has a file on disk and every copied file is referenced
  (zero unreferenced files).
- `data/subjects.json`: already correct (exactly the 6 subjects in
  contract order) — no fix needed. No `data/sections.json` was
  written (contract forbids it).
- No original docx file and no other game folder was modified.
  `_extract/` was only read, never written.

## 3. Normalisations / fixes applied

### Tables: header-duplication check — NONE found
For every table, `rows[0]` was compared to `columns`. **Zero tables**
had a duplicated header row, so **zero rows were dropped** and no
cell was altered. (The check ran; the result was empty.)

### Table-marker resolution — exact 1:1
- 111 `[[TABLE:<id>]]` markers occur in topic texts; every one
  resolves to exactly one table; every table is referenced at least
  once. Zero unresolved markers, zero unreferenced tables.

### NEXT-button fix (known harness finding)
Two changes in `css/style.css`, both minimal and theme-consistent:

1. **Fixed bottom NEXT bar during reveal** (replacing the old
   sticky rule): `.feedback.on .btnRow` is now
   `position:fixed; left:50%; transform:translateX(-50%); width:100%;
   max-width:980px; bottom:0` with panel background, a top border,
   safe-area padding and `z-index:60`, plus
   `.feedback.on{padding-bottom:calc(88px + safe-area)}` so the last
   passage lines are never hidden behind the bar. The bar exists
   only while `.feedback.on` (i.e. during a reveal) and disappears
   when NEXT is tapped. Short passages are unaffected (verified:
   all round-1 short-passage NEXT checks pass, see §6).
2. **Reveal animation made fade-only.** Root cause found by probe
   (see below): the old `@keyframes fbIn` animated `translateY`,
   and a transform animation with `fill:both` makes `.feedback` the
   containing block for fixed descendants — so the "fixed" bar was
   actually positioned relative to the panel and still fell below
   the fold on long passages (probe: long passage rect top=4671;
   with `animation:none` it snapped to top=709, bar bottom=844).
   `fbIn` now animates opacity only; the fade is kept, the
   containing-block side effect is gone. (The panel's `clip-path`
   was tested and ruled out — setting it to `none` changed nothing.)

### Quiz-chooser label fix (integration bug found by the harness)
The chooser's subject button read `▶ SURGERY QUIZ`. The harness
matches chooser buttons by exact subject name or by the subject as
the leading segment before a `·` (its documented "Surgery ·
40 topics" pattern); a leading `▶` and a following ` QUIZ` matched
neither, so every subject quiz was unreachable from the chooser.
The button now reads `SURGERY · QUIZ ▶` (`js/game.js`,
`openChooser()`), which is both a natural label and matches by the
exact-stripped rule. **Harness caveat (not a site change):** the
harness's own `__clickSubject` leading-word regex is broken by a
template-literal double-escape — its `(\s|-|$)` becomes literal
`(s|-|$)` after Node parses the template, so a "SURGERY QUIZ" label
could never match by leading word. The `·` label sidesteps this via
exact match; the verifier may still want to fix the harness regex
separately. The harness file was NOT modified by this integration.

### What was NOT changed
- No question, topic, table cell, figure or passage text was edited
  (except the zero header-row drops above — none occurred).
- `js/voice.js` was not touched: the headless `RangeError` voice
  warnings are documented harness-tolerated infra noise (see §6);
  voice still needs a real-phone test.

## 4. Validator results after renumbering

Run per subject with `_extract/validate_quiz.py` (questions + that
subject's topics + tables from the merged site data). All exit 0:

| Subject | Total | Passed | Failed | Topics | Topics with 0 questions |
|---|---|---|---|---|---|
| Surgery | 84 | 84 | 0 | 42 | 0 |
| ENT | 89 | 89 | 0 | 38 | 0 |
| Medicine | 315 | 315 | 0 | 145 | 0 |
| Gynecology | 177 | 177 | 0 | 85 | 0 |
| Ophthalmology | 120 | 120 | 0 | 37 | 0 |
| Pediatrics | 193 | 193 | 0 | 71 | 0 |
| **Total** | **978** | **978** | **0** | **418** | **0** |

No question failed after renumbering, so no question was dropped
for id reasons (as expected — renumbering only changes ids).

## 5. Ship hygiene

- `.gitignore` (site root) excludes `_extract/`, `_builder/`,
  `__pycache__/`, `*.pyc`, `quiz-sample/`.
- Read-only check of `~/workspace/sessional-push.py`'s `collect()`
  logic (module imported, `collect()` called only — `main()` never
  run, nothing pushed): **push set = 409 files, 92.68 MB total**
  (408 files / 92.66 MB before this INTEGRATION.md itself was
  added; this file ships as site documentation). Breakdown:
  `assets/figures` 389 files, `data` 5, `js` 8, `css` 1, plus
  `index.html`, `manifest.webmanifest`, `README.md`,
  `DATA_CONTRACT.md`, `.gitignore`, `INTEGRATION.md`.
  **Zero** `_extract/` / `__pycache__` / `*.pyc` / `quiz-sample`
  files leak into the push set. **No single file exceeds 25 MB**
  (largest: `data/topics.json` 2.28 MB; largest figure
  `gynecology-fig-017.png` 1.21 MB).
- Total site directory on disk is ~194 MB including `_extract/`;
  the shippable site (excluding `_extract/`) is ~97.2 MB, of which
  figures are ~93.8 MB.
- Placeholder grep over shipped data (`content on its way`,
  `lorem`, `TODO`, `XXX`, empty topic texts, empty questions,
  empty passages): **zero true placeholders**. The only `lorem`
  hits are substring false positives inside the word
  "hyperchloremic" (topics/questions/tables). Empty topic texts:
  0; empty questions: 0; empty passages: 0; passages containing a
  `[[TABLE:…]]` marker: 0.
- Speech-marker stripping (confirmed by grep): `js/tables.js`
  defines `stripMarkers()`; `js/game.js` `cleanSpeech()` (used for
  the reveal text read aloud) and `js/learn.js` `cleanSpeech()`
  (used for flashcard speech) both call it, so voice never reads a
  `[[TABLE:…]]` marker aloud. The "still being loaded" strings in
  `js/data.js` (comment), `js/game.js` and `js/learn.js` are engine
  fallback copy only — with full data loaded no subject shows them
  (every subject has topics and questions; the harness run shows
  real content everywhere, zero empty-state SKIPs).

## 6. Harness smoke results (local only — NOT formal verification)

Server: `python3 -m http.server 8933` in `~/workspace/sessional-arena/`.
Harness: `node ~/workspace/sessional-test/harness.mjs
http://localhost:8933/` (default all-subjects mode).

Final run (after all fixes above): **PASS=78 FAIL=6 SKIP=0 WARN=3.**

Per subject (final run):

| Subject | Library topics/tables/figures | Learn flip/grade | Quiz start + 2 rounds (reveal, NEXT, advance) | Quit/resume |
|---|---|---|---|---|
| Surgery | PASS / PASS / PASS | PASS / PASS | PASS, all 6 checks | FAIL (see below) |
| ENT | PASS / PASS / PASS | PASS / PASS | PASS, all 6 checks | FAIL (see below) |
| Medicine | PASS / PASS / PASS | PASS / PASS | PASS, all 6 checks | FAIL (see below) |
| Gynecology | PASS / PASS / PASS | PASS / PASS | PASS, all 6 checks | FAIL (see below) |
| Ophthalmology | PASS / PASS / PASS | PASS / PASS | PASS, all 6 checks | FAIL (see below) |
| Pediatrics | PASS / PASS / PASS | PASS / PASS | PASS, all 6 checks | FAIL (see below) |

Also PASS: home version label, 6 subject cards, Settings voice
speed persistence (1.25×), TEST SOUND / TEST VOICE existence,
global zero console exceptions.

- **NEXT (the known issue) is FIXED and verified by the harness:**
  all 12 NEXT-sticky checks pass with identical viewport-fixed
  rects (top=776, bottom=832, viewport=844) across short passages
  (68–164 chars) and long ones, including the previously failing
  shapes (Surgery round 2, 1062 chars, previously top=909;
  Ophthalmology round 2, 1315 chars, previously top=1389).
- **Library "418 entries visible" is a harness counting artifact,
  not a filtering failure.** The harness reports
  `max(visibleCards, libTopics.children.length)`; the DOM always
  holds all 418 cards and `applySearch()` hides the others. A
  direct probe confirmed filtering works: with Surgery selected,
  Library shows `42 ENTRIES SHOWN` and 42 visible cards.
- **Figure decode counts vary run to run** (e.g. 552–778 of 778
  imgs in the final run's subjects) — lazy images + headless
  timing; the harness passes whenever >0 decode, and all subjects
  pass. Not a failure, noted for the verifier.
- **WARN (3, tolerated infra noise):** headless `speechSynthesis`
  `RangeError` recursion inside `js/voice.js` (`speakChunkInner`),
  the exact noise the harness README documents as tolerated in
  headless runs. It is NOT counted as a failure, but voice/sound
  still need a real-phone test (harness asserts existence only).

### Remaining FAILs (6, all the same check) — quit expectation gap

Every subject fails only `[Subject] quiz: quit — "Quit clicked but
home never appeared"`, so the quit→resume checks never ran in the
harness. **This is a harness-expectation gap, not a broken quit,
proven by probe:** after quitting mid-quiz the app lands on the
**subject home screen** (not the main `homeScreen` the harness
waits for), with `↻ RESUME GAME · LEVEL 1 · ROUND 2 · SCORE 0`
visible and matching the pre-quit round/score, backed by
`localStorage` key `sessional-saved-<subject>`. That is the
engine's consistent "home" definition (`app.js` `goHome()` returns
to the subject home whenever a subject is selected — the same
destination as Library/Learn/Settings back buttons), and changing
quit to the main home would hide the per-subject resume button the
harness's own resume check looks for. Recommendation for the formal
verification: accept `subjectHomeScreen` as "home" after quit (or
update the harness quit check); do not reroute quit to the main
home just to satisfy the check.

### Earlier smoke runs (for the record)
- Run 1: PASS=34 FAIL=7 — 5× chooser unreachable (old `▶ …` label)
  + Pediatrics learn/quiz cascade failure (passed on rerun; flake).
- Run 2 (after first label fix): PASS=36 FAIL=6 — chooser still
  failed; diagnosis via diagnostic copy + console logging proved
  the button existed and matched, exposing the harness lead-regex
  escaping bug (§3).
- Run 3 (after `·` label fix): PASS=76 FAIL=8 — quiz fully
  reachable; 2 NEXT-sticky failures on long passages + 6 quit
  expectation failures.
- Run 4 (after fade-only animation fix): PASS=78 FAIL=6 — only the
  6 quit expectation failures remain.

## 7. Remaining issues / gaps (for the verifier, not fixed here)

1. **Quit/resume harness checks never executed** (see §6): quit
   works by probe, but the harness's `homeScreen`-only wait fails
   it for all subjects. Formal verification must resolve the
   expectation (accept subject home) before quit/resume can pass.
2. **Harness `__clickSubject` leading-word regex is broken**
   (§3): after Node template parsing, `(\s|-|$)` becomes
   `(s|-|$)` — a label like "SURGERY QUIZ" can never match by
   leading word. Sidestepped site-side with the `·` label; the
   harness itself is untouched and could still bite other labels.
3. **Voice/sound on a real phone untested** (harness asserts
   existence only; headless voice recurses into `RangeError`).
   Needs: fresh Chrome tab on a real phone — TEST SOUND heard or
   not, TEST VOICE, voice-speed effect, Learn/quiz auto-read.
4. **Subject-filtering depth**: the harness confirms screens work
   per subject but does not prove every shown topic/question
   belongs to that subject (its own README caveat). Spot-check ≥1
   topic/question per subject by hand.
5. **Content correctness**: validator PASS means mechanically
   traceable to topic text, never clinically verified; passages,
   table cells and figure/topic pairing still need human review
   against the source docx (notably the pre-existing empty `()`
   dose gaps in some Pediatrics text, carried over verbatim from
   extraction — nothing was invented to fill them).
6. **Visual/mobile layout on a real 390px phone** (overlap,
   readability, the fixed NEXT bar against the replay button and
   the quit row) — harness checks rects, not appearance.
7. **Resume across a real browser restart** (close/reopen Chrome)
   — harness quits/resumes within one session only.
8. **No deploy performed.** Push + Cloudflare Pages deploy is a
   later step; the push set above (§5) is what it would ship.
