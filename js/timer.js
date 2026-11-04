/* Read-time tracker: estimated read time at 18 words per minute plus a
   stopwatch per topic. One stopwatch runs at a time; elapsed time is
   kept per topic for the session, so leaving and coming back resumes
   that topic's count. Gamified: the bar fills toward the estimate and
   flips to TARGET HIT when the estimate is reached. */
(function () {
  'use strict';
  var WPM = 18;
  var elapsedByKey = {};
  var activeKey = null;
  var timerId = null;

  function words(text) {
    var t = String(text == null ? '' : text).replace(/\[\[TABLE:[^\]]+\]\]/g, ' ').trim();
    if (!t) return 0;
    return t.split(/\s+/).length;
  }
  function estimateMinutes(text) {
    return Math.max(1, Math.ceil(words(text) / WPM));
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h ? pad(h) + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
  }
  function stop() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }
  function render(row) {
    if (!row) return;
    var key = row.getAttribute('data-timer-key');
    var est = parseInt(row.getAttribute('data-est-min'), 10) || 1;
    var el = elapsedByKey[key] || 0;
    var clock = row.querySelector('.timerClock');
    if (clock) clock.textContent = fmt(el);
    var pct = Math.min(100, Math.floor(100 * el / (est * 60)));
    var fill = row.querySelector('.timerBarFill');
    if (fill) { fill.style.width = pct + '%'; fill.classList.toggle('hit', pct >= 100); }
    var hit = row.querySelector('.timerHit');
    if (hit) hit.style.display = pct >= 100 ? '' : 'none';
    var btn = row.querySelector('.timerStart');
    if (btn) btn.textContent = (activeKey === key && timerId) ? '⏸ PAUSE' : '▶ START';
  }
  function attach(container, text, key) {
    if (!container || !key) return null;
    stop();
    var est = estimateMinutes(text);
    if (!elapsedByKey[key]) elapsedByKey[key] = 0;
    container.innerHTML = '';
    var row = document.createElement('div');
    row.className = 'timerRow';
    row.setAttribute('data-timer-key', key);
    row.setAttribute('data-est-min', String(est));
    var top = document.createElement('div');
    top.className = 'timerTop';
    var estEl = document.createElement('span');
    estEl.className = 'timerEst';
    estEl.textContent = '⏱ READ ≈ ' + est + ' MIN @ ' + WPM + ' WPM';
    var clock = document.createElement('span');
    clock.className = 'timerClock';
    clock.textContent = '00:00';
    var hit = document.createElement('span');
    hit.className = 'timerHit';
    hit.textContent = '✓ TARGET HIT';
    hit.style.display = 'none';
    top.appendChild(estEl); top.appendChild(clock); top.appendChild(hit);
    var barWrap = document.createElement('div');
    barWrap.className = 'timerBarWrap';
    var fill = document.createElement('div');
    fill.className = 'timerBarFill';
    barWrap.appendChild(fill);
    var btns = document.createElement('div');
    btns.className = 'timerBtns';
    var start = document.createElement('button');
    start.className = 'btn ghost timerStart';
    start.textContent = '▶ START';
    var reset = document.createElement('button');
    reset.className = 'btn ghost timerReset';
    reset.textContent = '↻ RESET';
    btns.appendChild(start); btns.appendChild(reset);
    row.appendChild(top); row.appendChild(barWrap); row.appendChild(btns);
    container.appendChild(row);
    start.onclick = function () {
      if (activeKey === key && timerId) {
        stop(); activeKey = null; render(row); return;
      }
      stop();
      activeKey = key;
      timerId = setInterval(function () {
        elapsedByKey[key] = (elapsedByKey[key] || 0) + 1;
        render(row);
      }, 1000);
      render(row);
    };
    reset.onclick = function () {
      if (activeKey === key) { stop(); activeKey = null; }
      elapsedByKey[key] = 0;
      render(row);
    };
    render(row);
    return row;
  }
  window.OphthTimer = {
    wpm: WPM, words: words, estimateMinutes: estimateMinutes,
    fmt: fmt, attach: attach, stop: stop
  };
})();
