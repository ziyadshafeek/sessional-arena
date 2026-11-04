# Sessional Arena — Data Contract

This is the exact contract content team write to. The shell ships with
`subjects.json` filled (6 subjects) and the other files as `[]`, so the
site loads and shows honest "still being loaded" empty states until real
content lands. Nothing in this contract may be invented: topic text,
quiz passages, table cells and figure labels come from the source notes
only.

## Files

All files live under `data/` (relative to the site root) and are plain
JSON arrays. Figures live under `assets/figures/` and are referenced by
basename only. There is deliberately NO `data/sections.json` — it was
the single-subject engine's file and has been replaced by
`data/subjects.json`. (`js/data.js` keeps `loadSections()` as an alias
of `loadSubjects()` for old callers only; do not write `sections.json`.)

## data/subjects.json — [{id, name}]

```json
[
  { "id": "surgery", "name": "Surgery" },
  { "id": "ent", "name": "ENT" },
  { "id": "medicine", "name": "Medicine" },
  { "id": "gynecology", "name": "Gynecology" },
  { "id": "ophthalmology", "name": "Ophthalmology" },
  { "id": "pediatrics", "name": "Pediatrics" }
]
```

Rules: exactly these 6 ids; `name` is the display name shown on the
subject cards. No other subject id is valid.

## data/topics.json — [{id, subject, title, pages, text}]

Combined across all subjects, in one file.

```json
[
  {
    "id": "surgery-t01",
    "subject": "surgery",
    "title": "Topic title, as in the notes",
    "pages": "",
    "text": "Full verbatim topic text.\n\n[[TABLE:surgery-t01-1]]\n\nMore verbatim text after the table."
  }
]
```

Rules:

- `id` is unique across ALL subjects. Suggested pattern
  `<subject>-tNN` (e.g. `surgery-t01`, `ent-t12`), but uniqueness is the
  rule; the pattern is a convention, not a validator requirement.
- `subject` is one of the 6 ids in `subjects.json` and must agree with
  the subject of every question/figure/table that references the topic.
- `title` is the topic title as it appears in the notes.
- `pages` may be `""` — the docx sources have no page numbers. If a
  source ever supplies pages, use the same `"1-2"` string form as the
  old engine; never invent a page number.
- `text` is the full verbatim topic text, never summarised, never
  truncated. Table markers: a line containing exactly
  `[[TABLE:<tableId>]]` marks where that table's grid renders, in
  document order, between the surrounding text segments. A topic may
  carry several markers (one per table). Marker lines are stripped
  before any text is spoken aloud, and an unknown table id is skipped
  silently (the raw marker never reaches the UI).
- The loader also accepts a legacy `section` field in place of
  `subject` (it normalises `section` to `subject` on load), but new
  content MUST use `subject`.

## data/questions.json — [{id, subject, topicId, question, options[4], answerIndex, passage}]

Combined across all subjects, in one file.

```json
[
  {
    "id": "surgery-q001",
    "subject": "surgery",
    "topicId": "surgery-t01",
    "question": "Question phrasing (may be phrased by the content team)",
    "options": ["Correct option", "Distractor", "Distractor", "Distractor"],
    "answerIndex": 0,
    "passage": "A verbatim sentence from the topic text that supports the answer."
  }
]
```

Rules:

- `id` is unique across ALL subjects.
- `subject` is one of the 6 ids and MUST equal the referenced topic's
  subject (a mismatch hides the question from that subject's quiz).
- `topicId` MUST equal an existing topic `id`.
- `options` has exactly 4 entries; `answerIndex` is 0–3 and points at
  the correct option. The game shuffles option order at play time, so
  the correct option must not always sit at the same index in the file.
- `passage` is a verbatim sentence (or sentences) from the topic text,
  never paraphrased, never invented. It is shown in full on the answer
  reveal and read aloud. It must NOT contain a `[[TABLE:...]]` marker
  (markers belong in topic text, not in passages).
- A legacy `section` field is accepted in place of `subject`, but new
  content MUST use `subject`.

## data/figures.json — [{file, subject, topic, topicId, label}]

Combined across all subjects, in one file. Files live in
`assets/figures/`.

```json
[
  {
    "file": "surgery-fig-001.png",
    "subject": "surgery",
    "topic": "Topic title, as in the notes",
    "topicId": "surgery-t01",
    "label": "Short caption shown under the figure"
  }
]
```

Rules:

- `file` is the basename only (no directory, no `assets/figures/`
  prefix); the file must exist under `assets/figures/`.
- `subject` is one of the 6 ids and MUST equal the referenced topic's
  subject.
- `topicId` is the PRIMARY match key: a figure renders for a topic or
  question when `figure.topicId === topic.id`. `topic` (the title
  string) is the FALLBACK match key for title-only records. Supply both
  whenever possible.
- `label` is the caption shown under the figure (game, Learn, Library).
  If `label` is missing, the UI falls back to `topic`.
- A figure whose `topic` matches no topic title and whose `topicId`
  matches no topic id is still listed in the Library Figures tab.
- A legacy `pdfPage` field is tolerated (shown as "PDF page N" when
  present) but docx content has no PDF pages, so new records omit it.

## data/tables.json — [{id, topicId, subject, caption, columns, rows, note}]

Combined across all subjects, in one file.

```json
[
  {
    "id": "surgery-t01-1",
    "topicId": "surgery-t01",
    "subject": "surgery",
    "caption": "Table title",
    "columns": ["Feature", "A", "B"],
    "rows": [["Row label", "Cell", "Cell"]],
    "note": ""
  }
]
```

Rules:

- `id` is unique across ALL tables and is what `[[TABLE:<id>]]`
  markers in topic text reference. Suggested pattern
  `<topicId>-N`, but uniqueness is the rule.
- `topicId` MUST equal an existing topic `id`; `subject` MUST equal
  that topic's subject.
- `columns` is the header row; `rows` is an array of rows, each the
  same length as `columns`. The first cell of each row renders as a
  pinned row header (sticky first column inside the horizontal scroll
  wrapper, as in v1.1).
- Every cell MUST be a verbatim slice of its topic's text. A table
  failing that check must not be shipped (the old builder rule).
- `caption` is shown above the grid; `note` (may be `""`) is shown
  below it, e.g. for a source caveat.
- Multiple tables per topic are allowed and normal: one marker per
  table, in document order.
- Legacy `before`/`after` fields: if a table entry carries non-empty
  `before` or `after` text, the old v1.1 path renders
  before + grid + after, replacing the element. New content MUST use
  markers instead and MUST NOT set `before`/`after`. A legacy entry
  with neither markers nor `before`/`after` gets its grid appended
  after the topic text (v1.1 replaced the text with the grid alone,
  which discarded notes text; that behaviour is intentionally not
  carried over).

## Loader behaviour (what content team can rely on)

- `js/data.js` exposes `loadSubjects()`, `loadTopics()`,
  `loadQuestions()`, `loadFigures()`, `loadTables()` (all cached, all
  resolving to `[]` on a failed fetch, never rejecting).
- On load, every topic/question/figure/table record is normalised so
  both `subject` and `section` are present with the same value.
- `figuresForTopic(figures, topic)` matches by `topicId` first, then
  by title.
- `js/tables.js` exposes `load()`, `get(id)` (by table id, else first
  table for a topic id), `getById(id)`, `getAllForTopic(topicId)`,
  `applyTo(topicId, element)`, `buildTable(table)`,
  `stripMarkers(text)`, `renderInto(element, text)`.
- Quiz, Learn and Library all filter by the current subject, chosen on
  the Home subject cards. The mixed quiz (`section === 'all'` in game
  state) plays across all subjects with the same game code.

## App behaviour the contract supports (do not break)

- Resume is per subject: localStorage key `sessional-saved-<subject>`
  (`sessional-saved-all` for the mixed quiz), pre-answer states only —
  a post-answer state must never overwrite a pre-answer one.
- Settings (voice browser-only, auto-read, speed slider + presets,
  sounds, mute) are shared across subjects and stored under
  `sessional-arena-settings`.
- Voice is natural browser voice only (`speechSynthesis`, system
  default voice on phones, `lang: 'en'`, speed 0.5–2.0). There is no
  local voice model, no external voice library in
  this site, and no code path may add one. `stopSpeak()` uses
  `cancel()` only — never call `pause()` on speech.
- Tap targets are >= 48px (options >= 56px); the answer NEXT button is
  sticky at the viewport bottom; images stay hidden until loaded (no
  stale-photo flash); no horizontal overflow except inside table
  scroll wrappers.
