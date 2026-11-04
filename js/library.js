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
    var box = $('libTopics'); box.innerHTML = '';
    TOPICS.forEach(function (t) {
      var d = document.createElement('details'); d.className = 'noteCard';
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
      var tx = document.createElement('div'); tx.className = 'libText'; tx.textContent = t.text || '';
      try { OphthTables.applyTo(t.id, tx); } catch (e) {}
      d.appendChild(tx);
      d.addEventListener('toggle', function () {
        if (!d.open || d.dataset.timerDone) return;
        d.dataset.timerDone = '1';
        var slot = document.createElement('div');
        d.insertBefore(slot, tx);
        try { if (window.OphthTimer) OphthTimer.attach(slot, t.text || '', 'lib:' + t.id); } catch (e2) {}
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
    $('libBack').onclick = function () { OphthHome(); };
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
