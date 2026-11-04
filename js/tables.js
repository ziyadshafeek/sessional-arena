/* Tables: proper grids for the notes' comparison/grade tables, built from
   data/tables.json (every cell is a verbatim slice of its topic's text;
   the builder skips any table that fails that check, so a missing table
   here simply falls back to the original flowing text). applyTo()
   builds the table BEFORE touching the element, so a failure leaves
   the text untouched.
   MARKER MODEL (primary for Sessional Arena): a topic's text may carry
   [[TABLE:<tableId>]] on its own line. renderInto()/applyTo() then
   render text segments (pre-wrap divs) and real <table> grids in
   document order, instead of a single table for the whole topic.
   Multiple tables per topic are supported (one marker each).
   LEGACY PATH (kept): a table entry with non-empty before/after text
   renders exactly as in v1.1 (before + grid + after, replacing the
   element). A legacy entry with neither before/after nor markers gets
   its grid APPENDED after the existing text (v1.1 replaced the text
   with the grid alone, which would discard notes text). */
(function () {
  'use strict';
  var cache = null, inflight = null;
  var MARKER_RE = /\[\[TABLE:([^\]]+)\]\]/g;
  function load() {
    if (cache) return Promise.resolve(cache);
    if (inflight) return inflight;
    inflight = OphthData.fetchJSON('data/tables.json').then(function (j) {
      cache = { byTopic: {}, byId: {} };
      (j || []).forEach(function (t) {
        if (!t) return;
        if (t.id) cache.byId[t.id] = t;
        if (t.topicId) {
          if (!cache.byTopic[t.topicId]) cache.byTopic[t.topicId] = [];
          cache.byTopic[t.topicId].push(t);
        }
      });
      return cache;
    });
    return inflight;
  }
  function get(id) {
    if (!cache) return null;
    if (cache.byId[id]) return cache.byId[id];
    var list = cache.byTopic[id];
    return list && list.length ? list[0] : null;
  }
  function getById(id) { return cache ? (cache.byId[id] || null) : null; }
  function getAllForTopic(topicId) {
    return cache && cache.byTopic[topicId] ? cache.byTopic[topicId].slice() : [];
  }
  function stripMarkers(text) {
    return String(text == null ? '' : text).replace(MARKER_RE, '');
  }
  function buildTable(tab) {
    var wrap = document.createElement('div'); wrap.className = 'tblWrap';
    var cap = document.createElement('div'); cap.className = 'tblCap';
    cap.textContent = tab.caption || 'Table'; wrap.appendChild(cap);
    var table = document.createElement('table'); table.className = 'tbl';
    var thead = document.createElement('thead'); var hr = document.createElement('tr');
    (tab.columns || []).forEach(function (c) {
      var th = document.createElement('th'); th.textContent = c; hr.appendChild(th);
    });
    thead.appendChild(hr); table.appendChild(thead);
    var tb = document.createElement('tbody');
    (tab.rows || []).forEach(function (r) {
      var tr = document.createElement('tr');
      r.forEach(function (cell, ci) {
        var el = document.createElement(ci === 0 ? 'th' : 'td');
        if (ci === 0) el.scope = 'row';
        el.textContent = cell; tr.appendChild(el);
      });
      tb.appendChild(tr);
    });
    table.appendChild(tb); wrap.appendChild(table);
    if (tab.note) {
      var n = document.createElement('div'); n.className = 'tblNote';
      n.textContent = tab.note; wrap.appendChild(n);
    }
    return wrap;
  }
  /* Render `text` (which contains >= 1 marker) into `el` as alternating
     text segments and grids, in document order. An unknown table id is
     skipped silently: a raw [[TABLE:...]] marker must never reach the
     UI as visible text. Returns true when a marker was rendered. */
  function renderTextWithTables(el, text) {
    var frag = document.createDocumentFragment();
    var last = 0, m, found = false;
    MARKER_RE.lastIndex = 0;
    while ((m = MARKER_RE.exec(text)) !== null) {
      found = true;
      var seg = text.slice(last, m.index);
      if (seg && !/^\s*$/.test(seg)) {
        var d = document.createElement('div'); d.className = 'tblText';
        d.textContent = seg; frag.appendChild(d);
      }
      var tab = getById(m[1]) || get(m[1]);
      if (tab) frag.appendChild(buildTable(tab));
      last = MARKER_RE.lastIndex;
    }
    var tail = text.slice(last);
    if (tail && !/^\s*$/.test(tail)) {
      var td = document.createElement('div'); td.className = 'tblText';
      td.textContent = tail; frag.appendChild(td);
    }
    if (!found) return false;
    el.textContent = '';
    el.appendChild(frag);
    return true;
  }
  function renderInto(el, text) {
    if (!el || text == null) return false;
    MARKER_RE.lastIndex = 0;
    if (!MARKER_RE.test(String(text))) return false;
    return renderTextWithTables(el, String(text));
  }
  function applyTo(topicId, el) {
    try {
      if (!el) return false;
      /* Primary: the element already holds the topic text; if it
         carries markers, render segments + grids in order. */
      var current = el.textContent || '';
      if (renderInto(el, current)) return true;
      var tab = get(topicId);
      if (!tab) return false;
      if (tab.before || tab.after) {
        /* Legacy before/after path, exactly as in v1.1. */
        var frag = document.createDocumentFragment();
        if (tab.before) {
          var before = document.createElement('div'); before.className = 'tblBefore';
          before.textContent = tab.before; frag.appendChild(before);
        }
        frag.appendChild(buildTable(tab));
        if (tab.after) {
          var after = document.createElement('div'); after.className = 'tblBefore';
          after.textContent = tab.after; frag.appendChild(after);
        }
        el.textContent = '';
        el.appendChild(frag);
        return true;
      }
      /* Legacy entry, no markers, no before/after: append the grid
         after the existing text instead of discarding the text. */
      el.appendChild(buildTable(tab));
      return true;
    } catch (e) { return false; }
  }
  window.OphthTables = {
    load: load, get: get, getById: getById,
    getAllForTopic: getAllForTopic, applyTo: applyTo,
    buildTable: buildTable, stripMarkers: stripMarkers,
    renderTextWithTables: renderTextWithTables, renderInto: renderInto
  };
})();
