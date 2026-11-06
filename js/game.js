/* Sessional Arena quiz: 3 timed levels over the subject questions.
   Level 1: 15s/round, Level 2: 12s/round, Boss: 8s/round with a labelled
   trap round every 3rd round. 3 lives, combo multiplier up to x5
   (1 + floor(combo/3)), score (100 + 5 x seconds left) x multiplier,
   +250 on level clear, power-ups 50:50 / +5s / Shield / Hint starting
   at 1 each, +1 fifty and +1 time on every 5-combo.
   Ranks: DISTINCTION (>=3500), FIRST CLASS (>=2200), PASS (>=1100),
   else KEEP GRINDING.
   REVEAL: the answer panel is shown FIRST and scrolled into view
   before any voice work runs, the timer is cleared on reveal, and the
   next round starts ONLY on a NEXT tap. The reveal reads the FULL
   supporting passage aloud, never truncated. NEXT is sticky at the
   viewport bottom while reading (see css).
   RESUME: saved per subject under 'sessional-saved-<subject>'
   ('sessional-saved-all' for mixed quiz). The save happens on every
   state change (updateHUD) AND on quit, including post-answer states:
   saveGame no longer skips locked (revealed) states, so the score and
   combo earned on the just-answered question are persisted at once.
   A saved post-answer state records the outcome ('correct' | 'shield'
   | 'wrong') and the frozen time left; resume restores the exact
   score/combo/round/question/lives and re-shows the same reveal panel
   (options re-shuffled, as before) instead of re-asking the round,
   so the score can never be earned twice or lost by quitting.
   ROBUSTNESS (template rules, kept): every sound/voice call is guarded,
   and nextRound/answer advance even if sound/voice throws, via
   fallbackReveal with a working NEXT. Speech is never paused by this
   file; voice is TTS, never per-chunk Audio elements. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function settings() {
    return window.OphthSettings || { mode: 'browser', autoRead: true, rate: 1.0, sounds: true, muted: false };
  }
  function autoReadOn() { var s = settings(); return !!s.autoRead && !s.muted && s.mode !== 'off'; }
  function safeVoice(fn) { try { if (window.OphthVoice) fn(); } catch (e) {} }
  function safeAudio(fn) { try { if (window.OphthAudio) fn(); } catch (e) {} }

  var LEVELS = [
    { name: 'LEVEL 1', title: 'Level 1', desc: '15 seconds a round. Steady, accurate answers.', time: 15, count: 8 },
    { name: 'LEVEL 2', title: 'Level 2', desc: '12 seconds a round. The pace picks up.', time: 12, count: 8 },
    { name: 'BOSS', title: 'Boss Level', desc: '8 seconds a round, with a trap round every 3rd round.', time: 8, count: 10 }
  ];
  var FALLBACK_SUBJECTS = [
    { id: 'surgery', name: 'Surgery' },
    { id: 'ent', name: 'ENT' },
    { id: 'medicine', name: 'Medicine' },
    { id: 'gynecology', name: 'Gynecology' },
    { id: 'ophthalmology', name: 'Ophthalmology' },
    { id: 'pediatrics', name: 'Pediatrics' }
  ];

  var G = null, SUBJECTS = null, TOPICS = null, QUESTIONS = null, FIGURES = null;
  var best = 0, lastRevealText = '', revealed = false, levelTimer = null, revealSeq = 0;

  function ensureData() {
    if (QUESTIONS) return Promise.resolve(true);
    return Promise.all([
      OphthData.loadSubjects(), OphthData.loadTopics(),
      OphthData.loadQuestions(), OphthData.loadFigures(), OphthData.loadTables()
    ]).then(function (parts) {
      SUBJECTS = parts[0]; TOPICS = parts[1]; QUESTIONS = parts[2]; FIGURES = parts[3];
      return OphthTables.load();
    }).then(function () {
      return true;
    });
  }
  function sectionName(id) { return OphthData.subjectName(SUBJECTS || FALLBACK_SUBJECTS, id); }
  function topicFor(q) { return q ? OphthData.topicById(TOPICS || [], q.topicId) : null; }
  function topicTitleFor(q) {
    var t = topicFor(q);
    return t ? t.title : sectionName(q ? q.section : null);
  }
  function figuresFor(q) {
    var t = topicFor(q);
    return t ? OphthData.figuresForTopic(FIGURES || [], t) : [];
  }
  function stopGame() {
    if (G && G.timer) clearInterval(G.timer);
    safeVoice(function () { OphthVoice.stopSpeak(); });
    G = null;
  }

  /* ---------- Resume (pre-answer only) ---------- */
  function saveKey(subject) { return 'sessional-saved-' + (subject || 'all'); }
  function currentSubject() {
    try { if (window.OphthApp && typeof OphthApp.getSubject === 'function') return OphthApp.getSubject(); } catch (e) {}
    return null;
  }
  function saveGame() {
    try {
      if (!G || !QUESTIONS) return;
      /* No locked guard: post-answer states ARE saved (with the outcome
         and frozen time), so quitting during a reveal resumes the exact
         state instead of rolling the score back to the round start. */
      localStorage.setItem(saveKey(G.section), JSON.stringify({
        section: G.section, subject: G.section, level: G.level, score: G.score, lives: G.lives,
        combo: G.combo, bestCombo: G.bestCombo, correct: G.correct,
        answered: G.answered, queue: G.queue.map(function (x) { return x.id; }),
        qi: G.qi, pw: G.pw, shield: G.shield, savedAt: Date.now(),
        revealed: revealed, outcome: G.lastOutcome || null, remain: G.remain
      }));
    } catch (e) {}
  }
  function clearSavedGame(section) { try { localStorage.removeItem(saveKey(section || (G && G.section) || 'all')); } catch (e) {} }
  function readSavedGame(subject) {
    try {
      var raw = localStorage.getItem(saveKey(subject)); if (!raw) return null;
      var v = JSON.parse(raw);
      if (!v || !v.queue || !v.queue.length || typeof v.lives !== 'number') return null;
      return v;
    } catch (e) { return null; }
  }
  function refreshResume(subject) {
    var row = $('resumeRow'), btn = $('resumeBtn');
    var cur = subject || currentSubject();
    if (row && btn) {
      var v = cur ? readSavedGame(cur) : null;
      if (v) {
        btn.textContent = '↻ RESUME GAME · ' + LEVELS[v.level || 0].name + ' · ROUND ' + (v.qi + 1) + ' · SCORE ' + v.score + ' · ' + v.lives + ' ❤️';
        row.style.display = 'flex';
      } else row.style.display = 'none';
    }
    var rowAll = $('resumeRowAll'), btnAll = $('resumeBtnAll');
    if (rowAll && btnAll) {
      var vAll = readSavedGame('all');
      if (vAll) {
        btnAll.textContent = '↻ RESUME MIXED QUIZ · ' + LEVELS[vAll.level || 0].name + ' · ROUND ' + (vAll.qi + 1) + ' · SCORE ' + vAll.score + ' · ' + vAll.lives + ' ❤️';
        rowAll.style.display = 'flex';
      } else rowAll.style.display = 'none';
    }
  }
  function resumeGame(subject) {
    ensureData().then(function () {
      var v = readSavedGame(subject || currentSubject() || 'all');
      if (!v) { if (currentSubject()) { openChooser(); } else { OphthHome(); } return; }
      var byId = {}; (QUESTIONS || []).forEach(function (x) { byId[x.id] = x; });
      var queue = v.queue.map(function (id) { return byId[id]; }).filter(Boolean);
      if (!queue.length) { clearSavedGame(subject || currentSubject() || 'all'); if (currentSubject()) { openChooser(); } else { OphthHome(); } return; }
      G = { section: v.section || 'all', level: v.level || 0, score: v.score || 0, lives: v.lives,
        combo: v.combo || 0, bestCombo: v.bestCombo || 0, correct: v.correct || 0,
        answered: v.answered || 0, queue: queue, qi: Math.min(v.qi, queue.length - 1),
        timer: null, remain: 0, total: 0, locked: false, shield: !!v.shield,
        pw: v.pw || { fifty: 1, time: 1, shield: 1, hint: 1 } };
      $('lvlVal').textContent = LEVELS[G.level].name;
      OphthShow('gameScreen'); updateHUD(); showQuestion();
      /* Post-answer save: re-show the same reveal instead of re-asking
         the round, so the restored score/combo can never be re-earned. */
      if (v.revealed) { G.lastOutcome = v.outcome || null; restoreReveal(v.outcome, v.remain); }
    });
  }

  /* ---------- Chooser ---------- */
  function openChooser() {
    OphthData.loadSubjects().then(function (subs) {
      var list = (subs && subs.length) ? subs : FALLBACK_SUBJECTS;
      var cur = currentSubject();
      var box = $('chooserBtns'); box.innerHTML = '';
      var note = $('chooserNote');
      if (!subs || !subs.length) {
        note.textContent = 'Subject list is still loading — the built-in list is shown for now.';
        note.style.display = 'block';
      } else note.style.display = 'none';
      if (cur) {
        var b = document.createElement('button');
        /* Subject name FIRST and separated by · : chooser buttons are
           matched by exact subject name, or by the subject name as the
           leading segment before a · (the "Surgery · 40 topics"
           pattern). A plain "SURGERY QUIZ" label matches neither, so
           the subject quiz was unreachable from the chooser. */
        b.className = 'btn primary'; b.textContent = OphthData.subjectName(list, cur).toUpperCase() + ' · QUIZ ▶';
        b.onclick = function () { startFromChooser(cur); };
        box.appendChild(b);
      }
      var all = document.createElement('button');
      all.className = 'btn'; all.textContent = '▶ MIXED QUIZ · ALL SUBJECTS';
      all.onclick = function () { startFromChooser('all'); };
      box.appendChild(all);
      OphthShow('chooserScreen');
    });
  }
  function startFromChooser(section) {
    safeVoice(function () { OphthVoice.prime(); });
    safeAudio(function () { OphthAudio.ac(); OphthAudio.sfx('level'); });
    newGame(section);
  }

  /* ---------- Game flow ---------- */
  function mult() { return Math.min(5, 1 + Math.floor(G.combo / 3)); }
  function filteredPool() {
    var all = QUESTIONS || [];
    if (!G.section || G.section === 'all') return all;
    return all.filter(function (q) { return q.section === G.section; });
  }
  function newGame(section) {
    clearSavedGame(section || 'all');
    ensureData().then(function () {
      var pool = (section && section !== 'all')
        ? (QUESTIONS || []).filter(function (q) { return q.section === section; })
        : (QUESTIONS || []);
      if (!pool.length) { showEmpty(section); return; }
      G = { section: section || 'all', level: 0, score: 0, lives: 3, combo: 0,
        bestCombo: 0, correct: 0, answered: 0, queue: [], qi: 0, timer: null,
        remain: 0, total: 0, locked: false, shield: false,
        pw: { fifty: 1, time: 1, shield: 1, hint: 1 } };
      OphthShow('gameScreen');
      buildLevel(0);
    });
  }
  function showEmpty(section) {
    G = null;
    OphthShow('gameScreen');
    var stage = $('photoStage'); stage.style.display = 'none'; $('photoImg').removeAttribute('src');
    $('qTag').textContent = section && section !== 'all' ? sectionName(section).toUpperCase() : 'MIXED QUIZ';
    $('qTitle').textContent = 'Questions for this subject are still being loaded.';
    $('qClue').textContent = 'This subject has no questions yet. Try the mixed quiz, or come back when its content has loaded.';
    $('pointsTag').textContent = '';
    $('opts').innerHTML = '';
    $('feedback').classList.remove('on');
    $('qCount').textContent = 'ROUND — / —';
    $('timerText').textContent = '—';
    $('scoreVal').textContent = '0';
    $('hearts').innerHTML = '';
    $('dots').innerHTML = '';
  }
  function buildLevel(lv) {
    G.level = lv;
    var L = LEVELS[lv];
    var pool = filteredPool();
    G.queue = shuffle(pool).slice(0, L.count); G.qi = 0;
    $('lvlVal').textContent = L.name;
    updateHUD(); showQuestion();
  }
  function updateHUD() {
    if (!G) return;
    $('scoreVal').textContent = G.score;
    $('comboVal').textContent = G.combo;
    $('comboMult').textContent = '×' + mult();
    $('comboPill').classList.toggle('hot', G.combo >= 3);
    var h = '';
    for (var i = 0; i < 3; i++) h += '<span class="' + (i < G.lives ? 'beat' : 'lost') + '">❤️</span>';
    $('hearts').innerHTML = h;
    $('cFifty').textContent = G.pw.fifty; $('cTime').textContent = G.pw.time;
    $('cShield').textContent = G.pw.shield; $('cHint').textContent = G.pw.hint;
    $('pwFifty').disabled = G.pw.fifty <= 0 || G.locked;
    $('pwTime').disabled = G.pw.time <= 0 || G.locked;
    $('pwShield').disabled = G.pw.shield <= 0 || G.shield;
    $('pwHint').disabled = G.pw.hint <= 0 || G.locked;
    $('pwShield').classList.toggle('activeShield', G.shield);
    var d = '';
    for (var i = 0; i < G.queue.length; i++) d += '<span class="dot ' + (i < G.qi ? 'done' : i === G.qi ? 'now' : '') + '"></span>';
    $('dots').innerHTML = d;
    $('qCount').textContent = 'ROUND ' + Math.min(G.qi + 1, G.queue.length) + ' / ' + G.queue.length + (G.level === 2 ? ' · 👑 BOSS' : '');
    saveGame();
  }
  function curQ() { return G.queue[G.qi]; }
  function isTrap() { return G.level === 2 && (G.qi % 3 === 2); }
  function showQuestion() {
    safeVoice(function () { OphthVoice.stopSpeak(); });
    try { var sb = $('speakerBtn'); if (sb) sb.textContent = '🔊'; } catch (e) {}
    G.locked = false; revealed = false;
    var q = curQ(), L = LEVELS[G.level];
    $('hintBox').classList.remove('on');
    $('feedback').classList.remove('on');
    /* Figure: hide the <img> until it loads, so the previous round's
       figure never flashes on a round change. The stage reserves its
       height (css .photoStage min-height), so no layout jump. */
    var figs = figuresFor(q), stage = $('photoStage'), pimg = $('photoImg'), pcap = $('photoCap');
    if (figs.length) {
      stage.style.display = 'block'; pcap.style.display = 'none';
      pimg.style.visibility = 'hidden';
      pimg.onload = function () { pimg.style.visibility = 'visible'; };
      pimg.onerror = function () { stage.style.display = 'none'; };
      pimg.removeAttribute('src'); pimg.src = OphthData.figurePath(figs[0]);
      pimg.alt = 'Figure for this question — ' + topicTitleFor(q);
      pcap.textContent = '📷 ' + (figs[0].label || figs[0].topic);
    } else { stage.style.display = 'none'; pimg.removeAttribute('src'); }
    if (isTrap()) { $('qTag').textContent = '👑 BOSS TRAP — READ CAREFULLY'; $('qTag').className = 'tag bossTag'; }
    else { $('qTag').textContent = sectionName(q.section).toUpperCase(); $('qTag').className = 'tag'; }
    $('qTitle').textContent = q.question || '';
    $('qClue').textContent = 'From: ' + topicTitleFor(q);
    $('pointsTag').textContent = (100 * mult()) + ' PTS + TIME BONUS';
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { try { window.scrollTo(0, 0); } catch (e2) {} }
    var indexed = (q.options || []).map(function (txt, i) { return { txt: txt, correct: i === q.answerIndex }; });
    var opts = shuffle(indexed);
    var box = $('opts'); box.innerHTML = '';
    opts.forEach(function (o, i) {
      var b = document.createElement('button'); b.className = 'opt';
      var k = document.createElement('span'); k.className = 'key'; k.textContent = String(i + 1);
      var t = document.createElement('span'); t.textContent = o.txt;
      b.appendChild(k); b.appendChild(t);
      b.dataset.correct = o.correct ? '1' : '0';
      b.onclick = function () { answer(b); };
      box.appendChild(b);
    });
    startTimer(L.time); updateHUD();
    if (autoReadOn()) {
      setTimeout(function () { if (G && !G.locked) { try { speakRound(); } catch (e) {} } }, 400);
    }
  }
  function curSpeechTexts() {
    var q = curQ(), texts = [];
    if (isTrap()) texts.push('Boss trap round. Read carefully.');
    texts.push(q.question || '');
    texts.push('Your options are.');
    document.querySelectorAll('.opt').forEach(function (b, i) {
      var sp = b.querySelectorAll('span');
      if (sp[1]) texts.push('Option ' + (i + 1) + '. ' + sp[1].textContent);
    });
    return texts;
  }
  function speakRound() { safeVoice(function () { OphthVoice.speakTexts(curSpeechTexts()); }); }
  function startTimer(sec) {
    clearInterval(G.timer); G.total = sec; G.remain = sec; var lastTick = 99; tickUI();
    G.timer = setInterval(function () {
      G.remain = Math.max(0, G.remain - .1); tickUI();
      var s = Math.ceil(G.remain);
      if (s <= 3 && s < lastTick && G.remain > 0) { lastTick = s; safeAudio(function () { OphthAudio.sfx('tick'); }); }
      if (G.remain <= 0) { clearInterval(G.timer); timeoutAnswer(); }
    }, 100);
  }
  function tickUI() {
    var pct = G.total ? G.remain / G.total * 100 : 0;
    $('timerBar').style.width = pct + '%';
    $('timerText').textContent = G.remain.toFixed(1) + 's';
    $('timerWrap').classList.toggle('low', pct < 32);
  }
  function timeoutAnswer() {
    if (!G || G.locked) return;
    G.locked = true; safeVoice(function () { OphthVoice.stopSpeak(); });
    try { markCorrect(); resolve(false, '⏰ TIME UP! '); }
    catch (e) { fallbackReveal(); }
  }
  function markCorrect() {
    document.querySelectorAll('.opt').forEach(function (b) { b.disabled = true; if (b.dataset.correct === '1') b.classList.add('correct'); });
  }
  function correctAnswerText(q) {
    if (!q || !q.options || q.answerIndex == null) return '';
    return q.options[q.answerIndex] || '';
  }
  function passageFor(q) {
    if (q && q.passage) return q.passage;
    var t = topicFor(q);
    if (t && t.text) return t.text;
    return 'No supporting passage supplied for this question yet.';
  }
  /* Formatted reveal passage (v1.7): a passage is a verbatim span of the
     topic's plain text; clip the same span out of the topic's html so the
     reveal reads with the notes' bold/italics/list labels. Any doubt at
     all -> null, and the caller falls back to plain text. */
  function unescHtml(s) {
    return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }
  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function clipBlock(htmlBlock, plainBlock, cs, ce) {
    /* Clip plain range [cs, ce) out of one block's html. Returns
       {html, plain} (plain = the exact plain substring covered, for the
       caller's verification), or null on any surprise. */
    var parts = String(htmlBlock).split(/(<[^>]+>)/g);
    /* Synthesised list label: raw text at the block start (bullets /
       numbers the plain text does not have). A literal label (plain text
       starts with the same characters) is NOT a label. */
    var labelLen = 0, labelText = '';
    if (parts.length && parts[0]) {
      var lm = parts[0].match(/^((?: )*(?:•|–|◦|\d+\.) )/);
      if (lm) {
        var core = lm[1].replace(/ /g, '');
        if (String(plainBlock).indexOf(core) !== 0) {
          labelLen = lm[1].length;
          labelText = lm[1];
        }
      }
    }
    var stack = [], out = [], plainPos = 0, started = false;
    function openTags() {
      for (var i = 0; i < stack.length; i++) out.push('<' + stack[i] + '>');
    }
    function closeTags() {
      for (var i = stack.length - 1; i >= 0; i--) out.push('</' + stack[i] + '>');
    }
    for (var pi = 0; pi < parts.length; pi++) {
      var part = parts[pi];
      if (!part) continue;
      var tm = part.match(/^<\/?([a-z]+)>$/);
      if (tm) {
        var name = tm[1];
        if (['b', 'i', 'u', 's', 'sub', 'sup'].indexOf(name) < 0) return null;
        if (part.charAt(1) === '/') {
          var idx = stack.lastIndexOf(name);
          if (idx < 0) return null;
          stack.splice(idx, 1);
          if (started) out.push(part);
        } else {
          stack.push(name);
          if (started) out.push(part);
        }
        continue;
      }
      /* Text part: measure in plain characters (unescaped), skipping the
         synthesised label at the block start. */
      var raw = part, skip = 0;
      if (pi === 0 && labelLen) { skip = labelLen; }
      var u = unescHtml(raw.slice(skip));
      var p0 = plainPos, p1 = plainPos + u.length;
      plainPos = p1;
      var s0 = Math.max(cs, p0), s1 = Math.min(ce, p1);
      if (s1 <= s0) continue;
      if (!started) {
        started = true;
        if (cs === 0 && labelText) out.push(labelText);
        openTags();
      }
      out.push(escHtml(u.slice(s0 - p0, s1 - p0)));
    }
    if (!started) return null;
    closeTags();
    return { html: out.join(''), plain: String(plainBlock).slice(cs, ce) };
  }
  function excerptHtml(topicHtml, topicText, start, len) {
    try {
      var plainBlocks = String(topicText).split('\n\n');
      var htmlBlocks = String(topicHtml).split('\n\n');
      if (plainBlocks.length !== htmlBlocks.length) return null;
      var off = 0, starts = [];
      for (var i = 0; i < plainBlocks.length; i++) {
        starts.push(off);
        off += plainBlocks[i].length + 2;
      }
      var end = start + len, out = [], covered = [];
      for (var b = 0; b < plainBlocks.length; b++) {
        var bs = starts[b], be = bs + plainBlocks[b].length;
        if (be <= start || bs >= end) continue;
        var frag = clipBlock(htmlBlocks[b], plainBlocks[b],
          Math.max(start, bs) - bs, Math.min(end, be) - bs);
        if (frag == null) return null;
        out.push(frag.html);
        covered.push(frag.plain);
      }
      if (!out.length) return null;
      /* Verify the clip covers exactly the requested plain span; any
         block-boundary surprise (e.g. a paragraph ending in a line
         break) fails safe to plain text instead of a wrong passage. */
      if (covered.join('\n\n') !== String(topicText).slice(start, end)) {
        return null;
      }
      return out.join('\n\n');
    } catch (e) { return null; }
  }
  function setFormattedPassage(q) {
    try {
      var p = passageFor(q);
      if (!p || /\[\[TABLE:/.test(p)) return false;
      var t = topicFor(q);
      if (!t || !t.html || !t.text) return false;
      var start = t.text.indexOf(p);
      if (start < 0) return false;
      var frag = excerptHtml(t.html, t.text, start, p.length);
      if (frag == null) return false;
      $('fbPassage').innerHTML = frag;
      return true;
    } catch (e) { return false; }
  }
  function cleanSpeech(s) {
    try { if (window.OphthTables && OphthTables.stripMarkers) return OphthTables.stripMarkers(s || ''); } catch (e) {}
    return s || '';
  }
  /* Last-resort safety net: whatever throws inside the reveal, a tap
     must ALWAYS land on a visible answer panel with a working NEXT. */
  function fallbackReveal() {
    try {
      markCorrect();
      var q = curQ();
      $('fbTitle').textContent = 'Correct answer: ' + correctAnswerText(q);
      $('fbPassage').textContent = passageFor(q);
      $('nextBtn').textContent = 'NEXT ▶';
      var fb = $('feedback'); fb.className = 'feedback on';
      updateHUD();
      try { fb.scrollIntoView({ behavior: 'auto', block: 'start' }); } catch (e) {}
    } catch (e2) {}
  }
  function answer(btn) {
    if (!G || G.locked) return;
    G.locked = true; clearInterval(G.timer); safeVoice(function () { OphthVoice.stopSpeak(); });
    var good = btn.dataset.correct === '1';
    if (!good) btn.classList.add('wrong');
    try { markCorrect(); resolve(good, good ? '' : '✖ WRONG — that was a look-alike. '); }
    catch (e) { fallbackReveal(); }
  }
  /* FULL passage, never truncated (pre-wrap in css). Formatted like
     the notes when it is a verbatim span of the topic; plain text
     otherwise (table passages, paraphrases, any doubt). Shared by
     resolve() and restoreReveal() so both show the same passage. */
  function renderPassage(q) {
    if (!setFormattedPassage(q)) $('fbPassage').textContent = passageFor(q);
    try {
      var fp = $('fbPassage');
      if (OphthTables.renderInto && /\[\[TABLE:/.test(passageFor(q))) { OphthTables.renderInto(fp, passageFor(q)); }
      else if (OphthTables.getAllForTopic) { OphthTables.getAllForTopic(q.topicId).forEach(function (tab) { fp.appendChild(OphthTables.buildTable(tab)); }); }
      else { var tab = OphthTables.get(q.topicId); if (tab) fp.appendChild(OphthTables.buildTable(tab)); }
    } catch (e) {}
  }
  function resolve(good, prefix) {
    G.answered++;
    var q = curQ();
    var pcap = $('photoCap'), figs = figuresFor(q);
    if (pcap && figs.length) { pcap.textContent = '📷 ' + (figs[0].label || figs[0].topic); pcap.style.display = 'block'; }
    var fb = $('feedback');
    var correctTxt = correctAnswerText(q);
    if (good) {
      G.lastOutcome = 'correct';
      G.correct++; G.combo++; G.bestCombo = Math.max(G.bestCombo, G.combo);
      var gain = Math.round((100 + Math.round(G.remain * 5)) * mult());
      G.score += gain;
      safeAudio(function () { OphthAudio.sfx(G.combo > 0 && G.combo % 3 === 0 ? 'combo' : 'correct'); });
      if (G.combo > 0 && G.combo % 5 === 0) { G.pw.fifty++; G.pw.time++; }
      fb.className = 'feedback on good';
      $('fbTitle').textContent = '✔ CORRECT — ' + correctTxt;
    } else if (G.shield) {
      G.lastOutcome = 'shield';
      G.shield = false;
      fb.className = 'feedback on good';
      $('fbTitle').textContent = '🛡️ SHIELD USED! That mistake cost you nothing — this time.';
      safeAudio(function () { OphthAudio.sfx('power'); });
    } else {
      G.lastOutcome = 'wrong';
      G.lives--; G.combo = 0;
      safeAudio(function () { OphthAudio.sfx('wrong'); });
      fb.className = 'feedback on bad';
      $('fbTitle').textContent = prefix + 'Correct answer: ' + correctTxt;
    }
    renderPassage(q);
    revealed = true;
    var last = G.qi >= G.queue.length - 1;
    var outOfLives = (!good && !G.shield && G.lives <= 0);
    $('nextBtn').textContent = outOfLives ? 'SEE RESULTS ▶' : (last ? (G.level >= 2 ? 'FINISH ▶' : 'CLEAR LEVEL ▶') : 'NEXT ▶');
    /* Answer panel FIRST, scrolled into view, before any voice work. */
    fb.classList.add('on');
    updateHUD();
    try {
      if (fb.scrollIntoView) fb.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo(0, fb.offsetTop || 0);
    } catch (e) {}
    lastRevealText = $('fbTitle').textContent + '. ' + cleanSpeech(passageFor(q));
    var mySeq = ++revealSeq;
    if (autoReadOn()) {
      setTimeout(function () {
        if (mySeq !== revealSeq || !G || !G.locked) return;
        safeVoice(function () { OphthVoice.speakFullText(lastRevealText); });
      }, 300);
    }
  }
  /* Re-show a saved post-answer reveal (resume only): the score, combo,
     lives and round are already restored in G, so this rebuilds ONLY the
     reveal UI for the current question — it never re-awards or re-deducts
     anything. Options were re-shuffled by showQuestion(), as before, and
     the frozen time left is restored so the timer does not restart.
     No auto-read here: the user can replay the reveal with the speaker
     button; resuming must not start speech unprompted. */
  function restoreReveal(outcome, remain) {
    var q = curQ();
    if (!q) return;
    var fb = $('feedback');
    var correctTxt = correctAnswerText(q);
    clearInterval(G.timer);
    G.lastOutcome = outcome || null;
    G.locked = true;
    if (typeof remain === 'number' && remain >= 0) { G.remain = remain; tickUI(); }
    markCorrect();
    if (outcome === 'correct') {
      fb.className = 'feedback on good';
      $('fbTitle').textContent = '✔ CORRECT — ' + correctTxt;
    } else if (outcome === 'shield') {
      fb.className = 'feedback on good';
      $('fbTitle').textContent = '🛡️ SHIELD USED! That mistake cost you nothing — this time.';
    } else {
      fb.className = 'feedback on bad';
      $('fbTitle').textContent = 'Correct answer: ' + correctTxt;
    }
    renderPassage(q);
    revealed = true;
    var last = G.qi >= G.queue.length - 1;
    var outOfLives = (outcome === 'wrong' && G.lives <= 0);
    $('nextBtn').textContent = outOfLives ? 'SEE RESULTS ▶' : (last ? (G.level >= 2 ? 'FINISH ▶' : 'CLEAR LEVEL ▶') : 'NEXT ▶');
    fb.classList.add('on');
    updateHUD();
    try {
      if (fb.scrollIntoView) fb.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo(0, fb.offsetTop || 0);
    } catch (e) {}
    lastRevealText = $('fbTitle').textContent + '. ' + cleanSpeech(passageFor(q));
  }
  function nextRound() {
    /* NEXT must advance no matter what: sound/voice are best-effort
       only, and the advance itself has a fallback. */
    safeAudio(function () { OphthAudio.sfx('click'); });
    safeVoice(function () { OphthVoice.stopSpeak(); });
    if (!G) return;
    try {
      if (G.lives <= 0) { gameOver(); return; }
      if (G.qi < G.queue.length - 1) { G.qi++; showQuestion(); return; }
      if (G.level < 2) {
        var L = LEVELS[G.level + 1];
        G.score += 250;
        $('lvlKick').textContent = 'LEVEL ' + (G.level + 1) + ' CLEARED · +250 BONUS';
        $('lvlTitle').textContent = L.title;
        $('lvlDesc').textContent = L.desc;
        $('lvlBonus').textContent = 'SCORE ' + G.score + ' · LIVES ' + G.lives + ' · BEST COMBO ' + G.bestCombo;
        var ov = $('levelOverlay'); ov.classList.add('on');
        safeAudio(function () { OphthAudio.sfx('level'); });
        if (levelTimer) clearTimeout(levelTimer);
        levelTimer = setTimeout(function () { levelTimer = null; try { ov.classList.remove('on'); buildLevel(G.level + 1); } catch (e) {} }, 1600);
      } else victory();
    } catch (e) {
      try { showQuestion(); }
      catch (e2) { try { gameOver(); } catch (e3) {} }
    }
  }
  function fillEnd() {
    best = Math.max(best, G.score);
    $('stScore').textContent = G.score;
    $('stCombo').textContent = G.bestCombo;
    $('stAcc').textContent = (G.answered ? Math.round(G.correct / G.answered * 100) : 0) + '%';
    $('stRounds').textContent = G.correct + ' / ' + G.answered;
    $('rankLine').textContent = 'RANK: ' + (G.score >= 3500 ? '🏆 DISTINCTION' : G.score >= 2200 ? '⭐ FIRST CLASS' : G.score >= 1100 ? '🎓 PASS' : '🩺 KEEP GRINDING');
  }
  function gameOver() {
    clearSavedGame(); refreshResume();
    if (G) clearInterval(G.timer);
    safeVoice(function () { OphthVoice.stopSpeak(); });
    safeAudio(function () { OphthAudio.sfx('over'); });
    $('endKick').textContent = 'GAME OVER';
    $('endTitle').textContent = '💀 FLATLINED';
    $('endDesc').textContent = 'You ran out of lives in ' + LEVELS[G.level].title + '. Run it back and take the arena.';
    fillEnd(); OphthShow('resultsScreen');
  }
  function victory() {
    clearSavedGame(); refreshResume();
    safeVoice(function () { OphthVoice.stopSpeak(); });
    safeAudio(function () { OphthAudio.sfx('win'); });
    $('endKick').textContent = '👑 BOSS DEFEATED';
    $('endTitle').textContent = 'ARENA CLEARED!';
    $('endDesc').textContent = 'You beat the Boss level. Run it back to go again.';
    fillEnd(); OphthShow('resultsScreen');
  }
  document.addEventListener('DOMContentLoaded', function () {
    refreshResume();
    if ($('resumeBtn')) $('resumeBtn').onclick = function () { safeAudio(function () { OphthAudio.ac(); OphthAudio.sfx('level'); }); resumeGame(currentSubject()); };
    if ($('resumeBtnAll')) $('resumeBtnAll').onclick = function () { safeAudio(function () { OphthAudio.ac(); OphthAudio.sfx('level'); }); resumeGame('all'); };
    if ($('mixedBtn')) $('mixedBtn').onclick = function () { safeVoice(function () { OphthVoice.prime(); }); safeAudio(function () { OphthAudio.ac(); OphthAudio.sfx('level'); }); startFromChooser('all'); };
    if ($('levelOverlay')) $('levelOverlay').onclick = function () {
      if (!levelTimer || !G) return;
      clearTimeout(levelTimer); levelTimer = null;
      $('levelOverlay').classList.remove('on');
      try { buildLevel(G.level + 1); } catch (e) {}
    };
    window.addEventListener('pagehide', saveGame);
    window.addEventListener('beforeunload', saveGame);
    $('playBtn').onclick = function () { safeVoice(function () { OphthVoice.prime(); }); safeAudio(function () { OphthAudio.ac(); OphthAudio.sfx('level'); }); openChooser(); };
    $('chooserBack').onclick = function () { OphthHome(); };
    $('againBtn').onclick = function () { safeAudio(function () { OphthAudio.sfx('click'); }); newGame(G ? G.section : 'all'); };
    $('menuBtn').onclick = function () { OphthHome(); };
    $('quitGameBtn').onclick = function () { safeVoice(function () { OphthVoice.stopSpeak(); }); saveGame(); OphthHome(); };
    $('nextBtn').onclick = nextRound;
    $('replayRevealBtn').onclick = function () {
      safeVoice(function () { OphthVoice.prime(); });
      try { if (OphthVoice.isSpeaking && OphthVoice.isSpeaking()) { OphthVoice.stopSpeak(); return; } } catch (e) {}
      if (lastRevealText) { safeVoice(function () { OphthVoice.speakFullText(lastRevealText); }); }
    };
    $('speakerBtn').onclick = function () {
      safeVoice(function () { OphthVoice.prime(); });
      /* Speaker is a toggle: tap while reading stops it at once. */
      try { if (OphthVoice.isSpeaking && OphthVoice.isSpeaking()) { OphthVoice.stopSpeak(); $('speakerBtn').textContent = '🔊'; return; } } catch (e) {}
      try {
        if (revealed && lastRevealText) OphthVoice.speakFullText(lastRevealText);
        else if (G) speakRound();
        $('speakerBtn').textContent = '⏹️';
      } catch (e2) {}
    };
    document.addEventListener('ophth-voice-end', function () { var b = $('speakerBtn'); if (b) b.textContent = '🔊'; });
    document.addEventListener('ophth-voice-start', function () { var b = $('speakerBtn'); if (b) b.textContent = '⏹️'; });
    $('pwFifty').onclick = function () {
      if (!G || G.locked || G.pw.fifty <= 0) return;
      G.pw.fifty--; safeAudio(function () { OphthAudio.sfx('power'); });
      var wrong = shuffle([].slice.call(document.querySelectorAll('.opt')).filter(function (b) { return b.dataset.correct !== '1' && !b.classList.contains('eliminated'); }));
      wrong.slice(0, 2).forEach(function (b) { b.classList.add('eliminated'); b.disabled = true; });
      updateHUD();
    };
    $('pwTime').onclick = function () {
      if (!G || G.locked || G.pw.time <= 0) return;
      G.pw.time--; G.remain += 5; G.total += 5; safeAudio(function () { OphthAudio.sfx('power'); }); tickUI(); updateHUD();
    };
    $('pwShield').onclick = function () {
      if (!G || G.shield || G.pw.shield <= 0) return;
      G.pw.shield--; G.shield = true; safeAudio(function () { OphthAudio.sfx('power'); }); updateHUD();
    };
    $('pwHint').onclick = function () {
      if (!G || G.locked || G.pw.hint <= 0) return;
      G.pw.hint--; safeAudio(function () { OphthAudio.sfx('power'); });
      var hb = $('hintBox');
      hb.textContent = '💡 This question is from the topic: ' + topicTitleFor(curQ());
      hb.classList.add('on'); updateHUD();
    };
    document.addEventListener('keydown', function (e) {
      if (!G || G.locked || !$('gameScreen').classList.contains('on')) return;
      var idx = ['1', '2', '3', '4', 'a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
      if (idx < 0) return; if (idx > 3) idx -= 4;
      var b = document.querySelectorAll('.opt')[idx];
      if (b && !b.disabled) b.click();
    });
  });
  window.OphthGame = {
    newGame: newGame, resumeGame: resumeGame, refreshResume: refreshResume,
    stopGame: stopGame, openChooser: openChooser,
    bestScore: function () { return best; },
    _mult: mult, _shuffle: shuffle, _levels: LEVELS
  };
})();
