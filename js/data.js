/* Lazy data loading for Sessional Arena: nothing except this loader is
   fetched on first paint. Subjects load on first Home/subject use,
   topics on first Learn/Library use, questions on first Play, figures
   on first Library/quiz use, tables alongside topics. All fetches are
   cached. Figure files live under assets/figures/ and are only
   requested when an <img> showing them is actually rendered
   (loading="lazy" everywhere).
   DATA CONTRACT (exact shapes the content team write; see
   DATA_CONTRACT.md):
   - data/subjects.json:  [{id, name}]  (6 subjects)
   - data/topics.json:    [{id, subject, title, pages, text}]
                          (text may carry [[TABLE:<id>]] marker lines)
   - data/questions.json: [{id, subject, topicId, question, options[4],
                            answerIndex, passage}]
   - data/figures.json:   [{file, subject, topic, topicId, label}]
   - data/tables.json:    [{id, topicId, subject, caption, columns,
                            rows, note}]
   Compatibility: every record is normalised on load so that BOTH
   `subject` and `section` are present (section = subject). Old code
   reading `.section` therefore keeps working, and new code may read
   `.subject`. loadSections()/loadTopicsAndSections() are kept as
   aliases of the subject loaders only; content team must NOT write
   a data/sections.json file (it was deleted with the single-subject
   engine). A failed fetch resolves to [] (never rejects), so missing
   content shows an honest "still being loaded" message, never a crash. */
(function () {
  'use strict';
  var cache = {};
  function fetchJSON(path) {
    if (cache[path]) return Promise.resolve(cache[path]);
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error('load failed: ' + path);
      return r.json();
    }).then(function (j) {
      cache[path] = j;
      return j;
    }).catch(function () {
      cache[path] = [];
      return [];
    });
  }
  function normalise(arr) {
    (arr || []).forEach(function (it) {
      if (!it || typeof it !== 'object') return;
      if (it.subject == null && it.section != null) it.subject = it.section;
      if (it.section == null && it.subject != null) it.section = it.subject;
    });
    return arr;
  }
  function loadSubjects() { return fetchJSON('data/subjects.json'); }
  function loadSections() { return loadSubjects(); }
  function loadTopics() { return fetchJSON('data/topics.json').then(normalise); }
  function loadQuestions() { return fetchJSON('data/questions.json').then(normalise); }
  function loadFigures() { return fetchJSON('data/figures.json').then(normalise); }
  function loadTables() { return fetchJSON('data/tables.json').then(normalise); }
  function loadTopicsAndSubjects() {
    return Promise.all([loadSubjects(), loadTopics()]).then(function (parts) {
      return { subjects: parts[0], sections: parts[0], topics: parts[1] };
    });
  }
  function loadTopicsAndSections() { return loadTopicsAndSubjects(); }
  function subjectName(subjects, id) {
    for (var i = 0; i < (subjects || []).length; i++) {
      if (subjects[i].id === id) return subjects[i].name || id;
    }
    return id || '';
  }
  function sectionName(subjects, id) { return subjectName(subjects, id); }
  function topicById(topics, id) {
    for (var i = 0; i < (topics || []).length; i++) {
      if (topics[i].id === id) return topics[i];
    }
    return null;
  }
  /* A figure belongs to a topic when its topicId equals the topic id
     (the contract's primary key) OR when its topic label equals the
     topic title (fallback for title-only records). A figure whose
     topic label is a bare page/section label matches nothing, and is
     still listed in Library. */
  function figuresForTopic(figures, topic) {
    if (!topic) return [];
    return (figures || []).filter(function (f) {
      return f.topicId === topic.id || f.topic === topic.title;
    });
  }
  function figuresForTopicTitle(figures, title) {
    return (figures || []).filter(function (f) { return f.topic === title; });
  }
  function figurePath(fig) {
    return 'assets/figures/' + fig.file;
  }
  window.OphthData = {
    fetchJSON: fetchJSON,
    loadSubjects: loadSubjects, loadSections: loadSections,
    loadTopics: loadTopics,
    loadQuestions: loadQuestions, loadFigures: loadFigures, loadTables: loadTables,
    loadTopicsAndSubjects: loadTopicsAndSubjects,
    loadTopicsAndSections: loadTopicsAndSections,
    subjectName: subjectName, sectionName: sectionName, topicById: topicById,
    figuresForTopic: figuresForTopic,
    figuresForTopicTitle: figuresForTopicTitle,
    figurePath: figurePath
  };
})();
