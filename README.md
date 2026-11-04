# Sessional Arena — v1 (shell build)

Static site, no build step. Cloned from the proven v1.1
ophthalmology-notes-game engine and generalised from single-subject to
multi-subject. **Do not deploy** — the coordinator swaps in real content
and verifies. No live URL exists for this shell yet.

## Run locally

```sh
cd ~/workspace/sessional-arena
python3 -m http.server 8000
```

Then open <http://localhost:8000/> in a browser. (A plain `file://` open
will fail the `fetch()` data loads; a local static server is required.)
First paint loads only `index.html` + `css/style.css` + small JS — no
data file is fetched until its screen is first used.

## Screens

- **Home (subject chooser)** — "Sessional Arena", "Sessional Arena v1",
  6 subject cards (Surgery, ENT, Medicine, Gynecology, Ophthalmology,
  Pediatrics), a Mixed Quiz button, Settings, Full Screen, and a resume
  row for the mixed quiz when one exists. Tapping a subject opens that
  subject's home.
- **Subject home** — subject name, Play (Quiz), Learn, Library,
  Settings, Full Screen, a per-subject resume row, and a Subjects
  button back to the chooser. HOME buttons from game/learn/library
  return here (not to the chooser) while a subject is selected.
- **Quiz chooser** — shown before every Play from a subject home:
  that subject's quiz, plus Mixed Quiz across all subjects. Mixed quiz
  is the same game code with an unfiltered pool, so it costs nothing in
  reliability.
- **Quiz** — 3 levels: Level 1 (15s/round), Level 2 (12s), Boss (8s, trap
  round labelled every 3rd round). 3 lives, combo multiplier up to ×5,
  score (100 + 5×seconds left) × multiplier, +250 level-clear bonus,
  power-ups 50:50 / +5s / Shield / Hint (start 1 each, +1 fifty and +1
  time every 5-combo). Ranks: DISTINCTION (≥3500), FIRST CLASS (≥2200),
  PASS (≥1100), else KEEP GRINDING. Answer reveal shows the correct
  answer + the FULL supporting passage (never truncated) with NEXT
  sticky at the viewport bottom; timer cleared on reveal; next round
  only on NEXT tap. Figure questions show the topic's figure, hidden
  until it loads (no stale-figure flash). Auto-read reads question +
  options by default; reveal reads the full passage; the speaker button
  is a toggle. Resume uses localStorage keys
  `sessional-saved-<subject>` (`sessional-saved-all` for mixed quiz),
  pre-answer states only — a post-answer state never overwrites one.
- **Learn** — flip cards: front = topic title + "What do you know about
  this topic?" + figure if any; back = FULL verbatim topic text,
  scrollable, never truncated, with `[[TABLE:<id>]]` markers rendered
  as real grids in document order. Got it / Still learning enable only
  after flip. Automatic spaced repetition in one run only: miss →
  returns in ~3 cards, correct → pushed ~8+ away, leaves the deck only
  after two correct in a row. Decks: the current subject (a single
  chip); All topics only when no subject is selected. Live mastery
  progress.
- **Library** — search box + subject filter chip (the current subject
  only; All subjects when none selected) + topic list (tap a topic to
  expand its FULL text + figures + in-place tables); a Figures tab
  lists all figures with topic/label captions. Library re-renders when
  the subject changes, so switching subjects never shows stale entries.
- **Settings** (shared across subjects) — Voice on/off (maps to
  muted/mode), Auto-read, Voice SPEED slider (0.5–2.0, step 0.05) +
  presets 0.75× / 1× / 1.25× / 1.5× (calls `OphthVoice.setRate` when
  present, else sets `settings.rate` + saves, and updates the displayed
  value live), Sounds, Mute voice, TEST VOICE (browser voice test
  sentence, unmutes first, primes on tap), TEST SOUND (tap-synchronous
  beep scale via OphthAudio, ignoring the Sounds setting), RESET SOUND
  SETTINGS (sounds on, unmuted, mode browser, auto-read on, rate 1.0).
  Voice status paragraph `#voiceStatus` is updated by
  `OphthVoice.updateVoiceStatus()`.

## Data files it expects (content team own these)

See `DATA_CONTRACT.md` for the exact shapes. In short:

```
data/subjects.json  [{id, name}]  — the 6 subjects (shipped filled)
data/topics.json    [{id, subject, title, pages, text}]
                    — pages may be ""; text may carry [[TABLE:<id>]] lines
data/questions.json [{id, subject, topicId, question,
                      options[4], answerIndex, passage}]
data/figures.json   [{file, subject, topic, topicId, label}]
assets/figures/     — figure files named by figures.json `file`
data/tables.json    [{id, topicId, subject, caption, columns, rows, note}]
```

Loader (`js/data.js`): subjects on first Home use, topics on first
Learn/Library/chooser use, questions on first Play, figures on first
Library/quiz use, tables alongside topics; all fetches cached; a failed
fetch resolves to `[]` (honest "still being loaded" message, never a
crash). A figure matches a topic/question by `topicId` first, then by
title. The old `data/sections.json` is gone; `loadSections()` is only
an alias of `loadSubjects()`.

## Shell state (v1, before content lands)

- `data/subjects.json` — the 6 contract subjects.
- `data/topics.json`, `data/questions.json`, `data/figures.json`,
  `data/tables.json` — `[]` (zero content). Quiz/Learn/Library code
  already renders topics, questions, figures and tables when present;
  verify with real content after the content team land.
- `assets/figures/` — empty directory, kept for the content team.
- No ophthalmology notes content and no placeholder text in the UI:
  empty states say only that a subject is still being loaded.

## Files owned by this build

```
index.html  manifest.webmanifest  README.md  DATA_CONTRACT.md
css/style.css
js/data.js  js/game.js  js/learn.js  js/library.js  js/app.js
js/tables.js
```

NOT changed in behaviour: `js/voice.js` (browser speechSynthesis only
— new settings key `sessional-arena-settings`, rebranded header/test
sentence; internal `Ophth*` global names kept deliberately so no
cross-file call breaks) and `js/audio.js` (WebAudio beeps, never
throws). There is no local voice model, no external
voice library anywhere in this site.

## Robustness rules carried over from v1.1

- Every sound/voice call wrapped in try/catch (or the safeVoice/
  safeAudio guards); nextRound/answer advance even if sound/voice
  throws, via a fallback reveal with a working NEXT.
- Voice is TTS only: `OphthVoice.prime()` is called synchronously
  inside every Play/speaker/replay/TEST VOICE tap handler; `pause()` is
  never called on speech (`stopSpeak()` uses `cancel()` only); no
  per-chunk Audio elements are created for voice.
- Tap targets ≥48px (options ≥56px), safe-area padding, figure area
  height reserved (no layout jump), fullscreen via standard +
  webkit/moz/ms APIs, manifest display fullscreen.
- Tables: horizontal scroll wrapper, pinned first column, sticky NEXT
  unaffected; marker segments use pre-wrap divs in document order.
- All game/learn/app code passes `node --check`.

## Verification done by this build

- `node --check` passes on every `js/*.js` file.
- JSON validity checked for all five data files.
- DOM audit: every `getElementById` target in the shell JS exists in
  `index.html`; every button id in `index.html` is wired or is a
  dynamically built subject card.
- Served over `python3 -m http.server` and fetched index + all data
  files + all JS/CSS over HTTP (200).
- NOT verified (needs a real browser/phone, which this agent cannot
  drive): actual speechSynthesis playback, phone-width visual layout,
  subject-card tap flow, and any behaviour with real content loaded —
  that verification comes later, with real content.
