/* Sessional Arena — voice module.
   Browser natural voice only, using window.speechSynthesis.
   No local model, no background voice thread, no external voice library.
   Spoken text is expanded (abbreviations, units) for speech only;
   displayed text is never changed by this file. */
(function () {
  'use strict';

  var SETTINGS_KEY = 'sessional-arena-settings';

  var DEFAULTS = {
    mode: 'browser',
    autoRead: true,
    rate: 1.0,
    sounds: true,
    muted: false,
    fontSize: 16,
    theme: 'dark',
    fontStyle: 'default',
    voiceAsked: false
  };

  function isObject(value) {
    return value !== null && typeof value === 'object';
  }

  function clampRate(value) {
    var r = parseFloat(value);
    if (isNaN(r)) {
      return 1.0;
    }
    if (r < 0.5) {
      return 0.5;
    }
    if (r > 2.0) {
      return 2.0;
    }
    return r;
  }

  function clampFontSize(value) {
    var n = parseInt(value, 10);
    if (isNaN(n)) {
      return 16;
    }
    if (n < 12) {
      return 12;
    }
    if (n > 24) {
      return 24;
    }
    return n;
  }

  function clampTheme(value) {
    return value === 'light' ? 'light' : 'dark';
  }

  function loadSettings() {
    var settings = {};
    var key;
    for (key in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
        settings[key] = DEFAULTS[key];
      }
    }
    try {
      var raw = window.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (isObject(parsed)) {
          if (parsed.mode === 'browser' || parsed.mode === 'off') {
            settings.mode = parsed.mode;
          }
          if (typeof parsed.autoRead === 'boolean') {
            settings.autoRead = parsed.autoRead;
          }
          if (typeof parsed.sounds === 'boolean') {
            settings.sounds = parsed.sounds;
          }
          if (typeof parsed.muted === 'boolean') {
            settings.muted = parsed.muted;
          }
          if (parsed.rate !== undefined && parsed.rate !== null) {
            settings.rate = clampRate(parsed.rate);
          }
          if (parsed.fontSize !== undefined && parsed.fontSize !== null) {
            settings.fontSize = clampFontSize(parsed.fontSize);
          }
          if (typeof parsed.theme === 'string') {
            settings.theme = clampTheme(parsed.theme);
          }
          if (typeof parsed.fontStyle === 'string') {
            settings.fontStyle = parsed.fontStyle === 'serif' ? 'serif' : 'default';
          }
          if (typeof parsed.voiceAsked === 'boolean') {
            settings.voiceAsked = parsed.voiceAsked;
          }
        }
      }
    } catch (e) {
      /* Keep defaults if storage or parsing fails. */
    }
    return settings;
  }

  var settings = loadSettings();

  function readSettings() {
    try {
      if (isObject(window.OphthSettings)) {
        return window.OphthSettings;
      }
    } catch (e) {
      /* Fall through to the local copy. */
    }
    return settings;
  }

  /* Display settings (font size + theme) live in the same settings
     object so one save covers voice and display. Applied here and
     from the head inline script (no-flash) using the same key. */
  function applyDisplay() {
    var current = readSettings();
    try {
      var fs = clampFontSize(current.fontSize);
      current.fontSize = fs;
      var th = clampTheme(current.theme);
      current.theme = th;
      document.documentElement.setAttribute('data-theme', th);
      document.documentElement.setAttribute('data-font', current.fontStyle === 'serif' ? 'serif' : 'default');
      document.documentElement.style.setProperty('--fscale', (fs / 16).toFixed(3));
      var tc = document.querySelector('meta[name="theme-color"]');
      if (tc) {
        tc.setAttribute('content', th === 'light' ? '#f2f6fb' : '#020610');
      }
      var cs = document.querySelector('meta[name="color-scheme"]');
      if (cs) {
        cs.setAttribute('content', th);
      }
    } catch (e) {
      /* Display keeps defaults if the DOM is not ready. */
    }
  }

  function saveSettings() {
    var current = readSettings();
    try {
      window.OphthSettings = current;
    } catch (e) {
      /* Ignore. */
    }
    try {
      if (window.OphthVoice && isObject(window.OphthVoice)) {
        window.OphthVoice.settings = current;
      }
    } catch (e) {
      /* Ignore. */
    }
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
    } catch (e) {
      /* Storage may be unavailable; settings still apply in memory. */
    }
    try {
      applyDisplay();
    } catch (e) {
      /* Ignore. */
    }
  }

  window.OphthSettings = settings;
  window.saveOphthSettings = saveSettings;
  applyDisplay();

  function hasSpeech() {
    try {
      return typeof window.speechSynthesis !== 'undefined' &&
        window.speechSynthesis !== null;
    } catch (e) {
      return false;
    }
  }

  function isPhone() {
    try {
      var ua = window.navigator ? window.navigator.userAgent || '' : '';
      return /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    } catch (e) {
      return false;
    }
  }

  function formatRate(rate) {
    var rounded = Math.round(rate * 100) / 100;
    return rounded.toString();
  }

  function getRate() {
    var current = readSettings();
    return clampRate(current.rate);
  }

  function isMutedOrOff() {
    var current = readSettings();
    return current.muted === true || current.mode === 'off';
  }

  function voiceStatusText() {
    if (!hasSpeech()) {
      return 'This browser has no text-to-speech';
    }
    return 'Browser natural voice \u00B7 System default voice on phones \u00B7 Speed ' +
      formatRate(getRate()) + '\u00D7';
  }

  function updateVoiceStatus() {
    try {
      var el = document.getElementById('voiceStatus');
      if (el) {
        el.textContent = voiceStatusText();
      }
    } catch (e) {
      /* Never throw from a status update. */
    }
  }

  function setRate(r) {
    try {
      var current = readSettings();
      current.rate = clampRate(r);
      window.OphthSettings = current;
      saveSettings();
      updateVoiceStatus();
      return current.rate;
    } catch (e) {
      return getRate();
    }
  }

  /* ---------- Spoken-text expansion (speech only) ---------- */
  /* Subject-neutral units only. The old single-subject engine's
     ophthalmology abbreviation list was removed with the
     single-subject content; it expands nothing subject-specific. */

  function expandAbbreviations(text) {
    var out = text;
    var pairs = [
      [/\bmmHg\b/g, 'millimetres of mercury'],
      [/\bcm\b/g, 'centimetres'],
      [/\bmm\b/g, 'millimetres']
    ];
    var i;
    for (i = 0; i < pairs.length; i++) {
      out = out.replace(pairs[i][0], pairs[i][1]);
    }
    out = out.replace(/\u00B0/g, ' degrees ');
    return out;
  }

  /* ---------- Sentence splitting (never splits a word or decimal) ---------- */

  function isDigit(ch) {
    return ch >= '0' && ch <= '9';
  }

  function splitIntoChunks(text) {
    var expanded = expandAbbreviations(text);
    var normalised = expanded.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    if (!normalised) {
      return [];
    }

    var sentences = [];
    var start = 0;
    var i;
    var len = normalised.length;
    for (i = 0; i < len; i++) {
      var ch = normalised.charAt(i);
      if (ch !== '.' && ch !== '!' && ch !== '?') {
        continue;
      }
      /* Decimal point: a digit on both sides, e.g. 2.8 — not a boundary. */
      if (ch === '.' && i > 0 && i + 1 < len &&
          isDigit(normalised.charAt(i - 1)) &&
          isDigit(normalised.charAt(i + 1))) {
        continue;
      }
      /* Ellipsis: only the last dot is a boundary. */
      if (ch === '.' && i + 1 < len && normalised.charAt(i + 1) === '.') {
        continue;
      }
      /* Titles such as Dr. / Mr. / Mrs. / Ms. / St. are not boundaries. */
      if (ch === '.') {
        var wordStart = i - 1;
        while (wordStart >= 0 && normalised.charAt(wordStart) !== ' ') {
          wordStart--;
        }
        var word = normalised.substring(wordStart + 1, i);
        if (word === 'Dr' || word === 'Mr' || word === 'Mrs' ||
            word === 'Ms' || word === 'St') {
          continue;
        }
      }
      var next = (i + 1 < len) ? normalised.charAt(i + 1) : '';
      if (next === '' || next === ' ' || next === '"' || next === "'" ||
          next === ')' || next === ']') {
        var sentence = normalised.substring(start, i + 1)
          .replace(/^\s+|\s+$/g, '');
        if (sentence) {
          sentences.push(sentence);
        }
        start = i + 1;
      }
    }
    if (start < len) {
      var tail = normalised.substring(start).replace(/^\s+|\s+$/g, '');
      if (tail) {
        sentences.push(tail);
      }
    }

    var chunks = [];
    var s;
    for (s = 0; s < sentences.length; s++) {
      var sentenceText = sentences[s];
      if (sentenceText.length <= 200) {
        chunks.push(sentenceText);
        continue;
      }
      var words = sentenceText.split(' ');
      var current = '';
      var w;
      for (w = 0; w < words.length; w++) {
        var word = words[w];
        if (!word) {
          continue;
        }
        if (current === '') {
          current = word;
        } else if (current.length + 1 + word.length <= 200) {
          current += ' ' + word;
        } else {
          chunks.push(current);
          current = word;
        }
      }
      if (current !== '') {
        chunks.push(current);
      }
    }
    return chunks;
  }

  /* ---------- Chain state ---------- */

  var state = {
    queue: [],
    speaking: false,
    token: 0,
    chunkId: 0,
    watchdog: null,
    keepAlive: null,
    force: false,
    index: 0,
    total: 0,
    items: null
  };

  function dispatchVoiceEvent(name) {
    try {
      var ev = null;
      if (typeof window.CustomEvent === 'function') {
        try {
          ev = new window.CustomEvent(name);
        } catch (e2) {
          ev = null;
        }
      }
      if (!ev && document.createEvent) {
        ev = document.createEvent('CustomEvent');
        ev.initCustomEvent(name, false, false, null);
      }
      if (ev) {
        document.dispatchEvent(ev);
      }
    } catch (e) {
      /* Events must never break speech. */
    }
  }

  function setSpeaking(flag) {
    state.speaking = !!flag;
    dispatchVoiceEvent(flag ? 'ophth-voice-start' : 'ophth-voice-end');
  }

  function clearWatchdog() {
    try {
      if (state.watchdog !== null) {
        window.clearTimeout(state.watchdog);
        state.watchdog = null;
      }
    } catch (e) {
      state.watchdog = null;
    }
  }

  function clearKeepAlive() {
    try {
      if (state.keepAlive !== null) {
        window.clearInterval(state.keepAlive);
        state.keepAlive = null;
      }
    } catch (e) {
      state.keepAlive = null;
    }
  }

  function startKeepAlive() {
    clearKeepAlive();
    try {
      state.keepAlive = window.setInterval(function () {
        try {
          if (state.speaking && window.speechSynthesis &&
              window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        } catch (e) {
          /* Ignore browser quirks. */
        }
      }, 500);
    } catch (e) {
      state.keepAlive = null;
    }
  }

  function finishChain(token) {
    if (token !== state.token) {
      return;
    }
    clearWatchdog();
    clearKeepAlive();
    state.queue = [];
    state.index = state.total;
    dispatchVoiceEvent('ophth-voice-progress');
    setSpeaking(false);
  }

  function pickVoice() {
    /* Phones: always the system default voice. Never pick a voice object. */
    if (isPhone()) {
      return null;
    }
    try {
      if (!window.speechSynthesis ||
          typeof window.speechSynthesis.getVoices !== 'function') {
        return null;
      }
      var voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) {
        return null;
      }
      var best = null;
      var bestScore = 0;
      var i;
      for (i = 0; i < voices.length; i++) {
        var voice = voices[i];
        if (!voice || !voice.lang) {
          continue;
        }
        var lang = voice.lang.toLowerCase();
        if (lang !== 'en' && lang !== 'en-us' && lang !== 'en-gb' &&
            lang !== 'en-au' && lang !== 'en-ca') {
          continue;
        }
        var name = (voice.name || '').toLowerCase();
        var score = 0;
        if (name.indexOf('natural') !== -1 || name.indexOf('neural') !== -1) {
          score = 3;
        } else if (name.indexOf('premium') !== -1 ||
                   name.indexOf('google us english') !== -1) {
          score = 2;
        } else if (name.indexOf('samantha') !== -1 ||
                   name.indexOf('daniel') !== -1) {
          score = 1;
        }
        if (score > bestScore) {
          bestScore = score;
          best = voice;
        }
      }
      return best;
    } catch (e) {
      return null;
    }
  }

  /* Wrapper: nothing in the async TTS chain may ever surface as an
     uncaught exception — on any failure, end the chain cleanly so the
     game always advances. */
  function speakChunk(token, index, forceDefaultVoice) {
    try {
      speakChunkInner(token, index, forceDefaultVoice);
    } catch (e) {
      try { finishChain(token); } catch (e2) { /* Ignore. */ }
    }
  }

  function speakChunkInner(token, index, forceDefaultVoice) {
    if (token !== state.token) {
      return;
    }
    if (index >= state.queue.length) {
      finishChain(token);
      return;
    }
    /* Forced playback (Library mini player) keeps going even when the
       voice setting is off — the tap already chose to listen. */
    if (!state.force && isMutedOrOff()) {
      clearWatchdog();
      clearKeepAlive();
      state.queue = [];
      setSpeaking(false);
      return;
    }
    if (!hasSpeech()) {
      finishChain(token);
      return;
    }

    /* Progress for seekers (e.g. the Library mini player slider). Browser
       voices cannot report time or seek inside one spoken chunk, so
       progress moves chunk by chunk and seeks jump between chunks. */
    state.index = index;
    dispatchVoiceEvent('ophth-voice-progress');

    var chunkId = ++state.chunkId;
    var chunk = state.queue[index];
    var rate = getRate();
    var voice = forceDefaultVoice ? null : pickVoice();

    var utterance;
    try {
      utterance = new window.SpeechSynthesisUtterance(chunk);
    } catch (e) {
      speakChunk(token, index + 1, false);
      return;
    }
    utterance.volume = 1;
    utterance.pitch = 1;
    utterance.rate = rate;
    utterance.lang = 'en';
    if (voice) {
      try {
        utterance.voice = voice;
      } catch (e) {
        utterance.voice = null;
      }
    } else {
      utterance.voice = null;
    }

    utterance.onend = function () {
      if (token !== state.token || chunkId !== state.chunkId) {
        return;
      }
      clearWatchdog();
      speakChunk(token, index + 1, false);
    };

    utterance.onerror = function (event) {
      if (token !== state.token || chunkId !== state.chunkId) {
        return;
      }
      clearWatchdog();
      var err = '';
      try {
        err = event && event.error ? event.error : '';
      } catch (e) {
        err = '';
      }
      /* Fall back once to the default voice with lang 'en'. */
      if (!forceDefaultVoice && voice !== null &&
          (err === 'voice-unavailable' || err === 'language-unavailable')) {
        speakChunk(token, index, true);
        return;
      }
      speakChunk(token, index + 1, false);
    };

    /* Watchdog: at least 25s, scaled by chunk length and inverse rate. */
    var budget = Math.ceil(chunk.length * 150 / rate);
    if (budget < 25000) {
      budget = 25000;
    }
    clearWatchdog();
    try {
      state.watchdog = window.setTimeout(function () {
        if (token !== state.token || chunkId !== state.chunkId) {
          return;
        }
        try {
          window.speechSynthesis.cancel();
        } catch (e) {
          /* Ignore. */
        }
        /* If cancel already advanced the chain (onend fired), do not skip. */
        if (chunkId !== state.chunkId) {
          return;
        }
        speakChunk(token, index + 1, false);
      }, budget);
    } catch (e) {
      state.watchdog = null;
    }

    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      clearWatchdog();
      speakChunk(token, index + 1, false);
    }
  }

  function speakTexts(texts, force, startRatio) {
    try {
      if (!force && isMutedOrOff()) {
        return;
      }
      if (!hasSpeech()) {
        return;
      }
      var items = texts;
      if (typeof items === 'string') {
        items = [items];
      }
      if (!items || typeof items.length !== 'number') {
        return;
      }
      var queue = [];
      var i;
      for (i = 0; i < items.length; i++) {
        var item = items[i];
        if (typeof item !== 'string') {
          continue;
        }
        var parts = splitIntoChunks(item);
        var j;
        for (j = 0; j < parts.length; j++) {
          queue.push(parts[j]);
        }
      }
      if (queue.length === 0) {
        return;
      }
      if (state.speaking) {
        stopSpeak();
      }
      var token = ++state.token;
      state.queue = queue;
      state.force = !!force;
      state.items = items;
      state.total = queue.length;
      var startIndex = 0;
      if (startRatio && startRatio > 0) {
        startIndex = startRatio >= 1 ? queue.length - 1 : Math.floor(startRatio * queue.length);
        if (startIndex < 0) startIndex = 0;
        if (startIndex >= queue.length) startIndex = queue.length - 1;
      }
      state.index = startIndex;
      setSpeaking(true);
      startKeepAlive();
      speakChunk(token, startIndex, false);
    } catch (e) {
      /* Never throw out of a public function. */
      try {
        clearWatchdog();
        clearKeepAlive();
        state.queue = [];
        state.speaking = false;
      } catch (e2) {
        /* Ignore. */
      }
    }
  }

  function speakFullText(text, force) {
    try {
      if (typeof text !== 'string') {
        return;
      }
      speakTexts([text], force);
    } catch (e) {
      /* Never throw out of a public function. */
    }
  }

  /* Forced playback: used by the Library mini player. An explicit tap on
     a speaker icon starts reading even when the voice setting is off —
     the player is the student's explicit choice, not auto-read. */
  function speakForced(text) {
    try {
      if (typeof text !== 'string') {
        return;
      }
      speakTexts([text], true);
    } catch (e) {
      /* Never throw out of a public function. */
    }
  }

  /* Forced playback starting part-way through (mini player resume). */
  function speakForcedAt(text, ratio) {
    try {
      if (typeof text !== 'string') {
        return;
      }
      speakTexts([text], true, ratio);
    } catch (e) {
      /* Never throw out of a public function. */
    }
  }

  /* Seek inside the current chain (mini player slider). Restarts the
     chain at the chunk nearest the requested position. */
  function seekTo(ratio) {
    try {
      if (!state.items || !state.items.length || !state.total) {
        return false;
      }
      speakTexts(state.items, state.force, ratio);
      return true;
    } catch (e) {
      return false;
    }
  }

  function getProgress() {
    try {
      return { index: state.index, total: state.total, speaking: !!state.speaking };
    } catch (e) {
      return { index: 0, total: 0, speaking: false };
    }
  }

  function stopSpeak() {
    try {
      state.token++;
      clearWatchdog();
      clearKeepAlive();
      state.queue = [];
      /* cancel() ONLY. Never call pause after cancel: it wedges
         Chrome's Android TTS engine. */
      if (hasSpeech()) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {
          /* Ignore. */
        }
      }
      setSpeaking(false);
    } catch (e) {
      try {
        state.speaking = false;
      } catch (e2) {
        /* Ignore. */
      }
    }
  }

  function isSpeaking() {
    try {
      return !!state.speaking;
    } catch (e) {
      return false;
    }
  }

  function resumeOphthAudio() {
    try {
      var audio = window.OphthAudio;
      if (!audio) {
        return;
      }
      var result = null;
      if (typeof audio.resume === 'function') {
        result = audio.resume();
      } else if (audio.context && typeof audio.context.resume === 'function') {
        result = audio.context.resume();
      } else if (audio.audioContext &&
                 typeof audio.audioContext.resume === 'function') {
        result = audio.audioContext.resume();
      }
      if (result && typeof result.catch === 'function') {
        result.catch(function () {});
      }
    } catch (e) {
      /* Ignore. */
    }
  }

  function prime() {
    try {
      resumeOphthAudio();
      if (!hasSpeech()) {
        return;
      }
      /* Silent blank utterance, spoken synchronously inside the tap
         handler to unlock speech on Android. Volume 0: no audible noise. */
      var utterance = new window.SpeechSynthesisUtterance(' ');
      utterance.volume = 0;
      utterance.pitch = 1;
      utterance.rate = 1;
      utterance.lang = 'en';
      utterance.voice = null;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      /* Priming must never throw or make noise. */
    }
  }

  window.OphthVoice = {
    settings: settings,
    saveSettings: saveSettings,
    prime: prime,
    speakFullText: speakFullText,
    speakForced: speakForced,
    speakForcedAt: speakForcedAt,
    seekTo: seekTo,
    getProgress: getProgress,
    speakTexts: speakTexts,
    stopSpeak: stopSpeak,
    isSpeaking: isSpeaking,
    updateVoiceStatus: updateVoiceStatus,
    voiceStatusText: voiceStatusText,
    setRate: setRate,
    applyDisplay: applyDisplay,
    setSpeaking: setSpeaking
  };

  try {
    updateVoiceStatus();
  } catch (e) {
    /* Ignore: the game calls updateVoiceStatus() when its UI is ready. */
  }
})();
