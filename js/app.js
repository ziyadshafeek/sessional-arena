/* Screen router + Home + Settings wiring for Sessional Arena.
   No boot screen: browser voice needs no model download, so first
   paint goes straight to Home. All voice/sound controls live in
   Settings (plus one speaker toggle in-game and one in Learn).
   Voice contract (voice agent owns js/voice.js, browser speechSynthesis
   only): window.OphthSettings {mode, autoRead, rate, sounds, muted},
   window.OphthVoice {settings, saveSettings, prime, speakFullText,
   speakTexts, stopSpeak, isSpeaking, updateVoiceStatus,
   voiceStatusText, setRate}. Every call here is guarded, and setRate
   is used when present, falling back to settings.rate + saveSettings. */
(function () {
  'use strict';
  var SCREENS = ['homeScreen', 'subjectHomeScreen', 'chooserScreen', 'gameScreen', 'resultsScreen', 'learnScreen', 'libraryScreen', 'settingsScreen'];
  function $(id) { return document.getElementById(id); }
  function showScreen(id) {
    SCREENS.forEach(function (s) { var el = $(s); if (el) el.classList.toggle('on', s === id); });
    window.scrollTo(0, 0);
  }
  window.OphthShow = showScreen;
  /* ---------- Subject state ---------- */
  var currentSubject = null;
  var SUBJECTS_CACHE = [];
  var FALLBACK_SUBJECTS = [
    { id: 'surgery', name: 'Surgery' },
    { id: 'ent', name: 'ENT' },
    { id: 'medicine', name: 'Medicine' },
    { id: 'gynecology', name: 'Gynecology' },
    { id: 'ophthalmology', name: 'Ophthalmology' },
    { id: 'pediatrics', name: 'Pediatrics' }
  ];
  function getSubject() { return currentSubject; }
  function subjectNameFor(id) {
    for (var i = 0; i < SUBJECTS_CACHE.length; i++) {
      if (SUBJECTS_CACHE[i].id === id) return SUBJECTS_CACHE[i].name || id;
    }
    for (var j = 0; j < FALLBACK_SUBJECTS.length; j++) {
      if (FALLBACK_SUBJECTS[j].id === id) return FALLBACK_SUBJECTS[j].name;
    }
    return id || '';
  }
  function updateSubjectHome() {
    var t = $('subjectHomeTitle');
    if (t && currentSubject) t.textContent = subjectNameFor(currentSubject);
    var el = $('subjectExamLine');
    if (el) el.textContent = currentSubject ? subjectExamText(currentSubject) : '';
  }
  function goToSubject(id) {
    currentSubject = id;
    updateSubjectHome();
    showScreen('subjectHomeScreen');
    var best = window.OphthGame ? OphthGame.bestScore() : 0;
    var bl = $('bestLine');
    if (bl) bl.innerHTML = best ? ('BEST SCORE THIS SESSION: <strong>' + best + '</strong>') : '';
    try { if (window.OphthGame && OphthGame.refreshResume) OphthGame.refreshResume(currentSubject); } catch (e) {}
  }
  function showChooser() {
    currentSubject = null;
    showScreen('homeScreen');
    try { if (window.OphthGame && OphthGame.refreshResume) OphthGame.refreshResume(); } catch (e) {}
  }
  function goHome() {
    try { if (window.OphthVoice) OphthVoice.stopSpeak(); } catch (e) {}
    try { if (window.OphthTimer) OphthTimer.stop(); } catch (e2) {}
    try { if (window.OphthGame) OphthGame.stopGame(); } catch (e3) {}
    if (currentSubject) {
      updateSubjectHome();
      showScreen('subjectHomeScreen');
      try { if (window.OphthGame && OphthGame.refreshResume) OphthGame.refreshResume(currentSubject); } catch (e3) {}
    } else {
      showScreen('homeScreen');
      try { if (window.OphthGame && OphthGame.refreshResume) OphthGame.refreshResume(); } catch (e4) {}
    }
    var best = window.OphthGame ? OphthGame.bestScore() : 0;
    var bl = $('bestLine');
    if (bl) bl.innerHTML = best ? ('BEST SCORE THIS SESSION: <strong>' + best + '</strong>') : '';
  }
  window.OphthHome = goHome;

  /* ---------- Settings helpers ---------- */
  function getSettings() {
    if (!window.OphthSettings) window.OphthSettings = { mode: 'browser', autoRead: true, rate: 1.0, sounds: true, muted: false, fontSize: 16, theme: 'dark', fontStyle: 'default', voiceAsked: false };
    var s = window.OphthSettings;
    if (s.rate == null || isNaN(Number(s.rate))) s.rate = 1.0;
    if (s.mode == null) s.mode = 'browser';
    var fs = parseInt(s.fontSize, 10);
    s.fontSize = isNaN(fs) ? 16 : Math.max(12, Math.min(24, fs));
    if (s.theme !== 'light' && s.theme !== 'dark') s.theme = 'dark';
    if (s.fontStyle !== 'serif') s.fontStyle = 'default';
    if (typeof s.voiceAsked !== 'boolean') s.voiceAsked = false;
    return s;
  }
  function saveSettings() {
    try {
      if (window.OphthVoice && OphthVoice.saveSettings) { OphthVoice.saveSettings(); return; }
      if (window.saveOphthSettings) { window.saveOphthSettings(); return; }
      localStorage.setItem('sessional-settings', JSON.stringify(getSettings()));
    } catch (e) {}
  }
  function setRate(r) {
    r = Math.max(0.5, Math.min(2.0, Number(r) || 1.0));
    try {
      if (window.OphthVoice && OphthVoice.setRate) { OphthVoice.setRate(r); return; }
    } catch (e) {}
    getSettings().rate = r; saveSettings();
  }
  function fmtRate(r) {
    var v = Number(r).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    return v + '×';
  }
  function setFontSize(v) {
    var st = getSettings();
    var n = parseInt(v, 10);
    st.fontSize = isNaN(n) ? 16 : Math.max(12, Math.min(24, n));
    saveSettings();
    try { if (window.OphthVoice && OphthVoice.applyDisplay) OphthVoice.applyDisplay(); } catch (e) {}
    syncSettingsUI();
  }
  function setTheme(t) {
    var st = getSettings();
    st.theme = (t === 'light') ? 'light' : 'dark';
    saveSettings();
    try { if (window.OphthVoice && OphthVoice.applyDisplay) OphthVoice.applyDisplay(); } catch (e) {}
    syncSettingsUI();
  }
  function setFontStyle(t) {
    var st = getSettings();
    st.fontStyle = (t === 'serif') ? 'serif' : 'default';
    saveSettings();
    try { if (window.OphthVoice && OphthVoice.applyDisplay) OphthVoice.applyDisplay(); } catch (e) {}
    syncSettingsUI();
  }
  /* ---------- Exam timeline (Second Sessional, Nov 2026) ---------- */
  var EXAMS = [
    { id: 'surgery', code: 'SUR', name: 'SURGERY', date: new Date(2026, 10, 9) },
    { id: 'ophthalmology', code: 'OPH', name: 'OPHTHALMOLOGY', date: new Date(2026, 10, 10) },
    { id: 'gynecology', code: 'OBG', name: 'OBGYN', date: new Date(2026, 10, 12) },
    { id: 'ent', code: 'ENT', name: 'ENT', date: new Date(2026, 10, 13) },
    { id: 'medicine', code: 'MED', name: 'MEDICINE', date: new Date(2026, 10, 16) },
    { id: 'pediatrics', code: 'PED', name: 'PEDIATRICS', date: new Date(2026, 10, 17) }
  ];
  function examDaysLeft(d) {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((d - today) / 86400000);
  }
  function examDateStr(d) {
    var dd = d.getDate(); if (dd < 10) dd = '0' + dd;
    var mm = d.getMonth() + 1; if (mm < 10) mm = '0' + mm;
    return dd + '/' + mm;
  }
  function examFor(id) {
    for (var i = 0; i < EXAMS.length; i++) if (EXAMS[i].id === id) return EXAMS[i];
    return null;
  }
  function examState(ex) {
    var dl = examDaysLeft(ex.date);
    if (dl < 0) return 'done';
    for (var i = 0; i < EXAMS.length; i++) {
      if (examDaysLeft(EXAMS[i].date) >= 0) return EXAMS[i] === ex ? 'next' : 'todo';
    }
    return 'done';
  }
  function renderExamHud() {
    var bar = $('examBar'); if (!bar) return;
    var next = null, done = 0, html = '';
    EXAMS.forEach(function (ex) {
      var st = examState(ex);
      if (st === 'done') done++;
      if (st === 'next' && !next) next = ex;
      html += '<div class="examSeg ' + st + '"><b>' + ex.code + '</b>' + examDateStr(ex.date) + (st === 'done' ? ' ✓' : '') + '</div>';
    });
    bar.innerHTML = html;
    var nx = $('examNext');
    if (nx) {
      if (next) {
        var dl = examDaysLeft(next.date);
        nx.textContent = 'NEXT ▸ ' + next.name + ' · ' + (dl === 0 ? 'TODAY' : dl === 1 ? 'TOMORROW' : dl + ' DAYS LEFT');
      } else nx.textContent = 'ALL EXAMS DONE ✓';
    }
    var ft = $('examFoot');
    if (ft) ft.textContent = 'SESSIONAL 10/11 – 17/11 · ' + done + '/6 DONE';
  }
  function subjectExamText(id) {
    var ex = examFor(id); if (!ex) return '';
    var dl = examDaysLeft(ex.date);
    if (dl < 0) return '📅 EXAM ' + examDateStr(ex.date) + ' · DONE ✓';
    if (dl === 0) return '📅 ' + ex.name + ' EXAM TODAY';
    if (dl === 1) return '📅 ' + ex.name + ' EXAM TOMORROW · ' + examDateStr(ex.date);
    return '📅 ' + ex.name + ' EXAM ' + examDateStr(ex.date) + ' · ' + dl + ' DAYS LEFT';
  }
  function syncSettingsUI() {
    try {
      var st = getSettings();
      var voiceOn = $('voiceOn'); if (voiceOn) voiceOn.checked = st.mode !== 'off' && !st.muted;
      var ar = $('autoRead'); if (ar) ar.checked = !!st.autoRead;
      var sp = $('voiceSpeed'); if (sp) sp.value = st.rate;
      var sv = $('voiceSpeedVal'); if (sv) sv.textContent = fmtRate(st.rate);
      var so = $('soundsOn'); if (so) so.checked = !!st.sounds;
      var mb = $('muteBtn'); if (mb) mb.textContent = st.muted ? '🔇 VOICE: OFF' : '🎙️ VOICE: ON';
      var fz = $('fontSize'); if (fz) fz.value = st.fontSize;
      var fzv = $('fontSizeVal'); if (fzv) fzv.textContent = st.fontSize + 'px';
      var td = $('themeDark'); if (td) td.classList.toggle('active', st.theme !== 'light');
      var tl = $('themeLight'); if (tl) tl.classList.toggle('active', st.theme === 'light');
      var fd = $('fontDefault'); if (fd) fd.classList.toggle('active', st.fontStyle !== 'serif');
      var fs = $('fontSerif'); if (fs) fs.classList.toggle('active', st.fontStyle === 'serif');
      if (window.OphthVoice && OphthVoice.updateVoiceStatus) OphthVoice.updateVoiceStatus();
    } catch (e) {}
  }
  /* Fullscreen toggle, cross-browser: standard API plus webkit/moz/ms
     fallbacks. On iOS Safari there is no element fullscreen API, so the
     button there scrolls to the top; true fullscreen on iPhone comes
     from Add to Home Screen (meta tags in index.html). */
  function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || null; }
  function toggleFullscreen() {
    try {
      if (fsEl()) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
      } else {
        var el = document.documentElement;
        if (el.requestFullscreen) { var p = el.requestFullscreen(); if (p && p.catch) p.catch(function () {}); }
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
        else if (el.msRequestFullscreen) el.msRequestFullscreen();
        else window.scrollTo(0, 0);
      }
    } catch (e) {}
    syncFsButtons();
  }
  function syncFsButtons() {
    var on = !!fsEl();
    ['fsBtnHome', 'fsBtnSubject', 'fsBtnGame'].forEach(function (id) {
      var b = $(id); if (b) b.textContent = on ? '⛶ EXIT FULLSCREEN' : '⛶ FULL SCREEN';
    });
  }
  document.addEventListener('fullscreenchange', syncFsButtons);
  document.addEventListener('webkitfullscreenchange', syncFsButtons);
  document.addEventListener('mozfullscreenchange', syncFsButtons);
  document.addEventListener('MSFullscreenChange', syncFsButtons);
  function buildSubjectCards() {
    var box = $('subjectCards'); if (!box) return;
    var render = function (list) {
      SUBJECTS_CACHE = list && list.length ? list : FALLBACK_SUBJECTS;
      box.innerHTML = '';
      SUBJECTS_CACHE.forEach(function (s) {
        var b = document.createElement('button');
        b.className = 'homeBtn subjectCard'; b.textContent = s.name;
        b.onclick = function () { try { OphthAudio.sfx('click'); } catch (e) {} goToSubject(s.id); };
        box.appendChild(b);
      });
    };
    try {
      if (window.OphthData && OphthData.loadSubjects) {
        OphthData.loadSubjects().then(function (subs) { render(subs); });
      } else render(FALLBACK_SUBJECTS);
    } catch (e) { render(FALLBACK_SUBJECTS); }
  }
  document.addEventListener('DOMContentLoaded', function () {
    syncFsButtons();
    ['fsBtnHome', 'fsBtnSubject', 'fsBtnGame'].forEach(function (id) {
      var b = $(id); if (b) b.onclick = function () { try { OphthAudio.sfx('click'); } catch (e) {} toggleFullscreen(); };
    });
    syncSettingsUI();
    try { if (!('speechSynthesis' in window)) { var w = $('voiceWarn'); if (w) w.style.display = 'block'; } } catch (e) {}
    try {
      /* Android WebView (in-app browser) has no working speechSynthesis
         and stricter media-gesture rules than full Chrome. Warn plainly
         so the user does not debug voice inside the wrong container. */
      if (/;\s*wv\)/.test(navigator.userAgent || '')) {
        var wv = $('voiceWarn');
        if (wv) { wv.textContent = '⚠️ Opened inside another app\'s browser — open this link in Chrome itself for sound and voice.'; wv.style.display = 'block'; }
      }
    } catch (e) {}
    $('settingsBtn').onclick = function () { try { OphthAudio.sfx('click'); } catch (e) {} showScreen('settingsScreen'); syncSettingsUI(); };
    if ($('settingsBtnHome')) $('settingsBtnHome').onclick = function () { try { OphthAudio.sfx('click'); } catch (e) {} showScreen('settingsScreen'); syncSettingsUI(); };
    if ($('subjectsBackBtn')) $('subjectsBackBtn').onclick = function () { try { OphthAudio.sfx('click'); } catch (e) {} showChooser(); };
    buildSubjectCards();
    $('settingsBack').onclick = function () { goHome(); };
    $('voiceOn').onchange = function () {
      var st = getSettings();
      if (this.checked) { st.mode = 'browser'; st.muted = false; }
      else { st.mode = 'off'; st.muted = true; }
      saveSettings(); syncSettingsUI();
      if (st.muted) { try { OphthVoice.stopSpeak(); } catch (e) {} }
    };
    $('autoRead').onchange = function () {
      getSettings().autoRead = this.checked; saveSettings();
      if (!this.checked) { try { OphthVoice.stopSpeak(); } catch (e) {} }
    };
    $('voiceSpeed').oninput = function () {
      setRate(parseFloat(this.value));
      $('voiceSpeedVal').textContent = fmtRate(parseFloat(this.value));
    };
    if ($('fontSize')) $('fontSize').oninput = function () {
      setFontSize(parseInt(this.value, 10));
    };
    if ($('fontDown')) $('fontDown').onclick = function () {
      setFontSize(getSettings().fontSize - 1);
    };
    if ($('fontUp')) $('fontUp').onclick = function () {
      setFontSize(getSettings().fontSize + 1);
    };
    if ($('themeDark')) $('themeDark').onclick = function () { setTheme('dark'); };
    if ($('themeLight')) $('themeLight').onclick = function () { setTheme('light'); };
    document.querySelectorAll('.presetBtn').forEach(function (b) {
      b.onclick = function () {
        var r = parseFloat(b.dataset.rate);
        setRate(r);
        var sp = $('voiceSpeed'); if (sp) sp.value = r;
        $('voiceSpeedVal').textContent = fmtRate(r);
      };
    });
    $('soundsOn').onchange = function () {
      getSettings().sounds = this.checked; saveSettings();
      if (this.checked) { try { OphthAudio.sfx('click'); } catch (e) {} }
    };
    $('muteBtn').onclick = function () {
      var st = getSettings();
      st.muted = !st.muted;
      if (!st.muted && st.mode === 'off') st.mode = 'browser';
      saveSettings();
      if (st.muted) { try { OphthVoice.stopSpeak(); } catch (e) {} }
      syncSettingsUI();
    };
    $('soundTestBtn').onclick = function () {
      /* Tap-synchronous beep scale via OphthAudio, IGNORING the Sounds
         setting: a test that respects the setting it tests would be
         silent exactly when the setting is off. */
      try { if (OphthAudio.testSound) OphthAudio.testSound(); else { OphthAudio.ac(); OphthAudio.sfx('win'); } } catch (e) {}
    };
    $('resetSoundBtn').onclick = function () {
      var st = getSettings();
      st.sounds = true; st.muted = false; st.mode = 'browser'; st.autoRead = true;
      setRate(1.0);
      saveSettings(); syncSettingsUI();
    };
    $('testVoiceBtn').onclick = function () {
      /* Prime synchronously inside this tap handler first, then unmute
         so the test always makes a sound when the engine works. */
      try { if (window.OphthVoice) OphthVoice.prime(); } catch (e) {}
      var st = getSettings();
      st.muted = false; if (st.mode === 'off') st.mode = 'browser';
      saveSettings(); syncSettingsUI();
      try { OphthVoice.speakFullText('Voice test. This is the Sessional Arena voice. If you can hear this, voice is working.'); } catch (e2) {}
    };
  });
  /* Exam timeline + first-run voice popup + font-style buttons. */
  document.addEventListener('DOMContentLoaded', function () {
    renderExamHud();
    if ($('fontDefault')) $('fontDefault').onclick = function () { setFontStyle('default'); };
    if ($('fontSerif')) $('fontSerif').onclick = function () { setFontStyle('serif'); };
    var pop = $('voicePopup');
    if (!pop) return;
    var st = getSettings();
    if (st.voiceAsked) return;
    pop.classList.add('on');
    var choose = function (on) {
      var s = getSettings();
      if (on) { s.mode = 'browser'; s.muted = false; try { if (window.OphthVoice) OphthVoice.prime(); } catch (e) {} }
      else { s.mode = 'off'; s.muted = true; try { if (window.OphthVoice) OphthVoice.stopSpeak(); } catch (e2) {} }
      s.voiceAsked = true;
      saveSettings(); syncSettingsUI();
      pop.classList.remove('on');
    };
    if ($('voiceYes')) $('voiceYes').onclick = function () { choose(true); };
    if ($('voiceNo')) $('voiceNo').onclick = function () { choose(false); };
  });
  window.OphthApp = { syncSettingsUI: syncSettingsUI, toggleFullscreen: toggleFullscreen, setRate: setRate, setFontSize: setFontSize, setTheme: setTheme, setFontStyle: setFontStyle, renderExamHud: renderExamHud, getSettings: getSettings, getSubject: getSubject, goToSubject: goToSubject, showChooser: showChooser, subjectNameFor: subjectNameFor };
})();
