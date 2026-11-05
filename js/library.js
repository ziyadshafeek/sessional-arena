/* Library: rendered only when Library is first opened — never on page
   load. Topics tab: every topic, expandable to its FULL verbatim text
   plus its figures. Figures tab: every figure with its topic label. A search box filters the visible tab; section filter chips
   (the current subject, or All subjects when no subject is selected)
   filter by subject. Figures are lazy-loaded
   <img> elements under assets/figures/. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function safeVoice(fn) { try { if (window.OphthVoice) fn(); } catch (e) {} }
  function safeAudio(fn) { try { if (window.OphthAudio) fn(); } catch (e) {} }

  var SECTIONS = [], TOPICS = [], FIGURES = [];
  var rendered = false, currentTab = 'topics', currentSection = 'all';
  var sectionChipsBuilt = false, lastSubject = null;
  var activeLibVoiceBtn = null;
  document.addEventListener('ophth-voice-start', function () {
    try { if (activeLibVoiceBtn) activeLibVoiceBtn.textContent = '⏹️'; } catch (e) {}
    try { libPlayerSyncPlay(); } catch (e2) {}
  });
  document.addEventListener('ophth-voice-end', function () {
    try { if (activeLibVoiceBtn) activeLibVoiceBtn.textContent = '🔊'; } catch (e) {}
    activeLibVoiceBtn = null;
    try { libPlayerSyncPlay(); } catch (e2) {}
  });

  /* ---------- Library mini player: icons only, docked at the bottom ----------
     Opens from any topic's speaker icon and plays even when the voice
     setting is off — the tap itself is the student's choice (forced
     playback). Prev/next walk the currently visible topic list. */
  var libPlayer = null, libPlayerTitle = null, libPlayerPlay = null,
      libPlayerSpeed = null, libPlayerPrev = null, libPlayerNext = null,
      libPlayerSeek = null;
  var libPlayerCurrent = null, libPlayerTopic = null;
  var libPlayerRates = [0.75, 1, 1.25, 1.5];
  var libPlayerRatio = 0, libPlayerSeeking = false;
  function libPlayerFill() {
    try {
      if (!libPlayerSeek) return;
      var pct = (Number(libPlayerSeek.value) || 0) / 10;
      libPlayerSeek.style.setProperty('--fill', pct + '%');
    } catch (e) {}
  }
  document.addEventListener('ophth-voice-progress', function () {
    try {
      if (!libPlayer || libPlayer.hidden || !libPlayerTopic || libPlayerSeeking) return;
      var pr = window.OphthVoice ? window.OphthVoice.getProgress() : null;
      if (!pr || !pr.total) return;
      libPlayerRatio = pr.total ? pr.index / pr.total : 0;
      if (libPlayerSeek) { libPlayerSeek.value = Math.round(libPlayerRatio * 1000); libPlayerFill(); }
    } catch (e) {}
  });
  function libPlayerClean(t) {
    try { return String(t.title + '. ' + (t.text || '')).replace(/\[\[TABLE:[^\]]*\]\]/g, ' ').replace(/\s+/g, ' ').trim(); }
    catch (e) { return ''; }
  }
  function libPlayerVisible() {
    var out = [];
    try {
      var all = document.querySelectorAll('#libTopics details');
      for (var i = 0; i < all.length; i++) { if (all[i].style.display !== 'none') out.push(all[i]); }
    } catch (e) {}
    return out;
  }
  function libPlayerTopicFor(detailsEl) {
    try {
      var id = detailsEl.dataset.topicId; if (!id) return null;
      for (var i = 0; i < TOPICS.length; i++) { if (TOPICS[i].id === id) return TOPICS[i]; }
    } catch (e) {}
    return null;
  }
  function libPlayerSyncPlay() {
    try {
      if (!libPlayerPlay) return;
      libPlayerPlay.textContent = (window.OphthVoice && window.OphthVoice.isSpeaking()) ? '⏸' : '▶';
    } catch (e) {}
  }
  function libPlayerSyncNav() {
    try {
      if (!libPlayerPrev || !libPlayerNext || !libPlayerCurrent) return;
      var list = libPlayerVisible(); var idx = list.indexOf(libPlayerCurrent);
      libPlayerPrev.classList.toggle('lpDim', idx <= 0);
      libPlayerNext.classList.toggle('lpDim', idx < 0 || idx >= list.length - 1);
    } catch (e) {}
  }
  function libPlayerSync() { libPlayerSyncPlay(); libPlayerSyncNav(); }
  function ensureLibPlayer() {
    if (libPlayer) return libPlayer;
    try {
      var p = document.createElement('div'); p.className = 'libPlayer'; p.hidden = true;
      libPlayerSeek = document.createElement('input');
      libPlayerSeek.type = 'range'; libPlayerSeek.className = 'lpSeek';
      libPlayerSeek.min = '0'; libPlayerSeek.max = '1000'; libPlayerSeek.value = '0';
      libPlayerSeek.setAttribute('aria-label', 'Seek');
      p.appendChild(libPlayerSeek);
      var row = document.createElement('div'); row.className = 'lpRow'; p.appendChild(row);
      function mk(txt, act, cls) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'lpBtn' + (cls ? ' ' + cls : '');
        b.textContent = txt; b.dataset.act = act; b.setAttribute('aria-label', act); row.appendChild(b); return b;
      }
      libPlayerPrev = mk('⏮', 'prev'); libPlayerPlay = mk('▶', 'play', 'lpPlay');
      libPlayerNext = mk('⏭', 'next');
      libPlayerTitle = document.createElement('div'); libPlayerTitle.className = 'lpTitle'; row.appendChild(libPlayerTitle);
      libPlayerSpeed = mk('1×', 'speed', 'lpSpeed');
      mk('✕', 'close', 'lpClose');
      libPlayerSeek.addEventListener('pointerdown', function () { libPlayerSeeking = true; });
      libPlayerSeek.addEventListener('input', function () { libPlayerFill(); });
      libPlayerSeek.addEventListener('change', function () {
        libPlayerSeeking = false;
        var ratio = (Number(libPlayerSeek.value) || 0) / 1000;
        libPlayerRatio = ratio; libPlayerFill();
        safeVoice(function () {
          window.OphthVoice.prime();
          var ok = false;
          try { ok = window.OphthVoice.seekTo(ratio); } catch (e) { ok = false; }
          if (!ok && libPlayerTopic) { window.OphthVoice.speakForcedAt(libPlayerClean(libPlayerTopic), ratio); }
          libPlayerSync();
        });
      });
      p.addEventListener('click', function (e) {
        var b = e.target.closest('.lpBtn'); if (!b) return;
        var act = b.dataset.act;
        if (act === 'close') { closeLibPlayer(); return; }
        if (act === 'play') {
          safeVoice(function () {
            window.OphthVoice.prime();
            if (window.OphthVoice.isSpeaking()) { window.OphthVoice.stopSpeak(); }
            else if (libPlayerTopic) {
              if (libPlayerRatio > 0.01 && libPlayerRatio < 0.999) { window.OphthVoice.speakForcedAt(libPlayerClean(libPlayerTopic), libPlayerRatio); }
              else { window.OphthVoice.speakForced(libPlayerClean(libPlayerTopic)); }
            }
            libPlayerSyncPlay();
          });
          return;
        }
        if (act === 'speed') {
          safeVoice(function () {
            var cur = 1; try { cur = window.OphthVoice.settings.rate || 1; } catch (e2) {}
            var idx = 0, best = 1e9;
            for (var i = 0; i < libPlayerRates.length; i++) { var dd = Math.abs(libPlayerRates[i] - cur); if (dd < best) { best = dd; idx = i; } }
            var next = libPlayerRates[(idx + 1) % libPlayerRates.length];
            var set = window.OphthVoice.setRate(next);
            libPlayerSpeed.textContent = set + '×';
          });
          return;
        }
        if (act === 'prev' || act === 'next') {
          var list = libPlayerVisible(); var at = list.indexOf(libPlayerCurrent); if (at < 0) return;
          var to = act === 'prev' ? at - 1 : at + 1; if (to < 0 || to >= list.length) return;
          var d = list[to]; var topic = libPlayerTopicFor(d); if (!topic) return;
          openLibPlayer(d, topic);
          safeVoice(function () {
            window.OphthVoice.prime();
            if (window.OphthVoice.isSpeaking()) window.OphthVoice.stopSpeak();
            window.OphthVoice.speakForced(libPlayerClean(topic));
            libPlayerSync();
          });
        }
      });
      document.body.appendChild(p); libPlayer = p;
    } catch (e) {}
    return libPlayer;
  }
  function openLibPlayer(detailsEl, topic) {
    try {
      ensureLibPlayer(); if (!libPlayer) return;
      libPlayerCurrent = detailsEl; libPlayerTopic = topic;
      libPlayerTitle.textContent = topic.title;
      libPlayerRatio = 0;
      try { if (libPlayerSeek) { libPlayerSeek.value = '0'; libPlayerFill(); } } catch (e) {}
      try { var r = window.OphthVoice.settings.rate || 1; libPlayerSpeed.textContent = r + '×'; } catch (e) {}
      libPlayer.hidden = false;
      try { detailsEl.open = true; } catch (e2) {}
      try { detailsEl.scrollIntoView({ block: 'start' }); } catch (e3) {}
      libPlayerSync();
    } catch (e) {}
  }
  function closeLibPlayer() {
    try { safeVoice(function () { window.OphthVoice.stopSpeak(); }); } catch (e) {}
    libPlayerCurrent = null; libPlayerTopic = null; libPlayerRatio = 0;
    try { if (libPlayer) libPlayer.hidden = true; } catch (e2) {}
  }
  function currentSubject() {
    try { if (window.OphthApp && typeof OphthApp.getSubject === 'function') return OphthApp.getSubject(); } catch (e) {}
    return null;
  }

  function buildSectionChips() {
    var box = $('libSectionChips'); box.innerHTML = '';
    var cur = currentSubject();
    if (cur) {
      currentSection = cur;
      var only = document.createElement('button');
      only.className = 'chip sel'; only.dataset.section = cur;
      only.textContent = OphthData.subjectName(SECTIONS, cur);
      box.appendChild(only);
    } else {
      currentSection = 'all';
      var all = document.createElement('button');
      all.className = 'chip sel'; all.dataset.section = 'all'; all.textContent = 'All subjects';
      box.appendChild(all);
      SECTIONS.forEach(function (s) {
        var b = document.createElement('button');
        b.className = 'chip'; b.dataset.section = s.id; b.textContent = s.name;
        box.appendChild(b);
      });
    }
    sectionChipsBuilt = true;
  }
  function renderTopics() {
    try { closeLibPlayer(); } catch (e) {}
    var box = $('libTopics'); box.innerHTML = '';
    TOPICS.forEach(function (t) {
      var d = document.createElement('details'); d.className = 'noteCard';
      d.dataset.topicId = t.id;
      d.dataset.search = (t.title + ' ' + (t.text || '') + ' ' + OphthData.subjectName(SECTIONS, t.section)).toLowerCase();
      d.dataset.section = t.section || '';
      var s = document.createElement('summary');
      s.textContent = t.title + (t.pages ? ' · pp. ' + t.pages : '');
      d.appendChild(s);
      var meta = document.createElement('div'); meta.className = 'topicMeta';
      meta.textContent = OphthData.subjectName(SECTIONS, t.section).toUpperCase();
      d.appendChild(meta);
      var figs = OphthData.figuresForTopic(FIGURES, t);
      if (figs.length) {
        var ph = document.createElement('div'); ph.className = 'libPhotos';
        figs.forEach(function (f) {
          var im = document.createElement('img');
          im.src = OphthData.figurePath(f); im.loading = 'lazy'; im.decoding = 'async';
          im.alt = 'Figure: ' + (f.label || f.topic) + (f.pdfPage ? ' · PDF page ' + f.pdfPage : '');
          ph.appendChild(im);
        });
        d.appendChild(ph);
      }
      var tx = document.createElement('div'); tx.className = 'libText';
      if (t.html) { tx.innerHTML = t.html; } else { tx.textContent = t.text || ''; }
      try { OphthTables.applyTo(t.id, tx, t.html || null); } catch (e) {}
      d.appendChild(tx);
      d.addEventListener('toggle', function () {
        if (!d.open) {
          try { if (activeLibVoiceBtn && d.contains(activeLibVoiceBtn)) safeVoice(function () { window.OphthVoice.stopSpeak(); }); } catch (e) {}
          try {
            if (libPlayerCurrent === d) { libPlayerCurrent = null; libPlayerTopic = null; libPlayerRatio = 0; if (libPlayer) libPlayer.hidden = true; }
          } catch (e2) {}
          return;
        }
        if (d.dataset.timerDone) return;
        d.dataset.timerDone = '1';
        var wrap = document.createElement('div'); wrap.className = 'timerWithVoice';
        var slot = document.createElement('div'); slot.className = 'timerVoiceSlot';
        var spk = document.createElement('button'); spk.className = 'btn ghost timerVoiceBtn'; spk.type = 'button';
        spk.textContent = '🔊'; spk.setAttribute('aria-label', 'Read aloud');
        wrap.appendChild(slot); wrap.appendChild(spk);
        d.insertBefore(wrap, tx);
        try { if (window.OphthTimer) OphthTimer.attach(slot, t.text || '', 'lib:' + t.id); } catch (e2) {}
        spk.onclick = function (ev) {
          try { if (ev) ev.preventDefault(); } catch (e) {}
          safeVoice(function () {
            window.OphthVoice.prime();
            if (libPlayerCurrent === d && window.OphthVoice.isSpeaking()) { closeLibPlayer(); return; }
            openLibPlayer(d, t);
            if (window.OphthVoice.isSpeaking()) window.OphthVoice.stopSpeak();
            activeLibVoiceBtn = spk;
            window.OphthVoice.speakForced(libPlayerClean(t));
            if (!window.OphthVoice.isSpeaking()) activeLibVoiceBtn = null;
            libPlayerSync();
          });
        };
      });
      box.appendChild(d);
    });
  }
  function renderFigures() {
    var box = $('libFigures'); box.innerHTML = '';
    FIGURES.forEach(function (f) {
      var d = document.createElement('div'); d.className = 'photoCard';
      d.dataset.search = ((f.label || '') + ' ' + f.topic + ' ' + (f.file || '') + ' ' + OphthData.subjectName(SECTIONS, f.section)).toLowerCase();
      d.dataset.section = f.section || '';
      var im = document.createElement('img');
      im.src = OphthData.figurePath(f); im.loading = 'lazy'; im.decoding = 'async';
      im.alt = 'Figure: ' + f.topic;
      d.appendChild(im);
      var body = document.createElement('div'); body.className = 'pcBody';
      var h = document.createElement('h4'); h.textContent = f.label || f.topic || f.file;
      var cap = document.createElement('div'); cap.className = 'figCap';
      cap.textContent = OphthData.subjectName(SECTIONS, f.section) + (f.pdfPage ? ' · PDF page ' + f.pdfPage : '') + ' · ' + f.file;
      body.appendChild(h); body.appendChild(cap); d.appendChild(body);
      box.appendChild(d);
    });
  }
  function showTab(tab) {
    currentTab = tab;
    $('libTopics').style.display = tab === 'topics' ? '' : 'none';
    $('libFigures').style.display = tab === 'figures' ? '' : 'none';
    $('libTabs').querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('sel', c.dataset.tab === tab); });
    applySearch();
  }
  function applySearch() {
    var q = $('libSearch').value.toLowerCase().trim();
    var box = currentTab === 'topics' ? $('libTopics') : $('libFigures');
    var shown = 0;
    box.querySelectorAll('.noteCard,.photoCard').forEach(function (c) {
      var hitSection = currentSection === 'all' || c.dataset.section === currentSection;
      var hit = hitSection && (!q || (c.dataset.search || '').indexOf(q) >= 0);
      c.style.display = hit ? '' : 'none'; if (hit) shown++;
    });
    $('libCount').textContent = shown + ' ENTRIES SHOWN';
  }
  function openLibrary() {
    safeVoice(function () { OphthVoice.stopSpeak(); });
    try { if (window.OphthGame) OphthGame.stopGame(); } catch (e) {}
    OphthShow('libraryScreen');
    var cur = currentSubject();
    if (cur !== lastSubject) { rendered = false; sectionChipsBuilt = false; lastSubject = cur; }
    if (!rendered) {
      var loader = OphthData.loadTopicsAndSubjects || OphthData.loadTopicsAndSections;
      loader().then(function (parts) {
        SECTIONS = parts.subjects || parts.sections; TOPICS = parts.topics;
        return OphthData.loadFigures();
      }).then(function (figs) {
        FIGURES = figs;
        return OphthTables.load();
      }).then(function () {
        buildSectionChips();
        renderTopics(); renderFigures(); rendered = true;
        showTab(currentTab);
      });
    } else showTab(currentTab);
  }
  document.addEventListener('DOMContentLoaded', function () {
    $('libBtn').onclick = function () { safeAudio(function () { OphthAudio.sfx('click'); }); openLibrary(); };
    $('libBack').onclick = function () { try { closeLibPlayer(); } catch (e) {} OphthHome(); };
    $('libSearch').addEventListener('input', applySearch);
    $('libTabs').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      showTab(b.dataset.tab);
    });
    $('libSectionChips').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      $('libSectionChips').querySelectorAll('.chip').forEach(function (c) { c.classList.remove('sel'); });
      b.classList.add('sel'); currentSection = b.dataset.section; applySearch();
    });
  });
  window.OphthLibrary = { renderTopics: renderTopics, renderFigures: renderFigures };
})();
