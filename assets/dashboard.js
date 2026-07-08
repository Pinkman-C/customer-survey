/* ==========================================================================
   Auctelia Dashboard — vanilla JS + Chart.js
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     Config — David: fill these in and redeploy to connect real data.
     Publish each Google Sheet tab via File > Share > Publish to web,
     format "Comma-separated values (.csv)", then paste the resulting
     URL below. Leave blank to keep showing demo data.
  ------------------------------------------------------------------ */
  var CONFIG = {
    DASHBOARD_PASSWORD: "auctelia2026",
    SHEET_CSV_URL: {
      vendeurs: "",
      acheteurs: ""
    }
  };

  var COLUMNS = {
    vendeurs: ["timestamp", "lang", "source", "user_agent", "survey_type", "segment", "nps", "csat_prix", "csat_suivi", "ces_facilite", "concurrence", "concurrence_order", "intention_retour", "verbatim"],
    acheteurs: ["timestamp", "lang", "source", "user_agent", "survey_type", "segment", "nps", "csat_confiance", "csat_descriptions", "ces_enlevement", "freins", "freins_order", "usage_mobile", "verbatim"]
  };

  var SEGMENT_LABELS = {
    vendeurs: { actif: "Plusieurs ventes", passe: "Dernière vente >1 an", occasionnel: "Une seule vente" },
    acheteurs: { regulier: "3+ achats (12 mois)", occasionnel: "1-2 achats", non_acheteur: "Inscrit, aucun achat" }
  };

  var CHOICE_LABELS = {
    vendeurs: {
      catawiki: "Catawiki", bidspotter: "Bidspotter", surplex: "Surplex", troostwijk: "Troostwijk",
      vente_directe: "Vente directe", autre: "Autre", non_uniquement_auctelia: "Non, uniquement Auctelia"
    },
    acheteurs: {
      prix_reserve_eleve: "Prix de réserve trop élevés", peu_de_lots: "Trop peu de lots dans ma catégorie",
      logistique_compliquee: "Logistique d'enlèvement compliquée", concurrence_forte: "Concurrence trop forte",
      frais_adjudication: "Frais d'adjudication", annulation_post_adjudication: "Risque d'annulation après adjudication",
      rien_satisfait: "Rien, je suis satisfait", autre: "Autre"
    }
  };

  var CSAT_QUESTIONS = {
    vendeurs: [
      { field: "csat_prix", label: "Prix de vente obtenu" },
      { field: "csat_suivi", label: "Suivi commercial" }
    ],
    acheteurs: [
      { field: "csat_confiance", label: "Confiance / fiabilité" },
      { field: "csat_descriptions", label: "Qualité des descriptions" }
    ]
  };

  var GOLD = "#E8A020";
  var DARK = "#11141E";
  var RED = "#D8513F";
  var GREEN = "#2E9E6B";
  var INK3 = "#7A8296";
  var GRAY = "#B7BCC9";

  var state = {
    type: "vendeurs",
    data: { vendeurs: [], acheteurs: [] },
    isMock: { vendeurs: true, acheteurs: true },
    charts: {},
    page: 1
  };

  /* ------------------------------------------------------------------
     Password gate
  ------------------------------------------------------------------ */
  var gate = document.getElementById("gate");
  var shell = document.getElementById("dash-shell");

  if (sessionStorage.getItem("au_dash_auth") === "1") {
    showDashboard();
  }

  document.getElementById("gate-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var val = document.getElementById("gate-password").value;
    if (val === CONFIG.DASHBOARD_PASSWORD) {
      sessionStorage.setItem("au_dash_auth", "1");
      showDashboard();
    } else {
      document.getElementById("gate-error").style.display = "block";
    }
  });

  document.getElementById("logout-btn").addEventListener("click", function () {
    sessionStorage.removeItem("au_dash_auth");
    window.location.reload();
  });

  function showDashboard() {
    gate.style.display = "none";
    shell.style.display = "flex";
    init();
  }

  /* ------------------------------------------------------------------
     Init
  ------------------------------------------------------------------ */
  function init() {
    document.querySelectorAll(".dash-type-switch button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".dash-type-switch button").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        state.type = btn.dataset.type;
        state.page = 1;
        renderAll();
      });
    });

    document.getElementById("export-csv-btn").addEventListener("click", exportCsv);
    document.getElementById("page-prev").addEventListener("click", function () { changePage(-1); });
    document.getElementById("page-next").addEventListener("click", function () { changePage(1); });

    loadData("vendeurs").then(function () { renderIfCurrent("vendeurs"); });
    loadData("acheteurs").then(function () { renderIfCurrent("acheteurs"); });
  }

  function renderIfCurrent(type) {
    if (state.type === type) renderAll();
  }

  /* ------------------------------------------------------------------
     Data loading — real CSV if configured, else mock dataset
  ------------------------------------------------------------------ */
  function loadData(type) {
    var url = CONFIG.SHEET_CSV_URL[type];
    if (!url) {
      state.data[type] = generateMockData(type);
      state.isMock[type] = true;
      return Promise.resolve();
    }
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (csvText) {
        var rows = parseCsv(csvText, COLUMNS[type]);
        if (rows.length === 0) throw new Error("empty sheet");
        state.data[type] = rows;
        state.isMock[type] = false;
      })
      .catch(function (err) {
        console.error("[dashboard] Failed to load " + type + " sheet, falling back to demo data:", err.message || err);
        state.data[type] = generateMockData(type);
        state.isMock[type] = true;
      });
  }

  function parseCsv(text, columns) {
    var lines = [];
    var cur = "";
    var row = [];
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { cur += c; }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") { row.push(cur); cur = ""; }
        else if (c === "\n" || c === "\r") {
          if (c === "\r" && text[i + 1] === "\n") i++;
          row.push(cur); cur = "";
          lines.push(row); row = [];
        } else cur += c;
      }
    }
    if (cur.length || row.length) { row.push(cur); lines.push(row); }
    if (lines.length === 0) return [];

    var header = lines[0].map(function (h) { return h.trim().toLowerCase(); });
    var dataLines = lines.slice(1).filter(function (l) { return l.some(function (v) { return v.trim() !== ""; }); });

    return dataLines.map(function (line) {
      var obj = {};
      header.forEach(function (h, idx) { obj[h] = line[idx] !== undefined ? line[idx] : ""; });
      if (obj.nps !== undefined && obj.nps !== "") obj.nps = Number(obj.nps);
      columns.forEach(function (col) {
        // Leave blank cells as "" (question was skipped) rather than coercing
        // to 0 — average() below relies on "" being excluded, not counted.
        if (/^(csat_|ces_)/.test(col) && obj[col] !== undefined && obj[col] !== "") obj[col] = Number(obj[col]);
      });
      return obj;
    });
  }

  /* ------------------------------------------------------------------
     Mock data generator (demo mode)
  ------------------------------------------------------------------ */
  var VERBATIMS_MOCK = {
    vendeurs: {
      promoter: [
        "Un suivi impeccable, mon lot a été vendu au-dessus de mes attentes.",
        "Processus simple et rapide, je recommande sans hésiter.",
        "Bon accompagnement, je reviendrai pour ma prochaine vente."
      ],
      passive: [
        "Correct dans l'ensemble mais le suivi pourrait être plus proactif.",
        "Le prix obtenu était dans la moyenne, rien d'exceptionnel."
      ],
      detractor: [
        "Prix final très en dessous de l'estimation initiale, déçu.",
        "Peu de nouvelles pendant plusieurs semaines, manque de transparence.",
        "Trop de frais cachés par rapport à ce qui avait été annoncé."
      ]
    },
    acheteurs: {
      promoter: [
        "Enlèvement simple et matériel conforme aux photos, très satisfait.",
        "Bonne expérience globale, je continuerai à enchérir régulièrement."
      ],
      passive: [
        "Ça se passe bien mais il manque de lots dans ma catégorie.",
        "Descriptions correctes mais parfois un peu sommaires."
      ],
      detractor: [
        "Matériel reçu en moins bon état que ce que montraient les photos.",
        "Logistique d'enlèvement beaucoup trop compliquée pour un particulier.",
        "Frais d'adjudication trop élevés par rapport à la valeur du lot."
      ]
    }
  };

  function seededRandom(seed) {
    var s = seed;
    return function () {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  function generateMockData(type) {
    var rng = seededRandom(type === "vendeurs" ? 42 : 1337);
    var n = 140;
    var rows = [];
    var segments = type === "vendeurs" ? ["actif", "passe", "occasionnel"] : ["regulier", "occasionnel", "non_acheteur"];
    var choiceKeys = Object.keys(CHOICE_LABELS[type]);
    var now = 1751500000000; // fixed reference timestamp (July 2025) to keep demo data stable

    for (var i = 0; i < n; i++) {
      var npsBucket = rng();
      var nps;
      if (npsBucket < 0.32) nps = Math.floor(rng() * 7); // detractor 0-6
      else if (npsBucket < 0.55) nps = 7 + Math.floor(rng() * 2); // passive 7-8
      else nps = 9 + Math.floor(rng() * 2); // promoter 9-10

      var category = nps <= 6 ? "detractor" : (nps <= 8 ? "passive" : "promoter");
      var csatBase = category === "promoter" ? 4 : (category === "passive" ? 3 : 2);
      var csat1 = clamp(csatBase + Math.round(rng() * 2) - 1, 1, 5);
      var csat2 = clamp(csatBase + Math.round(rng() * 2) - 1, 1, 5);
      // 7 = positive (facile/fluide), 1 = negative — same direction as NPS/CSAT.
      var cesBase = category === "promoter" ? 6 : (category === "passive" ? 4 : 2);
      var ces = clamp(cesBase + Math.round(rng() * 2) - 1, 1, 7);

      var numChoices = 1 + Math.floor(rng() * 2);
      var choices = [];
      for (var c = 0; c < numChoices; c++) {
        choices.push(choiceKeys[Math.floor(rng() * choiceKeys.length)]);
      }
      choices = Array.from(new Set(choices));
      var shownOrder = shuffleWithRng(choiceKeys.slice(), rng);

      var pool = VERBATIMS_MOCK[type][category];
      var hasVerbatim = rng() < 0.5;
      var verbatim = hasVerbatim ? pool[Math.floor(rng() * pool.length)] : "";

      var daysAgo = Math.floor(rng() * 28);
      var ts = new Date(now - daysAgo * 86400000 - Math.floor(rng() * 86400000));

      var row = {
        timestamp: ts.toISOString(),
        lang: rng() < 0.7 ? "fr" : "nl",
        source: "mailchimp_" + type,
        user_agent: rng() < 0.4 ? "Mobile" : "Desktop",
        survey_type: type,
        segment: segments[Math.floor(rng() * segments.length)],
        nps: nps,
        verbatim: verbatim
      };

      if (type === "vendeurs") {
        row.csat_prix = csat1;
        row.csat_suivi = csat2;
        row.ces_facilite = ces;
        row.concurrence = choices.join(", ");
        row.concurrence_order = shownOrder.join(", ");
        var intentions = ["certainement", "probablement", "ne_sait_pas", "probablement_pas", "non"];
        row.intention_retour = intentions[category === "promoter" ? Math.floor(rng() * 2) : (category === "passive" ? 2 : 3 + Math.floor(rng() * 2))];
      } else {
        row.csat_confiance = csat1;
        // Q4/Q5 are skipped in the real form for "non_acheteur" — mirror
        // that here so the dashboard's blank-value handling gets exercised.
        row.csat_descriptions = row.segment === "non_acheteur" ? "" : csat2;
        row.ces_enlevement = row.segment === "non_acheteur" ? "" : ces;
        row.freins = choices.join(", ");
        row.freins_order = shownOrder.join(", ");
        var devices = ["ordinateur", "smartphone", "les_deux"];
        row.usage_mobile = devices[Math.floor(rng() * devices.length)];
      }

      rows.push(row);
    }

    rows.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
    return rows;
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function shuffleWithRng(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  /* ------------------------------------------------------------------
     Computations
  ------------------------------------------------------------------ */
  function computeNps(rows) {
    if (!rows.length) return { score: 0, promoters: 0, passives: 0, detractors: 0, total: 0 };
    var promoters = rows.filter(function (r) { return r.nps >= 9; }).length;
    var detractors = rows.filter(function (r) { return r.nps <= 6; }).length;
    var passives = rows.length - promoters - detractors;
    var score = Math.round(((promoters - detractors) / rows.length) * 100);
    return { score: score, promoters: promoters, passives: passives, detractors: detractors, total: rows.length };
  }

  function average(rows, field) {
    // Skipped questions (e.g. csat_descriptions/ces_enlevement for
    // non_acheteur) store "" — exclude those rather than let Number("")
    // silently coerce to 0 and drag the average down.
    var vals = rows
      .map(function (r) { return r[field]; })
      .filter(function (v) { return v !== undefined && v !== null && v !== ""; })
      .map(Number)
      .filter(function (v) { return !isNaN(v); });
    if (!vals.length) return 0;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }

  function splitByRecency(rows) {
    var sorted = rows.slice().sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
    if (!sorted.length) return null;
    var latest = new Date(sorted[0].timestamp).getTime();
    var recent = sorted.filter(function (r) { return latest - new Date(r.timestamp).getTime() <= 7 * 86400000; });
    var prior = sorted.filter(function (r) {
      var age = latest - new Date(r.timestamp).getTime();
      return age > 7 * 86400000 && age <= 14 * 86400000;
    });
    if (recent.length < 5 || prior.length < 5) return null;
    return { recent: recent, prior: prior };
  }

  /* ------------------------------------------------------------------
     Render orchestration
  ------------------------------------------------------------------ */
  function renderAll() {
    var type = state.type;
    var rows = state.data[type];

    document.getElementById("header-type-label").textContent = type === "vendeurs" ? "Vendeurs" : "Acheteurs";
    document.getElementById("choices-title").textContent = type === "vendeurs" ? "Concurrence" : "Freins & concurrence";
    document.getElementById("mock-banner").style.display = state.isMock[type] ? "block" : "none";

    var lastDate = rows.length ? new Date(Math.max.apply(null, rows.map(function (r) { return new Date(r.timestamp).getTime(); }))) : null;
    document.getElementById("header-meta").textContent = rows.length
      ? rows.length + " réponses · dernière réponse le " + formatDate(lastDate)
      : "Aucune réponse pour le moment";

    renderKpis(rows, type);
    safeRender(renderNpsDistribution, rows);
    safeRender(renderSegments, rows, type);
    safeRender(renderCsatCharts, rows, type);
    safeRender(renderChoicesChart, rows, type);
    renderChoicesNpsCorrelation(rows, type);
    renderVerbatims(rows, type);
    state.page = 1;
    renderRawTable(rows, type);
  }

  // Charts are a CDN-loaded enhancement — a slow/blocked CDN must never
  // prevent the KPI, verbatim, or raw-data blocks (which don't need Chart.js)
  // from rendering.
  function safeRender(fn, rows, type) {
    if (typeof Chart === "undefined") {
      console.error("[dashboard] Chart.js failed to load — charts skipped, other blocks still render.");
      return;
    }
    try {
      fn(rows, type);
    } catch (err) {
      console.error("[dashboard] Chart render failed:", err);
    }
  }

  function formatDate(d) {
    if (!d) return "—";
    return d.toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  /* ------------------------------------------------------------------
     Bloc 1 — KPIs
  ------------------------------------------------------------------ */
  function renderKpis(rows, type) {
    var grid = document.getElementById("kpi-grid");
    grid.innerHTML = "";
    grid.className = "dash-kpi-grid";

    var nps = computeNps(rows);
    var csatField = CSAT_QUESTIONS[type][0].field;
    var csatAvg = average(rows, csatField);
    var cesField = type === "vendeurs" ? "ces_facilite" : "ces_enlevement";
    var cesAvg = average(rows, cesField);

    var split = splitByRecency(rows);
    var npsDelta = null, csatDelta = null, cesDelta = null;
    if (split) {
      npsDelta = nps.score - computeNps(split.prior).score;
      csatDelta = average(split.recent, csatField) - average(split.prior, csatField);
      cesDelta = average(split.recent, cesField) - average(split.prior, cesField);
    }

    grid.appendChild(kpiCard({
      label: "NPS",
      value: rows.length ? nps.score : "—",
      sub: rows.length ? nps.promoters + " promoteurs · " + nps.passives + " passifs · " + nps.detractors + " détracteurs" : "Pas assez de données",
      delta: npsDelta,
      thermo: { pct: (nps.score + 100) / 2, color: thermoColor(nps.score, -100, 100) }
    }));

    grid.appendChild(kpiCard({
      label: "CSAT — " + CSAT_QUESTIONS[type][0].label,
      value: rows.length ? csatAvg.toFixed(1) + " / 5" : "—",
      sub: "Moyenne sur " + rows.length + " réponses",
      delta: csatDelta,
      thermo: { pct: (csatAvg / 5) * 100, color: thermoColor(csatAvg, 1, 5) }
    }));

    grid.appendChild(kpiCard({
      label: "CES — Effort",
      value: rows.length ? cesAvg.toFixed(1) + " / 7" : "—",
      sub: "1 = difficile/compliqué · 7 = facile/fluide",
      delta: cesDelta,
      thermo: { pct: (cesAvg / 7) * 100, color: thermoColor(cesAvg, 1, 7) }
    }));
  }

  function thermoColor(val, min, max) {
    var pct = (val - min) / (max - min);
    if (pct < 0.4) return RED;
    if (pct < 0.7) return GOLD;
    return GREEN;
  }

  function kpiCard(opts) {
    var card = document.createElement("div");
    card.className = "dash-kpi-card";
    var deltaHtml = "";
    if (opts.delta !== null && opts.delta !== undefined && !isNaN(opts.delta)) {
      var positive = opts.deltaInverse ? opts.delta < 0 : opts.delta > 0;
      var arrow = opts.delta === 0 ? "→" : (positive ? "↑" : "↓");
      var cls = opts.delta === 0 ? "" : (positive ? "up" : "down");
      deltaHtml = ' <span class="dash-kpi-delta ' + cls + '">' + arrow + " " + Math.abs(opts.delta).toFixed(1) + " vs sem. préc.</span>";
    }
    card.innerHTML =
      '<div class="dash-kpi-label">' + opts.label + '</div>' +
      '<div class="dash-kpi-value">' + opts.value + '</div>' +
      '<div class="dash-kpi-sub">' + opts.sub + deltaHtml + '</div>' +
      '<div class="dash-thermo"><div class="dash-thermo-fill" style="width:' + clamp(opts.thermo.pct, 0, 100) + '%; background:' + opts.thermo.color + ';"></div></div>';
    return card;
  }

  /* ------------------------------------------------------------------
     Bloc 2 — NPS distribution
  ------------------------------------------------------------------ */
  function renderNpsDistribution(rows) {
    var counts = new Array(11).fill(0);
    rows.forEach(function (r) { if (r.nps >= 0 && r.nps <= 10) counts[r.nps]++; });
    var colors = counts.map(function (_, i) { return i <= 6 ? RED : (i <= 8 ? GRAY : GREEN); });
    var total = rows.length || 1;
    var labels = counts.map(function (c, i) { return String(i); });

    destroyChart("nps-dist");
    state.charts["nps-dist"] = new Chart(document.getElementById("chart-nps-dist"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: colors,
          borderRadius: 4,
          maxBarThickness: 34
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var pct = ((ctx.raw / total) * 100).toFixed(0);
                return ctx.raw + " réponses (" + pct + "%)";
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { precision: 0 } },
          y: { grid: { display: false }, reverse: true }
        }
      }
    });
  }

  /* ------------------------------------------------------------------
     Bloc 3 — Segments donut
  ------------------------------------------------------------------ */
  function renderSegments(rows, type) {
    var labelsMap = SEGMENT_LABELS[type];
    var keys = Object.keys(labelsMap);
    var counts = keys.map(function (k) { return rows.filter(function (r) { return r.segment === k; }).length; });

    destroyChart("segments");
    state.charts["segments"] = new Chart(document.getElementById("chart-segments"), {
      type: "doughnut",
      data: {
        labels: keys.map(function (k) { return labelsMap[k]; }),
        datasets: [{
          data: counts,
          backgroundColor: [GOLD, DARK, INK3],
          borderWidth: 2,
          borderColor: "#fff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 16 } } }
      }
    });
  }

  /* ------------------------------------------------------------------
     Bloc 4 — CSAT detail charts
  ------------------------------------------------------------------ */
  function renderCsatCharts(rows, type) {
    var grid = document.getElementById("csat-charts-grid");
    grid.innerHTML = "";

    CSAT_QUESTIONS[type].forEach(function (q, idx) {
      var card = document.createElement("div");
      card.className = "dash-card";
      var canvasId = "chart-csat-" + idx;
      card.innerHTML = '<div style="font-weight:600; margin-bottom:12px; color:var(--au-dark);">' + q.label + '</div><div class="dash-chart-wrap" style="height:220px;"><canvas id="' + canvasId + '"></canvas></div>';
      grid.appendChild(card);

      var counts = [1, 2, 3, 4, 5].map(function (v) { return rows.filter(function (r) { return r[q.field] === v; }).length; });

      destroyChart("csat-" + idx);
      state.charts["csat-" + idx] = new Chart(document.getElementById(canvasId), {
        type: "bar",
        data: {
          labels: ["1", "2", "3", "4", "5"],
          datasets: [{ data: counts, backgroundColor: GOLD, borderRadius: 4, maxBarThickness: 44 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } }
        }
      });
    });
  }

  /* ------------------------------------------------------------------
     Bloc 5 — multi-choice
  ------------------------------------------------------------------ */
  function renderChoicesChart(rows, type) {
    var field = type === "vendeurs" ? "concurrence" : "freins";
    var labelsMap = CHOICE_LABELS[type];
    var tally = {};
    Object.keys(labelsMap).forEach(function (k) { tally[k] = 0; });

    rows.forEach(function (r) {
      var raw = r[field] || "";
      raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (v) {
        if (tally[v] === undefined) tally[v] = 0;
        tally[v]++;
      });
    });

    var entries = Object.keys(tally).map(function (k) { return { key: k, label: labelsMap[k] || k, count: tally[k] }; });
    entries.sort(function (a, b) { return b.count - a.count; });

    destroyChart("choices");
    state.charts["choices"] = new Chart(document.getElementById("chart-choices"), {
      type: "bar",
      data: {
        labels: entries.map(function (e) { return e.label; }),
        datasets: [{ data: entries.map(function (e) { return e.count; }), backgroundColor: DARK, borderRadius: 4, maxBarThickness: 28 }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { display: false } }, y: { grid: { display: false } } }
      }
    });
  }

  // Objectifies how much each checked irritant actually correlates with
  // loyalty, computed after the fact from independent answers (NPS vs.
  // checkbox) rather than asked directly — avoids leading respondents
  // toward a causal link the questions never suggested.
  function renderChoicesNpsCorrelation(rows, type) {
    var wrap = document.getElementById("choices-correlation");
    if (!wrap) return;

    var field = type === "vendeurs" ? "concurrence" : "freins";
    var labelsMap = CHOICE_LABELS[type];
    var overallAvg = average(rows, "nps");

    var byChoice = {};
    Object.keys(labelsMap).forEach(function (k) { byChoice[k] = []; });

    rows.forEach(function (r) {
      var raw = r[field] || "";
      raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (v) {
        if (!byChoice[v]) byChoice[v] = [];
        byChoice[v].push(r.nps);
      });
    });

    var entries = Object.keys(byChoice)
      .filter(function (k) { return byChoice[k].length >= 5; })
      .map(function (k) {
        var vals = byChoice[k];
        var avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
        return { label: labelsMap[k] || k, count: vals.length, avg: avg, delta: avg - overallAvg };
      });

    entries.sort(function (a, b) { return a.delta - b.delta; });

    if (!entries.length) {
      wrap.innerHTML = '<p style="color:var(--au-ink3); font-size:0.85rem;">Pas encore assez de réponses par item pour calculer une corrélation fiable (minimum 5 par item).</p>';
      return;
    }

    wrap.innerHTML =
      '<div style="font-size:0.8rem; color:var(--au-ink3); margin-bottom:10px;">NPS moyen des répondants ayant coché chaque item, comparé au NPS moyen global (' + overallAvg.toFixed(1) + ') — calculé après coup, pas suggéré par la question.</div>' +
      entries.map(function (e) {
        var color = e.delta <= -10 ? RED : (e.delta >= 10 ? GREEN : INK3);
        var sign = e.delta > 0 ? "+" : "";
        return '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--au-line); font-size:0.86rem;">' +
          '<span>' + escapeHtml(e.label) + ' <span style="color:var(--au-ink3);">(' + e.count + ')</span></span>' +
          '<span style="font-weight:700; color:' + color + ';">' + e.avg.toFixed(1) + ' <span style="font-weight:500; font-size:0.78rem;">(' + sign + e.delta.toFixed(1) + ')</span></span>' +
          '</div>';
      }).join("");
  }

  /* ------------------------------------------------------------------
     Bloc 6 — Verbatims
  ------------------------------------------------------------------ */
  function renderVerbatims(rows, type) {
    var list = document.getElementById("verbatim-list");
    list.innerHTML = "";

    var withText = rows.filter(function (r) { return r.verbatim && String(r.verbatim).trim() !== ""; });
    withText.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
    var top20 = withText.slice(0, 20);

    if (!top20.length) {
      list.innerHTML = '<p style="color:var(--au-ink3); font-size:0.9rem;">Aucun verbatim pour le moment.</p>';
      return;
    }

    top20.forEach(function (r) {
      var category = r.nps <= 6 ? "detractor" : (r.nps <= 8 ? "passive" : "promoter");
      var div = document.createElement("div");
      div.className = "dash-verbatim " + category;
      var segLabel = SEGMENT_LABELS[type][r.segment] || r.segment;
      div.innerHTML =
        '<div class="dash-verbatim-meta"><span>' + formatDate(new Date(r.timestamp)) + '</span><span>' + escapeHtml(segLabel) + '</span><span>NPS ' + r.nps + '</span></div>' +
        '<div class="dash-verbatim-text">' + escapeHtml(r.verbatim) + '</div>';
      list.appendChild(div);
    });
  }

  function escapeHtml(str) {
    var d = document.createElement("div");
    d.textContent = String(str == null ? "" : str);
    return d.innerHTML;
  }

  /* ------------------------------------------------------------------
     Bloc 7 — raw data table
  ------------------------------------------------------------------ */
  var PAGE_SIZE = 20;

  function renderRawTable(rows, type) {
    var head = document.getElementById("raw-table-head");
    var intentField = type === "vendeurs" ? "intention_retour" : "usage_mobile";
    var intentLabel = type === "vendeurs" ? "Intention retour" : "Usage mobile";
    var csatLabels = CSAT_QUESTIONS[type];

    head.innerHTML = ["Date", "Langue", "Segment", "NPS", csatLabels[0].label, csatLabels[1].label, "CES", intentLabel, "Verbatim"]
      .map(function (h) { return "<th>" + h + "</th>"; }).join("");

    var sorted = rows.slice().sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
    var totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    state.page = clamp(state.page, 1, totalPages);
    var pageRows = sorted.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    var cesField = type === "vendeurs" ? "ces_facilite" : "ces_enlevement";

    var body = document.getElementById("raw-table-body");
    body.innerHTML = pageRows.map(function (r) {
      var verbatim = (r.verbatim || "").toString();
      if (verbatim.length > 60) verbatim = verbatim.slice(0, 60) + "…";
      var segLabel = SEGMENT_LABELS[type][r.segment] || r.segment;
      return "<tr>" +
        "<td>" + formatDate(new Date(r.timestamp)) + "</td>" +
        "<td>" + (r.lang || "").toUpperCase() + "</td>" +
        "<td>" + escapeHtml(segLabel) + "</td>" +
        "<td>" + r.nps + "</td>" +
        "<td>" + (r[csatLabels[0].field] || "") + "</td>" +
        "<td>" + (r[csatLabels[1].field] || "") + "</td>" +
        "<td>" + (r[cesField] || "") + "</td>" +
        "<td>" + escapeHtml(r[intentField] || "") + "</td>" +
        "<td>" + escapeHtml(verbatim) + "</td>" +
        "</tr>";
    }).join("");

    document.getElementById("page-label").textContent = "Page " + state.page + " / " + totalPages;
    document.getElementById("page-prev").disabled = state.page <= 1;
    document.getElementById("page-next").disabled = state.page >= totalPages;
  }

  function changePage(delta) {
    state.page += delta;
    renderRawTable(state.data[state.type], state.type);
  }

  /* ------------------------------------------------------------------
     CSV export
  ------------------------------------------------------------------ */
  function exportCsv() {
    var type = state.type;
    var rows = state.data[type];
    var cols = COLUMNS[type];
    var lines = [cols.join(",")];

    rows.forEach(function (r) {
      var line = cols.map(function (c) {
        var val = r[c] !== undefined ? String(r[c]) : "";
        if (/[",\n]/.test(val)) val = '"' + val.replace(/"/g, '""') + '"';
        return val;
      });
      lines.push(line.join(","));
    });

    var blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "auctelia-enquete-" + type + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ------------------------------------------------------------------
     Chart helpers
  ------------------------------------------------------------------ */
  function destroyChart(key) {
    if (state.charts[key]) {
      state.charts[key].destroy();
      delete state.charts[key];
    }
  }
})();
