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
    try { if (window.OphthGame) OphthGame.stopGame(); } catch (e2) {}
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
    if (!window.OphthSettings) window.OphthSettings = { mode: 'browser', autoRead: true, rate: 1.0, sounds: true, muted: false };
    var s = window.OphthSettings;
    if (s.rate == null || isNaN(Number(s.rate))) s.rate = 1.0;
    if (s.mode == null) s.mode = 'browser';
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
  function syncSettingsUI() {
    try {
      var st = getSettings();
      var voiceOn = $('voiceOn'); if (voiceOn) voiceOn.checked = st.mode !== 'off' && !st.muted;
      var ar = $('autoRead'); if (ar) ar.checked = !!st.autoRead;
      var sp = $('voiceSpeed'); if (sp) sp.value = st.rate;
      var sv = $('voiceSpeedVal'); if (sv) sv.textContent = fmtRate(st.rate);
      var so = $('soundsOn'); if (so) so.checked = !!st.sounds;
      var mb = $('muteBtn'); if (mb) mb.textContent = st.muted ? '🔇 VOICE: OFF' : '🎙️ VOICE: ON';
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
  window.OphthApp = { syncSettingsUI: syncSettingsUI, toggleFullscreen: toggleFullscreen, setRate: setRate, getSettings: getSettings, getSubject: getSubject, goToSubject: goToSubject, showChooser: showChooser, subjectNameFor: subjectNameFor };
})();
