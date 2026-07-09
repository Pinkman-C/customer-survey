/* ==========================================================================
   Auctelia Survey Engine — shared vanilla JS stepper logic
   Used by vendeurs.html and acheteurs.html via window.AU_SURVEY_CONFIG
   ========================================================================== */
(function () {
  "use strict";

  var cfg = window.AU_SURVEY_CONFIG;
  if (!cfg) return;

  /* ------------------------------------------------------------------
     Anti double-submission — once a respondent has successfully (or
     even semi-successfully, see submitSurvey) submitted this survey
     type, never show the form again on this device/browser.
  ------------------------------------------------------------------ */
  var SUBMIT_FLAG_KEY = "au_submitted_" + cfg.surveyType;
  if (localStorage.getItem(SUBMIT_FLAG_KEY)) {
    var alreadyLang = (new URLSearchParams(window.location.search)).get("lang") === "nl" ? "nl" : "fr";
    window.location.replace(cfg.thanksUrl + "?lang=" + alreadyLang);
    return;
  }

  var STAR_SVG = '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.4 6.9.7-5.2 4.7 1.5 6.8L12 17.9 5.9 21.1l1.5-6.8L2.2 9.6l6.9-.7L12 2.5z"/></svg>';
  var CHECK_SVG_TEMPLATE = null;

  /* ------------------------------------------------------------------
     Checkbox option order — randomized per respondent to avoid primacy
     bias, computed once per field and cached so it doesn't reshuffle
     mid-answer. Anchor values (e.g. "Autre", "Rien, satisfait") always
     stay pinned at the end, in the order declared.
  ------------------------------------------------------------------ */
  var shuffleCache = {};

  function getDisplayOptions(q, field) {
    if (!q.shuffle) return q.options;
    if (shuffleCache[field]) return shuffleCache[field];

    var anchors = q.anchors || [];
    var nonAnchor = q.options.filter(function (o) { return anchors.indexOf(o.value) === -1; });
    var anchorOpts = anchors
      .map(function (v) { return q.options.filter(function (o) { return o.value === v; })[0]; })
      .filter(Boolean);

    for (var i = nonAnchor.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = nonAnchor[i]; nonAnchor[i] = nonAnchor[j]; nonAnchor[j] = tmp;
    }

    var result = nonAnchor.concat(anchorOpts);
    shuffleCache[field] = result;
    return result;
  }

  /* ------------------------------------------------------------------
     Language detection & persistence
  ------------------------------------------------------------------ */
  function getUrlParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  var lang = getUrlParam("lang");
  if (lang !== "fr" && lang !== "nl") {
    lang = sessionStorage.getItem("au_lang") || "fr";
  }
  sessionStorage.setItem("au_lang", lang);

  var utmSource = getUrlParam("utm_source") || getUrlParam("source") || "";

  var state = {
    step: 0,
    answers: {}
  };

  /* ------------------------------------------------------------------
     Restore in-progress answers after a language switch (see the lang
     switcher below, which stashes state here right before reloading).
  ------------------------------------------------------------------ */
  var ANSWERS_KEY = "au_answers_" + cfg.surveyType;
  var savedState = sessionStorage.getItem(ANSWERS_KEY);
  if (savedState) {
    sessionStorage.removeItem(ANSWERS_KEY);
    try {
      var parsedState = JSON.parse(savedState);
      if (parsedState && parsedState.answers) {
        state.answers = parsedState.answers;
        state.step = parsedState.step || 0;
      }
    } catch (e) { /* corrupt/old state, ignore and start fresh */ }
  }

  var t = cfg.i18n[lang];
  var questions = t.q;
  var total = questions.length;

  /* ------------------------------------------------------------------
     Skip logic — a question can declare skipIf(answers) to be hidden
     based on earlier answers (e.g. segment). Navigation always steps
     over hidden questions; the progress bar counts only visible ones.
  ------------------------------------------------------------------ */
  function isVisible(index) {
    var q = questions[index];
    return !q.skipIf || !q.skipIf(state.answers);
  }

  function visibleCount() {
    var count = 0;
    for (var i = 0; i < total; i++) if (isVisible(i)) count++;
    return count;
  }

  function visiblePosition(index) {
    var pos = 0;
    for (var i = 0; i <= index; i++) if (isVisible(i)) pos++;
    return pos;
  }

  function nextVisibleIndex(fromIndex) {
    var i = fromIndex + 1;
    while (i < total && !isVisible(i)) i++;
    return i;
  }

  function prevVisibleIndex(fromIndex) {
    var i = fromIndex - 1;
    while (i >= 0 && !isVisible(i)) i--;
    return i;
  }

  function pruneSkippedAnswers() {
    for (var i = 0; i < total; i++) {
      if (!isVisible(i)) {
        delete state.answers[FIELD(i)];
        delete state.answers[FIELD(i) + "_autre_detail"];
      }
    }
  }

  // Guard against a restored step (see language-switch restore above)
  // that's no longer visible for the current answers.
  if (!isVisible(state.step)) {
    var fixedStep = nextVisibleIndex(state.step - 1);
    state.step = fixedStep < total ? fixedStep : Math.max(0, prevVisibleIndex(total));
  }

  var stepperEl = document.getElementById("stepper");
  var progressFill = document.getElementById("progress-fill");
  var progressText = document.getElementById("progress-text");
  var footerPrivacy = document.getElementById("footer-privacy");
  document.documentElement.lang = lang;
  if (footerPrivacy) footerPrivacy.textContent = t.footerPrivacy;

  /* ------------------------------------------------------------------
     Language switcher
  ------------------------------------------------------------------ */
  document.querySelectorAll(".au-lang-switch button").forEach(function (btn) {
    if (btn.dataset.lang === lang) btn.classList.add("active");
    else btn.classList.remove("active");
    btn.addEventListener("click", function () {
      var newLang = btn.dataset.lang;
      sessionStorage.setItem(ANSWERS_KEY, JSON.stringify({ answers: state.answers, step: state.step }));
      var url = new URL(window.location.href);
      url.searchParams.set("lang", newLang);
      window.location.href = url.toString();
    });
  });

  /* ------------------------------------------------------------------
     Render helpers
  ------------------------------------------------------------------ */
  function el(tag, className, html) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function isAnswered(index) {
    var q = questions[index];
    var val = state.answers[FIELD(index)];
    if (q.optional) return true;
    if (q.type === "checkbox") return Array.isArray(val) && val.length > 0;
    if (q.type === "textarea") return true; // optional by spec (Q8 always optional)
    return val !== undefined && val !== null && val !== "";
  }

  function FIELD(index) {
    return cfg.fieldNames[index];
  }

  function renderStep(index) {
    var q = questions[index];
    var field = FIELD(index);
    var wrap = el("div", "au-step" + (index === state.step ? " active" : ""));
    wrap.dataset.index = index;

    var eyebrow = el("div", "au-eyebrow", escapeHtml(q.eyebrow));
    wrap.appendChild(eyebrow);

    var title = el("div", "au-question", escapeHtml(q.title) + (q.optional ? ' <span class="au-optional-tag">' + t.optional + "</span>" : ""));
    wrap.appendChild(title);

    if (q.help) {
      wrap.appendChild(el("div", "au-help", escapeHtml(q.help)));
    }

    var fieldArea = el("div", "au-field-area");

    if (q.type === "radio") {
      fieldArea.appendChild(renderRadio(q, field));
    } else if (q.type === "nps") {
      fieldArea.appendChild(renderNps(q, field));
    } else if (q.type === "stars") {
      fieldArea.appendChild(renderStars(q, field));
    } else if (q.type === "ces") {
      fieldArea.appendChild(renderCes(q, field));
    } else if (q.type === "checkbox") {
      fieldArea.appendChild(renderCheckbox(q, field));
    } else if (q.type === "textarea") {
      fieldArea.appendChild(renderTextarea(q, field));
    }

    wrap.appendChild(fieldArea);
    wrap.appendChild(renderNav(index));

    return wrap;
  }

  function escapeHtml(str) {
    if (!str) return "";
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function renderRadio(q, field) {
    var container = el("div", "au-options");
    q.options.forEach(function (opt) {
      var label = el("label", "au-option" + (state.answers[field] === opt.value ? " selected" : ""));
      var input = document.createElement("input");
      input.type = "radio";
      input.name = field;
      input.value = opt.value;
      if (state.answers[field] === opt.value) input.checked = true;
      input.addEventListener("change", function () {
        state.answers[field] = opt.value;
        refreshStep();
        setTimeout(function () { goNext(true); }, 180);
      });
      label.appendChild(input);
      var textWrap = el("div", "au-option-text");
      textWrap.appendChild(el("div", "au-option-title", escapeHtml(opt.title)));
      if (opt.desc) textWrap.appendChild(el("div", "au-option-desc", escapeHtml(opt.desc)));
      label.appendChild(textWrap);
      container.appendChild(label);
    });
    return container;
  }

  function renderNps(q, field) {
    var wrap = el("div");
    var scale = el("div", "au-nps-scale");
    for (var i = 0; i <= 10; i++) {
      (function (val) {
        var cell = el("button", "au-nps-cell" + (state.answers[field] === val ? " selected" : ""), String(val));
        cell.type = "button";
        cell.setAttribute("aria-label", "Score " + val);
        cell.addEventListener("click", function () {
          state.answers[field] = val;
          refreshStep();
        });
        scale.appendChild(cell);
      })(i);
    }
    wrap.appendChild(scale);
    var labels = el("div", "au-nps-labels");
    labels.appendChild(el("span", null, escapeHtml(t.npsLow)));
    labels.appendChild(el("span", null, escapeHtml(t.npsHigh)));
    wrap.appendChild(labels);
    return wrap;
  }

  function renderStars(q, field) {
    var wrap = el("div");
    var starsWrap = el("div", "au-stars");
    for (var i = 1; i <= 5; i++) {
      (function (val) {
        var btn = el("button", "au-star-btn" + (state.answers[field] >= val ? " active" : ""), STAR_SVG);
        btn.type = "button";
        btn.setAttribute("aria-label", val + "/5");
        btn.addEventListener("click", function () {
          state.answers[field] = val;
          refreshStep();
        });
        starsWrap.appendChild(btn);
      })(i);
    }
    wrap.appendChild(starsWrap);
    var labels = el("div", "au-scale-labels");
    labels.appendChild(el("span", null, "1 = " + escapeHtml(q.lowLabel)));
    labels.appendChild(el("span", null, "5 = " + escapeHtml(q.highLabel)));
    wrap.appendChild(labels);
    return wrap;
  }

  function renderCes(q, field) {
    var wrap = el("div");
    var scale = el("div", "au-ces-scale");
    for (var i = 1; i <= 7; i++) {
      (function (val) {
        var cell = el("button", "au-ces-cell" + (state.answers[field] === val ? " selected" : ""), String(val));
        cell.type = "button";
        cell.addEventListener("click", function () {
          state.answers[field] = val;
          refreshStep();
        });
        scale.appendChild(cell);
      })(i);
    }
    wrap.appendChild(scale);
    var labels = el("div", "au-scale-labels");
    labels.appendChild(el("span", null, "1 = " + escapeHtml(q.lowLabel)));
    labels.appendChild(el("span", null, "7 = " + escapeHtml(q.highLabel)));
    wrap.appendChild(labels);
    return wrap;
  }

  function renderCheckbox(q, field) {
    var wrap = el("div");
    var container = el("div");
    if (!Array.isArray(state.answers[field])) state.answers[field] = [];
    getDisplayOptions(q, field).forEach(function (opt) {
      var checked = state.answers[field].indexOf(opt.value) !== -1;
      var label = el("label", "au-check-option" + (checked ? " selected" : ""));
      var input = document.createElement("input");
      input.type = "checkbox";
      input.value = opt.value;
      input.checked = checked;
      input.addEventListener("change", function () {
        var arr = state.answers[field];
        var idx = arr.indexOf(opt.value);
        if (input.checked && idx === -1) arr.push(opt.value);
        if (!input.checked && idx !== -1) arr.splice(idx, 1);
        refreshStep();
      });
      label.appendChild(input);
      label.appendChild(el("span", null, escapeHtml(opt.label)));
      container.appendChild(label);
    });
    wrap.appendChild(container);

    // "Autre" reveal — a free-text field appears as soon as the "autre"
    // option is checked, so we capture what it actually means instead of
    // an unqualified tag in the data.
    if (q.autreReveal && state.answers[field].indexOf("autre") !== -1) {
      var detailField = field + "_autre_detail";
      var reveal = el("div", "au-autre-reveal");
      reveal.appendChild(el("div", "au-autre-label", t.autreLabel));
      var textarea = document.createElement("textarea");
      textarea.className = "au-textarea";
      textarea.maxLength = 300;
      textarea.placeholder = t.autrePlaceholder;
      textarea.value = state.answers[detailField] || "";
      textarea.addEventListener("input", function () {
        state.answers[detailField] = textarea.value;
      });
      reveal.appendChild(textarea);
      wrap.appendChild(reveal);
    }
    return wrap;
  }

  function renderTextarea(q, field) {
    var wrap = el("div");
    var textarea = document.createElement("textarea");
    textarea.className = "au-textarea";
    textarea.maxLength = 500;
    textarea.placeholder = q.placeholder || "";
    textarea.value = state.answers[field] || "";
    var count = el("div", "au-char-count", (textarea.value.length) + " / 500 " + t.charLimit);
    textarea.addEventListener("input", function () {
      state.answers[field] = textarea.value;
      count.textContent = textarea.value.length + " / 500 " + t.charLimit;
    });
    wrap.appendChild(textarea);
    wrap.appendChild(count);
    return wrap;
  }

  function renderNav(index) {
    var row = el("div", "au-nav-row");
    if (prevVisibleIndex(index) >= 0) {
      var back = el("button", "au-btn au-btn-ghost", t.back);
      back.type = "button";
      back.addEventListener("click", function () {
        var prev = prevVisibleIndex(index);
        if (prev >= 0) goTo(prev);
      });
      row.appendChild(back);
    } else {
      row.appendChild(el("span"));
    }

    var isLast = nextVisibleIndex(index) >= total;
    var next = el("button", "au-btn au-btn-primary", isLast ? t.submit : t.next);
    next.type = "button";
    next.disabled = !isAnswered(index);
    next.addEventListener("click", function () {
      if (isLast) {
        submitSurvey(next);
      } else {
        goNext(false);
      }
    });
    row.appendChild(next);
    return row;
  }

  function refreshStep() {
    var current = stepperEl.querySelector('.au-step[data-index="' + state.step + '"]');
    if (!current) return;
    var newStep = renderStep(state.step);
    newStep.classList.add("active");
    stepperEl.replaceChild(newStep, current);
  }

  function goTo(index) {
    state.step = index;
    render();
  }

  function goNext(skipIfInvalid) {
    if (!isAnswered(state.step)) {
      if (skipIfInvalid) return;
      return;
    }
    var next = nextVisibleIndex(state.step);
    if (next < total) {
      state.step = next;
      render();
    }
  }

  function updateProgress() {
    var pos = visiblePosition(state.step);
    var count = visibleCount();
    var pct = (pos / count) * 100;
    progressFill.style.width = pct + "%";
    progressText.textContent = pos + " / " + count;
  }

  function render() {
    stepperEl.innerHTML = "";
    stepperEl.appendChild(renderStep(state.step));
    updateProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ------------------------------------------------------------------
     Submission
  ------------------------------------------------------------------ */
  function buildPayload() {
    pruneSkippedAnswers();

    var payload = {
      timestamp: new Date().toISOString(),
      lang: lang,
      source: utmSource,
      user_agent: navigator.userAgent,
      survey_type: cfg.surveyType,
      audience: cfg.audience || ""
    };
    cfg.fieldNames.forEach(function (name) {
      var val = state.answers[name];
      if (Array.isArray(val)) val = val.join(", ");
      payload[name] = val !== undefined ? val : "";
    });

    // Record the shuffled display order for randomized checklists, so
    // the raw data keeps a record of what each respondent actually saw
    // (see the anti-primacy-bias shuffle in getDisplayOptions), and the
    // free-text detail captured when "autre" was checked (see the
    // "Autre" reveal in renderCheckbox).
    questions.forEach(function (q, idx) {
      var field = FIELD(idx);
      if (q.type === "checkbox" && q.shuffle) {
        var order = shuffleCache[field];
        payload[field + "_order"] = order ? order.map(function (o) { return o.value; }).join(", ") : "";
      }
      if (q.type === "checkbox" && q.autreReveal) {
        payload[field + "_autre_detail"] = state.answers[field + "_autre_detail"] || "";
      }
    });

    return payload;
  }

  function submitSurvey(btn) {
    btn.disabled = true;
    btn.textContent = t.submitting;
    var payload = buildPayload();

    function finish() {
      localStorage.setItem(SUBMIT_FLAG_KEY, "1");
      sessionStorage.removeItem(ANSWERS_KEY);
      window.location.href = cfg.thanksUrl + "?lang=" + lang;
    }

    fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(finish)
      .catch(finish);
  }

  render();
})();
