/* Learn Mode: flip cards from the subject topics, with automatic spaced
   repetition inside ONE run (no Anki-style interval options):
   - miss -> the card returns in ~3 cards
   - correct -> the card is pushed ~8+ cards away
   - a card leaves the deck only after two correct answers in a row
   Front: topic title + the prompt "What do you know about this topic?"
   + the topic's figure if it has one (hidden until loaded, so a stale
   figure never flashes). Back: the FULL verbatim topic text, scrollable,
   never truncated. Got it / Still learning are enabled only after flip.
   Decks: the current subject (from the subject home), or All topics
   when no subject is selected. Live mastery progress.
   VOICE: on flip, the full back text is read aloud (browser voice);
   flipping/grading/leaving Learn stops a reading (user taps only). */
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

  var L = null, SECTIONS = [], TOPICS = [], FIGURES = [];

  function currentSubject() {
    try { if (window.OphthApp && typeof OphthApp.getSubject === 'function') return OphthApp.getSubject(); } catch (e) {}
    return null;
  }
  function cleanSpeech(s) {
    try { if (window.OphthTables && OphthTables.stripMarkers) return OphthTables.stripMarkers(s || ''); } catch (e) {}
    return s || '';
  }
  function buildChips() {
    var box = $('learnChips'); box.innerHTML = '';
    var cur = currentSubject();
    if (cur) {
      var only = document.createElement('button');
      only.className = 'chip sel'; only.dataset.deck = cur;
      only.textContent = OphthData.subjectName(SECTIONS, cur);
      box.appendChild(only);
    } else {
      var all = document.createElement('button');
      all.className = 'chip sel'; all.dataset.deck = 'all'; all.textContent = 'All topics';
      box.appendChild(all);
      SECTIONS.forEach(function (s) {
        var b = document.createElement('button');
        b.className = 'chip'; b.dataset.deck = s.id; b.textContent = s.name;
        box.appendChild(b);
      });
    }
  }
  function deckFor(kind) {
    if (!kind || kind === 'all') return TOPICS.slice();
    return TOPICS.filter(function (t) { return t.section === kind; });
  }
  function startLearn(kind) {
    var cards = deckFor(kind || 'all');
    L = { kind: kind || 'all', total: cards.length,
      queue: shuffle(cards).map(function (t) { return { t: t, streak: 0 }; }),
      cur: null, flipped: false, reviews: 0, got: 0, mastered: 0 };
    $('learnDone').classList.remove('on');
    $('learnPlay').style.display = 'block';
    if (!cards.length) {
      $('learnPlay').style.display = 'none';
      var d = $('learnDone'); d.classList.add('on');
      $('learnDoneTxt').textContent = 'No topics in this deck yet — this subject is still being loaded.';
      return;
    }
    nextCard(true);
  }
  function updStats(nextTxt) {
    $('lsMastered').textContent = L.mastered + ' / ' + L.total;
    $('lsRotation').textContent = L.queue.length + (L.cur ? 1 : 0);
    $('lsReviews').textContent = L.reviews;
    $('lsAcc').textContent = L.reviews ? Math.round(100 * L.got / L.reviews) + '%' : '—';
    $('lsNext').textContent = nextTxt || '—';
    $('learnProg').style.width = (L.total ? Math.round(100 * L.mastered / L.total) : 0) + '%';
  }
  function backText(t) {
    return 'Topic: ' + t.title + '. ' + cleanSpeech(t.text || '');
  }
  function frontPrompt() { return 'What do you know about this topic?'; }
  /* The flip faces are absolutely positioned, so the inner container
     needs an explicit height or a long back would be clipped. Measure
     both faces' scroll heights and size to the larger one, so the full
     back text is always reachable (page scrolls if it is very long). */
  function syncFlipHeight() {
    try {
      var inner = document.querySelector('#flipCard .flipInner');
      var front = document.querySelector('#flipCard .flipFront');
      var back = document.querySelector('#flipCard .flipBack');
      if (!inner || !front || !back) return;
      var h = Math.max(front.scrollHeight || 0, back.scrollHeight || 0, 320);
      inner.style.height = h + 'px';
    } catch (e) {}
  }
  function nextCard(first) {
    if (!L.queue.length) { L.cur = null; finishLearn(); return; }
    L.cur = L.queue.shift(); L.flipped = false;
    var t = L.cur.t, fc = $('flipCard');
    fc.classList.remove('flipped');
    $('lfTag').textContent = OphthData.subjectName(SECTIONS, t.section).toUpperCase() + (t.pages ? ' · pp. ' + t.pages : '') + ' · FRONT';
    var figs = OphthData.figuresForTopic(FIGURES, t);
    var im = $('lfImg');
    if (figs.length) {
      im.style.visibility = 'hidden';
      im.onload = function () { im.style.visibility = 'visible'; syncFlipHeight(); };
      im.onerror = function () { im.style.display = 'none'; syncFlipHeight(); };
      im.removeAttribute('src'); im.src = OphthData.figurePath(figs[0]);
      im.alt = 'Figure: ' + (figs[0].label || figs[0].topic); im.style.display = 'block';
    } else { im.removeAttribute('src'); im.style.display = 'none'; }
    $('lfTitle').textContent = t.title;
    $('lfQ').textContent = frontPrompt();
    $('lbName').textContent = t.title;
    $('lbText').textContent = t.text || '';
    try { OphthTables.applyTo(t.id, $('lbText')); } catch (e) {}
    try { if (window.OphthTimer) { OphthTimer.attach($('learnTimer'), cleanSpeech(t.text || ''), 'learn:' + t.id); syncFlipHeight(); } } catch (e2) {}
    $('gradeMiss').disabled = true; $('gradeGot').disabled = true;
    updStats(first ? 'first card' : 'in ~3 cards if missed');
    syncFlipHeight();
    if (autoReadOn()) {
      setTimeout(function () {
        if (!L || !L.cur || L.flipped) return;
        safeVoice(function () { OphthVoice.speakFullText('Flashcard. ' + t.title + '. ' + frontPrompt()); });
      }, 80);
    }
  }
  function flip() {
    if (!L || !L.cur || L.flipped) return;
    L.flipped = true;
    $('flipCard').classList.add('flipped');
    $('gradeMiss').disabled = false; $('gradeGot').disabled = false;
    safeAudio(function () { OphthAudio.sfx('click'); });
    syncFlipHeight();
    /* Flip = user tap: stop the front reading, then read the FULL back. */
    if (autoReadOn()) {
      safeVoice(function () { OphthVoice.speakFullText(backText(L.cur.t)); });
    }
  }
  function grade(gotIt) {
    if (!L || !L.cur || !L.flipped) return;
    safeVoice(function () { OphthVoice.stopSpeak(); });
    var c = L.cur; L.reviews++; L.cur = null; var msg;
    if (gotIt) {
      L.got++; c.streak++;
      if (c.streak >= 2) { L.mastered++; msg = 'mastered ✓ — out of the deck'; }
      else { L.queue.splice(Math.min(L.queue.length, 8 + Math.floor(Math.random() * 3)), 0, c); msg = 'right once — returns in ~9 cards'; }
      safeAudio(function () { OphthAudio.sfx('correct'); });
    } else {
      c.streak = 0;
      L.queue.splice(Math.min(L.queue.length, 3), 0, c);
      msg = 'missed — returns in ~3 cards';
      safeAudio(function () { OphthAudio.sfx('wrong'); });
    }
    if (!L.queue.length && !L.cur) { finishLearn(); updStats(msg); return; }
    nextCard(false); updStats(msg);
  }
  function finishLearn() {
    $('learnPlay').style.display = 'none';
    var d = $('learnDone'); d.classList.add('on');
    $('learnDoneTxt').textContent = 'You mastered all ' + L.total + ' topics in ' + L.reviews + ' reviews (' + (L.reviews ? Math.round(100 * L.got / L.reviews) : 0) + '% first-flip accuracy).';
    safeAudio(function () { OphthAudio.sfx('win'); });
    safeVoice(function () { OphthVoice.stopSpeak(); });
  }
  function openLearn() {
    safeVoice(function () { OphthVoice.stopSpeak(); });
    try { if (window.OphthGame) OphthGame.stopGame(); } catch (e) {}
    var loader = OphthData.loadTopicsAndSubjects || OphthData.loadTopicsAndSections;
    loader().then(function (parts) {
      SECTIONS = parts.subjects || parts.sections; TOPICS = parts.topics;
      return OphthData.loadFigures();
    }).then(function (figs) {
      FIGURES = figs;
      return OphthTables.load();
    }).then(function () {
      buildChips();
      OphthShow('learnScreen');
      var sel = $('learnChips').querySelector('.chip.sel');
      startLearn(sel ? sel.dataset.deck : (currentSubject() || 'all'));
    });
  }
  function closeLearn() {
    safeVoice(function () { OphthVoice.stopSpeak(); });
    try { if (window.OphthTimer) OphthTimer.stop(); } catch (e) {}
    if (window.OphthHome) { OphthHome(); return; }
    OphthShow('homeScreen');
  }
  document.addEventListener('DOMContentLoaded', function () {
    $('learnBtn').onclick = function () { safeAudio(function () { OphthAudio.ac(); OphthAudio.sfx('level'); }); openLearn(); };
    $('learnExit').onclick = closeLearn;
    $('flipCard').onclick = function () { safeVoice(function () { OphthVoice.prime(); }); flip(); };
    $('flipCard').onkeydown = function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } };
    $('gradeMiss').onclick = function () { grade(false); };
    $('gradeGot').onclick = function () { grade(true); };
    $('learnSpeakerBtn').onclick = function () {
      safeVoice(function () { OphthVoice.prime(); });
      if (!L || !L.cur) return;
      try { if (OphthVoice.isSpeaking && OphthVoice.isSpeaking()) { OphthVoice.stopSpeak(); return; } } catch (e) {}
      safeVoice(function () {
        if (L.flipped) OphthVoice.speakFullText(backText(L.cur.t));
        else OphthVoice.speakFullText('Flashcard. ' + L.cur.t.title + '. ' + frontPrompt());
      });
    };
    $('learnChips').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      $('learnChips').querySelectorAll('.chip').forEach(function (c) { c.classList.remove('sel'); });
      b.classList.add('sel'); startLearn(b.dataset.deck);
    });
    $('learnAgain').onclick = function () { startLearn(L ? L.kind : 'all'); };
    $('learnToGame').onclick = function () { closeLearn(); $('playBtn').click(); };
    document.addEventListener('keydown', function (e) {
      if (!$('learnScreen').classList.contains('on') || !L) return;
      if (e.key === ' ') { e.preventDefault(); flip(); }
      if (L.flipped && (e.key === '1' || e.key.toLowerCase() === 'g')) grade(true);
      if (L.flipped && (e.key === '2' || e.key.toLowerCase() === 'm')) grade(false);
    });
  });
  window.OphthLearn = { backText: backText, deckFor: deckFor };
})();
