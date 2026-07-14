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
    // Set to false to open the dashboard to anyone with the URL — useful
    // while there's no real respondent data yet (only the demo dataset is
    // visible anyway). Set back to true before real answers start coming in.
    REQUIRE_PASSWORD: false,
    DASHBOARD_PASSWORD: "auctelia2026",
    SHEET_CSV_URL: {
      vendeurs: "",
      acheteurs: ""
    }
  };

  // Both audiences (actif/churn) submit into the same tab per survey type —
  // see docs/2026-07-09-refonte-enquetes-design.md section 8. The `audience`
  // column is what the dashboard filters on, not a separate sheet.
  var COLUMNS = {
    vendeurs: [
      "timestamp", "lang", "source", "user_agent", "survey_type", "audience",
      "segment", "nps", "csat_prix", "ces_facilite",
      "a_mis_reserve", "origine_prix_reserve", "freq_reserve_non_atteinte",
      "intention_retour",
      "raisons_arret", "raisons_arret_order", "raisons_arret_autre_detail",
      "leviers_retour", "leviers_retour_order", "leviers_retour_autre_detail",
      "verbatim"
    ],
    acheteurs: [
      "timestamp", "lang", "source", "user_agent", "survey_type", "audience",
      "segment", "nps", "csat_confiance", "csat_descriptions", "ces_enlevement",
      "freq_reserve_non_atteinte",
      "freins", "freins_order", "freins_autre_detail",
      "raisons_arret", "raisons_arret_order", "raisons_arret_autre_detail",
      "leviers_retour", "leviers_retour_order", "leviers_retour_autre_detail",
      "verbatim"
    ]
  };

  // Segment values are only unique within a (type, audience) pair — e.g.
  // "regulier" means "3+ achats" for acheteurs actifs but "achetait
  // régulièrement" for acheteurs churn. Always resolve through this triple.
  var SEGMENT_LABELS = {
    acheteurs: {
      actif: { regulier: "3+ achats", occasionnel: "1-2 achats" },
      churn: { regulier: "Achetait régulièrement", occasionnel: "Achetait occasionnellement", une_fois: "Une seule fois" }
    },
    vendeurs: {
      actif: { actif: "Plusieurs ventes", occasionnel: "Une seule vente" },
      churn: { plusieurs: "Vendait plusieurs fois", occasionnelle: "Vente occasionnelle", une_seule: "Une seule vente au total" }
    }
  };

  var FREINS_LABELS = {
    prix_reserve_eleve: "Prix de réserve trop élevés", peu_de_lots: "Trop peu de lots dans ma catégorie",
    logistique_compliquee: "Logistique d'enlèvement compliquée", concurrence_forte: "Concurrence trop forte",
    frais_vente: "Frais de vente", annulation_post_adjudication: "Risque de refus de la vente après l'enchère remportée",
    qualite_interactions: "Qualité des interactions avec le service client",
    rien_satisfait: "Rien, je suis satisfait", autre: "Autre"
  };
  var RAISONS_ACHETEUR_LABELS = {
    pas_de_lots: "Pas trouvé de lots intéressants",
    reserve_non_atteinte: "Prix de réserve trop souvent hors budget/non atteints",
    mauvaise_experience: "Mauvaise expérience (litige, annulation)",
    qualite_interactions: "Qualité insuffisante des échanges avec le service client",
    plus_besoin: "Plus besoin de ce type de matériel industriel",
    alternative_trouvee: "Alternative trouvée",
    aucune_raison: "Aucune raison particulière", autre: "Autre"
  };
  var RAISONS_VENDEUR_LABELS = {
    prix_decevant: "Prix de vente final en dessous des attentes",
    reserve_non_atteinte: "Prix de réserve non atteint sur certains lots",
    suivi_insatisfaisant: "Suivi insatisfaisant",
    qualite_interactions: "Qualité insuffisante des échanges avec le service client",
    mise_en_vente_compliquee: "Mise en vente trop compliquée",
    alternative_trouvee: "Alternative trouvée (autre plateforme)",
    plus_de_materiel: "Plus de matériel industriel à vendre actuellement",
    aucune_raison: "Aucune raison particulière", autre: "Autre"
  };
  var LEVIERS_ACHETEUR_LABELS = {
    plus_de_lots: "Plus de lots pertinents", reserve_realiste: "Prix de réserve plus réalistes",
    meilleure_communication: "Meilleure communication sur les nouveaux lots", enlevement_simple: "Enlèvement plus simple",
    frais_reduits: "Frais réduits", amelioration_service_client: "Amélioration du service client",
    pas_de_retour: "Rien, je ne prévois pas de revenir", autre: "Autre"
  };
  var LEVIERS_VENDEUR_LABELS = {
    reserve_realiste: "Meilleurs résultats", meilleur_accompagnement: "Meilleur accompagnement",
    processus_simple: "Processus plus simple", plus_de_visibilite: "Plus de visibilité sur mes lots",
    pas_de_retour: "Rien, je ne prévois pas de revendre", autre: "Autre"
  };
  var ORIGINE_LABELS = {
    vendeur: "Fixé par le vendeur lui-même", recommandation: "Recommandé par Auctelia",
    ca_depend: "Ça dépend des lots", ne_sait_pas: "Je ne sais pas"
  };
  var INTENTION_LABELS = {
    certainement: "Oui, certainement", probablement: "Probablement", ne_sait_pas: "Je ne sais pas encore",
    probablement_pas: "Probablement pas", non: "Non"
  };
  var FREQ_ACHETEUR_LABELS = { jamais: "Jamais", une_deux_fois: "Une ou deux fois", plusieurs_fois: "Plusieurs fois", ne_sait_pas: "Je ne sais pas" };
  var FREQ_VENDEUR_LABELS = { jamais: "Jamais", parfois: "Parfois", souvent: "Souvent", ne_sait_pas: "Je ne sais pas" };

  var CSAT_QUESTIONS = {
    vendeurs: [
      { field: "csat_prix", label: "Prix de vente obtenu", scale: 5 },
      { field: "ces_facilite", label: "Facilité de mise en vente (1=difficile, 7=facile)", scale: 7 }
    ],
    acheteurs: [
      { field: "csat_confiance", label: "Confiance / fiabilité", scale: 5 },
      { field: "csat_descriptions", label: "Qualité des descriptions", scale: 5 },
      { field: "ces_enlevement", label: "Facilité d'enlèvement (1=compliqué, 7=fluide)", scale: 7 }
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
    audience: "actif",
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

  if (CONFIG.REQUIRE_PASSWORD) {
    document.getElementById("logout-btn").addEventListener("click", function () {
      sessionStorage.removeItem("au_dash_auth");
      window.location.reload();
    });
  } else {
    // No session to log out of while the gate is open — hide the button
    // rather than leave a control that does nothing.
    document.getElementById("logout-btn").style.display = "none";
  }

  function showDashboard() {
    gate.style.display = "none";
    shell.style.display = "flex";
    init();
  }

  /* ------------------------------------------------------------------
     Init
  ------------------------------------------------------------------ */
  function init() {
    document.querySelectorAll("#type-switch button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll("#type-switch button").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        state.type = btn.dataset.type;
        state.page = 1;
        renderAll();
      });
    });

    document.querySelectorAll("#audience-switch button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll("#audience-switch button").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        state.audience = btn.dataset.audience;
        state.page = 1;
        renderAll();
      });
    });

    document.getElementById("export-csv-btn").addEventListener("click", exportCsv);
    document.getElementById("page-prev").addEventListener("click", function () { changePage(-1); });
    document.getElementById("page-next").addEventListener("click", function () { changePage(1); });

    loadData("vendeurs").then(function () { renderIfCurrent("vendeurs"); renderSynthese(); });
    loadData("acheteurs").then(function () { renderIfCurrent("acheteurs"); renderSynthese(); });
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
        // Rows submitted via the forms' test mode (?test=1) carry
        // source === "test" — validation runs, never real answers.
        var rows = parseCsv(csvText, COLUMNS[type]).filter(function (r) {
          return r.source !== "test";
        });
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
     Mock data generator (demo mode) — each type mixes both audiences
     (actif/churn) into one array, mirroring how they land in the same
     Google Sheet tab in production (see COLUMNS above).
  ------------------------------------------------------------------ */
  var VERBATIMS_MOCK = {
    "vendeurs-actif": {
      promoter: ["Un suivi impeccable, mon lot a été vendu au-dessus de mes attentes.", "Processus simple et rapide, je recommande sans hésiter."],
      passive: ["Correct dans l'ensemble mais le suivi pourrait être plus proactif.", "Le prix obtenu était dans la moyenne, rien d'exceptionnel."],
      detractor: ["Mon interlocuteur m'a poussé à mettre une réserve trop haute, résultat : rien vendu.", "Prix final très en dessous de l'estimation initiale, déçu.", "Peu de nouvelles pendant plusieurs semaines, manque de transparence."]
    },
    "vendeurs-churn": {
      promoter: ["Je repartirais volontiers si l'accompagnement était plus personnalisé.", "Bonne expérience globale, j'attends d'avoir à nouveau du matériel industriel à vendre."],
      passive: ["Plus rien à vendre pour le moment, mais rien de négatif à signaler.", "J'ai testé une autre plateforme en parallèle, sans vraie préférence."],
      detractor: ["On m'a recommandé un prix de réserve qui n'a jamais été atteint sur mes 3 derniers lots, j'ai arrêté.", "Le suivi commercial a été quasi inexistant après la mise en vente.", "Trop de lots retirés faute d'enchérisseurs suffisants."]
    },
    "acheteurs-actif": {
      promoter: ["Enlèvement simple et matériel industriel conforme aux photos, très satisfait.", "Bonne expérience globale, je continuerai à enchérir régulièrement."],
      passive: ["Ça se passe bien mais plusieurs lots où j'ai enchéri sont finalement partis sans être vendus.", "Descriptions correctes mais parfois un peu sommaires."],
      detractor: ["J'ai enchéri trois fois sur des lots qui ont fini par être retirés, c'est décourageant.", "Logistique d'enlèvement beaucoup trop compliquée pour un particulier.", "Prix de réserve totalement déconnectés du marché de l'occasion."]
    },
    "acheteurs-churn": {
      promoter: ["Je reviendrais volontiers si de nouveaux lots intéressants arrivaient.", "Bonne plateforme dans l'ensemble, j'ai juste arrêté par manque de temps."],
      passive: ["Plus grand-chose à acheter dans ma catégorie ces derniers mois.", "J'ai trouvé une alternative plus proche de chez moi."],
      detractor: ["Trop de lots où la réserve n'était jamais atteinte, j'ai fini par arrêter d'essayer.", "Le service client n'a jamais vraiment répondu à mes questions, ça n'a pas aidé.", "Les prix de réserve me semblaient toujours hors budget."]
    }
  };

  function seededRandom(seed) {
    var s = seed;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  function weightedPick(rng, weights) {
    var total = 0;
    for (var i = 0; i < weights.length; i++) total += weights[i][1];
    var r = rng() * total, acc = 0;
    for (var j = 0; j < weights.length; j++) { acc += weights[j][1]; if (r <= acc) return weights[j][0]; }
    return weights[weights.length - 1][0];
  }

  function pickMulti(rng, mainKey, mainBoost, pool, extraMin, extraMax) {
    var picks = [];
    if (mainKey && rng() < mainBoost) picks.push(mainKey);
    var n = extraMin + Math.floor(rng() * (extraMax - extraMin + 1));
    for (var k = 0; k < n; k++) picks.push(pool[Math.floor(rng() * pool.length)]);
    return Array.from(new Set(picks));
  }

  function npsFromCategory(rng, cat) {
    if (cat === "detractor") return Math.floor(rng() * 7);
    if (cat === "passive") return 7 + Math.floor(rng() * 2);
    return 9 + Math.floor(rng() * 2);
  }

  function scaleFromCategory(rng, cat, span) {
    var base = cat === "promoter" ? (span === 5 ? 4 : 6) : (cat === "passive" ? (span === 5 ? 3 : 4) : 2);
    return clamp(base + Math.round(rng() * 2) - 1, 1, span);
  }

  function pctBucket(rng, isChurn) {
    var r = rng();
    if (isChurn) { if (r < 0.55) return "detractor"; if (r < 0.75) return "passive"; return "promoter"; }
    if (r < 0.32) return "detractor"; if (r < 0.55) return "passive"; return "promoter";
  }

  function baseMeta(rng, type, audience, now) {
    return {
      timestamp: new Date(now - Math.floor(rng() * 28) * 86400000 - Math.floor(rng() * 86400000)).toISOString(),
      lang: rng() < 0.7 ? "fr" : "nl",
      source: "mailchimp_" + type + (audience === "churn" ? "_relance" : ""),
      user_agent: rng() < 0.4 ? "Mobile" : "Desktop",
      survey_type: type,
      audience: audience
    };
  }

  function generateAcheteursRows(audience, count, now) {
    var rng = seededRandom(audience === "churn" ? 7331 : 4242);
    var rows = [];
    var segs = audience === "churn" ? ["regulier", "occasionnel", "une_fois"] : ["regulier", "occasionnel"];
    var pool = VERBATIMS_MOCK["acheteurs-" + audience];

    for (var i = 0; i < count; i++) {
      var cat = pctBucket(rng, audience === "churn");
      var nps = npsFromCategory(rng, cat);
      var freqW = cat === "promoter" ? [["jamais", 50], ["une_deux_fois", 32], ["plusieurs_fois", 10], ["ne_sait_pas", 8]]
        : cat === "passive" ? [["jamais", 30], ["une_deux_fois", 35], ["plusieurs_fois", 25], ["ne_sait_pas", 10]]
        : [["jamais", 15], ["une_deux_fois", 28], ["plusieurs_fois", 47], ["ne_sait_pas", 10]];
      var freq = weightedPick(rng, freqW);

      var row = baseMeta(rng, "acheteurs", audience, now);
      row.segment = segs[Math.floor(rng() * segs.length)];
      row.nps = nps;
      row.freq_reserve_non_atteinte = freq;

      if (audience === "actif") {
        row.csat_confiance = scaleFromCategory(rng, cat, 5);
        row.csat_descriptions = scaleFromCategory(rng, cat, 5);
        row.ces_enlevement = scaleFromCategory(rng, cat, 7);
        var freinsPool = Object.keys(FREINS_LABELS).filter(function (k) { return k !== "prix_reserve_eleve"; });
        var reserveBoost = freq === "plusieurs_fois" ? 0.68 : (freq === "une_deux_fois" ? 0.32 : 0.12);
        var freins = pickMulti(rng, "prix_reserve_eleve", reserveBoost, freinsPool, 1, 2);
        row.freins = freins.join(", ");
        row.freins_order = shuffleWithRng(Object.keys(FREINS_LABELS).slice(), rng).join(", ");
      } else {
        var interactionsBoost = cat === "detractor" ? 0.3 : 0.1;
        var raisonPool = Object.keys(RAISONS_ACHETEUR_LABELS).filter(function (k) { return k !== "reserve_non_atteinte" && k !== "qualite_interactions"; });
        var raisons = [];
        if (rng() < (freq === "plusieurs_fois" ? 0.55 : 0.18)) raisons.push("reserve_non_atteinte");
        if (rng() < interactionsBoost) raisons.push("qualite_interactions");
        var extraN = 1 + Math.floor(rng() * 2);
        for (var r2 = 0; r2 < extraN; r2++) raisons.push(raisonPool[Math.floor(rng() * raisonPool.length)]);
        row.raisons_arret = Array.from(new Set(raisons)).join(", ");
        row.raisons_arret_order = shuffleWithRng(Object.keys(RAISONS_ACHETEUR_LABELS).slice(), rng).join(", ");

        var levBoost = freq === "plusieurs_fois" ? 0.6 : 0.25;
        var levPool = Object.keys(LEVIERS_ACHETEUR_LABELS).filter(function (k) { return k !== "reserve_realiste"; });
        row.leviers_retour = pickMulti(rng, "reserve_realiste", levBoost, levPool, 1, 2).join(", ");
        row.leviers_retour_order = shuffleWithRng(Object.keys(LEVIERS_ACHETEUR_LABELS).slice(), rng).join(", ");
      }

      var pickCat = pool[cat] || pool.passive;
      row.verbatim = rng() < 0.45 ? pickCat[Math.floor(rng() * pickCat.length)] : "";
      rows.push(row);
    }
    return rows;
  }

  function generateVendeursRows(audience, count, now) {
    var rng = seededRandom(audience === "churn" ? 9001 : 1917);
    var rows = [];
    var segs = audience === "churn" ? ["plusieurs", "occasionnelle", "une_seule"] : ["actif", "occasionnel"];
    var pool = VERBATIMS_MOCK["vendeurs-" + audience];

    for (var i = 0; i < count; i++) {
      var aMisReserve = weightedPick(rng, [["oui", 76], ["non", 24]]);
      var origine = "", freq = "";
      if (aMisReserve === "oui") {
        origine = weightedPick(rng, [["vendeur", 44], ["recommandation", 38], ["ca_depend", 12], ["ne_sait_pas", 6]]);
        if (origine === "recommandation") freq = weightedPick(rng, [["souvent", 38], ["parfois", 35], ["jamais", 17], ["ne_sait_pas", 10]]);
        else if (origine === "vendeur") freq = weightedPick(rng, [["souvent", 14], ["parfois", 30], ["jamais", 46], ["ne_sait_pas", 10]]);
        else freq = weightedPick(rng, [["souvent", 20], ["parfois", 30], ["jamais", 35], ["ne_sait_pas", 15]]);
      }

      var catW = freq === "souvent" ? [["detractor", 60], ["passive", 25], ["promoter", 15]]
        : freq === "parfois" ? [["detractor", 35], ["passive", 35], ["promoter", 30]]
        : freq === "jamais" ? [["detractor", 15], ["passive", 25], ["promoter", 60]]
        : [["detractor", 30], ["passive", 40], ["promoter", 30]];
      var cat = weightedPick(rng, catW);
      var nps = npsFromCategory(rng, cat);

      var row = baseMeta(rng, "vendeurs", audience, now);
      row.segment = segs[Math.floor(rng() * segs.length)];
      row.nps = nps;
      row.a_mis_reserve = aMisReserve;
      row.origine_prix_reserve = origine;
      row.freq_reserve_non_atteinte = freq;

      if (audience === "actif") {
        row.csat_prix = scaleFromCategory(rng, cat, 5);
        row.ces_facilite = scaleFromCategory(rng, cat, 7);
        var intentW = cat === "promoter" ? [["certainement", 55], ["probablement", 35], ["ne_sait_pas", 7], ["probablement_pas", 2], ["non", 1]]
          : cat === "passive" ? [["certainement", 10], ["probablement", 30], ["ne_sait_pas", 40], ["probablement_pas", 15], ["non", 5]]
          : [["certainement", 3], ["probablement", 7], ["ne_sait_pas", 20], ["probablement_pas", 35], ["non", 35]];
        row.intention_retour = weightedPick(rng, intentW);
      } else {
        var interactionsBoost = cat === "detractor" ? 0.28 : 0.1;
        var raisonPool = Object.keys(RAISONS_VENDEUR_LABELS).filter(function (k) { return k !== "reserve_non_atteinte" && k !== "qualite_interactions"; });
        var raisons = [];
        if (rng() < (freq === "souvent" ? 0.5 : 0.14)) raisons.push("reserve_non_atteinte");
        if (rng() < interactionsBoost) raisons.push("qualite_interactions");
        var extraN2 = 1 + Math.floor(rng() * 2);
        for (var r3 = 0; r3 < extraN2; r3++) raisons.push(raisonPool[Math.floor(rng() * raisonPool.length)]);
        row.raisons_arret = Array.from(new Set(raisons)).join(", ");
        row.raisons_arret_order = shuffleWithRng(Object.keys(RAISONS_VENDEUR_LABELS).slice(), rng).join(", ");

        var levBoost2 = freq === "souvent" ? 0.55 : 0.22;
        var levPool2 = Object.keys(LEVIERS_VENDEUR_LABELS).filter(function (k) { return k !== "reserve_realiste"; });
        row.leviers_retour = pickMulti(rng, "reserve_realiste", levBoost2, levPool2, 1, 2).join(", ");
        row.leviers_retour_order = shuffleWithRng(Object.keys(LEVIERS_VENDEUR_LABELS).slice(), rng).join(", ");
      }

      var pickCat = pool[cat] || pool.passive;
      row.verbatim = rng() < 0.45 ? pickCat[Math.floor(rng() * pickCat.length)] : "";
      rows.push(row);
    }
    return rows;
  }

  function generateMockData(type) {
    var now = 1751500000000; // fixed reference timestamp, keeps demo data stable across reloads
    var rows = type === "vendeurs"
      ? generateVendeursRows("actif", 95, now).concat(generateVendeursRows("churn", 45, now))
      : generateAcheteursRows("actif", 95, now).concat(generateAcheteursRows("churn", 45, now));
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
    var vals = rows
      .map(function (r) { return r[field]; })
      .filter(function (v) { return v !== undefined && v !== null && v !== ""; })
      .map(Number)
      .filter(function (v) { return !isNaN(v); });
    if (!vals.length) return 0;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }

  // Multi-select fields (freins, raisons_arret, leviers_retour) are stored
  // as a comma-joined string in the sheet — split before tallying/reading.
  function splitMulti(val) {
    return (val || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function tally(rows, field, isMulti) {
    var t = {};
    rows.forEach(function (r) {
      var v = r[field];
      if (v === undefined || v === "" || v === null) return;
      var vals = isMulti ? splitMulti(v) : [v];
      vals.forEach(function (x) { t[x] = (t[x] || 0) + 1; });
    });
    return t;
  }

  function topKeyOf(t) {
    var keys = Object.keys(t);
    if (!keys.length) return null;
    keys.sort(function (a, b) { return t[b] - t[a]; });
    return keys[0];
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

  function filterByAudience(rows, audience) {
    return rows.filter(function (r) { return r.audience === audience; });
  }

  // Vendeurs only: origine/fréquence de réserve ne concernent que ceux qui
  // ont effectivement mis un prix de réserve (a_mis_reserve === "oui").
  function reserveSubset(rows, type) {
    if (type !== "vendeurs") return rows;
    return rows.filter(function (r) { return r.a_mis_reserve === "oui"; });
  }

  /* ------------------------------------------------------------------
     Bloc 0 — Synthèse comparative (les 4 segments, indépendante du filtre)
  ------------------------------------------------------------------ */
  var VARIANT_ORDER = [
    { type: "acheteurs", audience: "actif", label: "Acheteurs", aud: "Actifs" },
    { type: "acheteurs", audience: "churn", label: "Acheteurs", aud: "Churn" },
    { type: "vendeurs", audience: "actif", label: "Vendeurs", aud: "Actifs" },
    { type: "vendeurs", audience: "churn", label: "Vendeurs", aud: "Churn" }
  ];

  function computeSummaryRow(type, audience) {
    var rows = filterByAudience(state.data[type], audience);
    var isVendeur = type === "vendeurs";
    var isChurn = audience === "churn";
    var nps = computeNps(rows);
    var reserveRows = reserveSubset(rows, type);
    var freqHighKey = isVendeur ? "souvent" : "plusieurs_fois";
    var freqTally = tally(reserveRows, "freq_reserve_non_atteinte", false);
    var freqPct = reserveRows.length ? Math.round(((freqTally[freqHighKey] || 0) / reserveRows.length) * 100) : 0;

    var topLabel = "—", topPct = 0;
    if (!isChurn && !isVendeur) {
      var t1 = tally(rows, "freins", true), k1 = topKeyOf(t1);
      topLabel = FREINS_LABELS[k1] || "—"; topPct = k1 && rows.length ? Math.round((t1[k1] / rows.length) * 100) : 0;
    } else if (!isChurn && isVendeur) {
      var t2 = tally(reserveRows, "origine_prix_reserve", false), k2 = topKeyOf(t2);
      topLabel = ORIGINE_LABELS[k2] || "—"; topPct = k2 && reserveRows.length ? Math.round((t2[k2] / reserveRows.length) * 100) : 0;
    } else if (isChurn && !isVendeur) {
      var t3 = tally(rows, "raisons_arret", true), k3 = topKeyOf(t3);
      topLabel = RAISONS_ACHETEUR_LABELS[k3] || "—"; topPct = k3 && rows.length ? Math.round((t3[k3] / rows.length) * 100) : 0;
    } else {
      var t4 = tally(rows, "raisons_arret", true), k4 = topKeyOf(t4);
      topLabel = RAISONS_VENDEUR_LABELS[k4] || "—"; topPct = k4 && rows.length ? Math.round((t4[k4] / rows.length) * 100) : 0;
    }
    return { n: rows.length, nps: nps.score, freqPct: freqPct, topLabel: topLabel, topPct: topPct };
  }

  function renderSynthese() {
    var body = document.getElementById("synth-body");
    if (!body) return;
    body.innerHTML = VARIANT_ORDER.map(function (v) {
      var s = computeSummaryRow(v.type, v.audience);
      var npsColor = thermoColor(s.nps, -100, 100);
      var freqColor = thermoColorInverse(s.freqPct / 100);
      var isCurrent = v.type === state.type && v.audience === state.audience;
      return '<tr class="' + (isCurrent ? "current" : "") + '" data-type="' + v.type + '" data-audience="' + v.audience + '">' +
        '<td><span class="synth-variant">' + v.label + '<span class="aud">' + v.aud + '</span></span></td>' +
        '<td class="synth-num">' + s.n + '</td>' +
        '<td><span class="synth-pill" style="background:' + npsColor + '1A; color:' + npsColor + ';">' + (s.nps > 0 ? "+" : "") + s.nps + '</span></td>' +
        '<td><span class="synth-pill" style="background:' + freqColor + '1A; color:' + freqColor + ';">' + s.freqPct + ' %</span></td>' +
        '<td style="font-size:0.85rem; color:var(--au-ink2);">' + escapeHtml(s.topLabel) + ' <span style="color:var(--au-ink3);">(' + s.topPct + ' %)</span></td>' +
        "</tr>";
    }).join("");
    body.querySelectorAll("tr").forEach(function (tr) {
      tr.addEventListener("click", function () {
        state.type = tr.dataset.type;
        state.audience = tr.dataset.audience;
        document.querySelectorAll("#type-switch button").forEach(function (b) { b.classList.toggle("active", b.dataset.type === state.type); });
        document.querySelectorAll("#audience-switch button").forEach(function (b) { b.classList.toggle("active", b.dataset.audience === state.audience); });
        state.page = 1;
        renderAll();
      });
    });
  }

  /* ------------------------------------------------------------------
     Render orchestration
  ------------------------------------------------------------------ */
  function renderAll() {
    var type = state.type;
    var audience = state.audience;
    var isVendeur = type === "vendeurs";
    var isChurn = audience === "churn";
    var rows = filterByAudience(state.data[type], audience);
    var reserveRows = reserveSubset(rows, type);

    document.getElementById("header-type-label").textContent =
      (isVendeur ? "Vendeurs" : "Acheteurs") + " · " + (isChurn ? "Churn" : "Actifs");
    document.getElementById("mock-banner").style.display = state.isMock[type] ? "block" : "none";

    var lastDate = rows.length ? new Date(Math.max.apply(null, rows.map(function (r) { return new Date(r.timestamp).getTime(); }))) : null;
    document.getElementById("header-meta").textContent = rows.length
      ? rows.length + " réponses · dernière réponse le " + formatDate(lastDate)
      : "Aucune réponse pour le moment";

    renderSynthese();
    renderKpis(rows, reserveRows, type, isChurn);
    renderReserve(rows, reserveRows, type, isVendeur);
    renderChoicesSection(rows, type, isChurn, isVendeur);
    safeRender(renderNpsDistribution, rows);
    safeRender(renderSegments, rows, type, audience);

    var csatSection = document.getElementById("section-csat");
    if (isChurn) {
      csatSection.style.display = "none";
    } else {
      csatSection.style.display = "block";
      safeRender(renderCsatCharts, rows, type);
    }

    renderVerbatims(rows, type, audience);
    state.page = 1;
    renderRawTable(rows, type);
  }

  // Charts are a CDN-loaded enhancement — a slow/blocked CDN must never
  // prevent the KPI, verbatim, or raw-data blocks (which don't need Chart.js)
  // from rendering.
  function safeRender(fn) {
    if (typeof Chart === "undefined") {
      console.error("[dashboard] Chart.js failed to load — charts skipped, other blocks still render.");
      return;
    }
    var args = Array.prototype.slice.call(arguments, 1);
    try {
      fn.apply(null, args);
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
  function renderKpis(rows, reserveRows, type, isChurn) {
    var grid = document.getElementById("kpi-grid");
    grid.innerHTML = "";
    grid.className = "dash-kpi-grid";

    var nps = computeNps(rows);
    var split = splitByRecency(rows);
    var npsDelta = split ? nps.score - computeNps(split.prior).score : null;

    grid.appendChild(kpiCard({
      label: "NPS",
      value: rows.length ? nps.score : "—",
      sub: rows.length ? nps.promoters + " promoteurs · " + nps.passives + " passifs · " + nps.detractors + " détracteurs" : "Pas assez de données",
      delta: npsDelta,
      thermo: { pct: (nps.score + 100) / 2, color: thermoColor(nps.score, -100, 100) }
    }));

    if (!isChurn) {
      var csatField = CSAT_QUESTIONS[type][0].field;
      var csatAvg = average(rows, csatField);
      var csatDelta = split ? average(split.recent, csatField) - average(split.prior, csatField) : null;
      grid.appendChild(kpiCard({
        label: "CSAT — " + CSAT_QUESTIONS[type][0].label,
        value: rows.length ? csatAvg.toFixed(1) + " / 5" : "—",
        sub: "Moyenne sur " + rows.length + " réponses",
        delta: csatDelta,
        thermo: { pct: (csatAvg / 5) * 100, color: thermoColor(csatAvg, 1, 5) }
      }));
    } else {
      var raisonLabels = type === "vendeurs" ? RAISONS_VENDEUR_LABELS : RAISONS_ACHETEUR_LABELS;
      var raisonTally = tally(rows, "raisons_arret", true);
      var topKey = topKeyOf(raisonTally);
      var topPct = topKey && rows.length ? Math.round((raisonTally[topKey] / rows.length) * 100) : 0;
      grid.appendChild(kpiCard({
        label: "Raison la plus citée",
        value: topPct + " %",
        sub: raisonLabels[topKey] || "—",
        delta: null,
        thermo: { pct: topPct, color: thermoColorInverse(topPct / 100) }
      }));
    }

    var freqHighKey = type === "vendeurs" ? "souvent" : "plusieurs_fois";
    var freqTally = tally(reserveRows, "freq_reserve_non_atteinte", false);
    var freqBase = reserveRows.length || 1;
    var freqPct = Math.round(((freqTally[freqHighKey] || 0) / freqBase) * 100);
    var freqSplit = splitByRecency(reserveRows);
    var freqDelta = null;
    if (freqSplit) {
      var recentPct = Math.round(((tally(freqSplit.recent, "freq_reserve_non_atteinte", false)[freqHighKey] || 0) / freqSplit.recent.length) * 100);
      var priorPct = Math.round(((tally(freqSplit.prior, "freq_reserve_non_atteinte", false)[freqHighKey] || 0) / freqSplit.prior.length) * 100);
      freqDelta = recentPct - priorPct;
    }
    grid.appendChild(kpiCard({
      label: "Réserve non atteinte — " + (type === "vendeurs" ? "souvent" : "plusieurs fois"),
      value: freqPct + " %",
      sub: type === "vendeurs" ? "Part des vendeurs ayant mis une réserve" : "Part des répondants concernés",
      delta: freqDelta,
      deltaInverse: true,
      thermo: { pct: freqPct, color: thermoColorInverse(freqPct / 100) }
    }));
  }

  function thermoColor(val, min, max) {
    var pct = (val - min) / (max - min);
    if (pct < 0.4) return RED;
    if (pct < 0.7) return GOLD;
    return GREEN;
  }

  // Inverted semantics for "bad rate" metrics (reserve failure %, top
  // churn reason %) where a HIGHER value is worse, not better.
  function thermoColorInverse(pct) {
    if (pct > 0.35) return RED;
    if (pct > 0.2) return GOLD;
    return GREEN;
  }

  function kpiCard(opts) {
    var card = document.createElement("div");
    card.className = "dash-kpi-card";
    var deltaHtml = "";
    if (opts.delta !== null && opts.delta !== undefined && !isNaN(opts.delta)) {
      var positive = opts.deltaInverse ? opts.delta < 0 : opts.delta > 0;
      var flat = Math.abs(opts.delta) < 0.5;
      var arrow = flat ? "→" : (positive ? "↑" : "↓");
      var cls = flat ? "" : (positive ? "up" : "down");
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
     Bloc 2 — Prix de réserve (hand-rolled bars, not Chart.js — needs
     per-bar severity color and a side-by-side origine × fréquence
     comparison that a generic dataset can't express cleanly).
  ------------------------------------------------------------------ */
  function barRow(label, count, max, color) {
    var pct = max > 0 ? (count / max) * 100 : 0;
    return '<div class="bar-row"><div class="bl">' + escapeHtml(label) + '</div><div class="bt"><div class="fill" style="width:' + pct + '%; background:' + color + ';"></div></div><div class="bc">' + count + "</div></div>";
  }

  function renderReserve(rows, reserveRows, type, isVendeur) {
    var freqLabels = isVendeur ? FREQ_VENDEUR_LABELS : FREQ_ACHETEUR_LABELS;
    var freqKeys = isVendeur ? ["jamais", "parfois", "souvent", "ne_sait_pas"] : ["jamais", "une_deux_fois", "plusieurs_fois", "ne_sait_pas"];

    document.getElementById("reserve-sub").textContent = isVendeur
      ? "Fréquence déclarée à laquelle le prix de réserve fixé n'a pas été atteint sur les derniers lots — uniquement parmi ceux qui ont mis une réserve."
      : "Fréquence déclarée d'enchères placées sur un lot finalement retiré, faute d'avoir atteint la réserve.";

    var freqTally = tally(reserveRows, "freq_reserve_non_atteinte", false);
    var freqMax = Math.max.apply(null, freqKeys.map(function (k) { return freqTally[k] || 0; }).concat([1]));
    document.getElementById("reserve-dist").innerHTML = freqKeys.map(function (k) {
      var c = freqTally[k] || 0;
      var color = (k === "plusieurs_fois" || k === "souvent") ? RED : (k === "une_deux_fois" || k === "parfois") ? GOLD : (k === "jamais" ? GREEN : INK3);
      return barRow(freqLabels[k], c, freqMax, color);
    }).join("");

    document.getElementById("reserve-note").textContent = isVendeur
      ? Math.round((reserveRows.length / (rows.length || 1)) * 100) + " % des répondants (" + reserveRows.length + "/" + rows.length + ") ont mis un prix de réserve — le croisement ci-dessous ne porte que sur eux."
      : "";

    var crossCard = document.getElementById("reserve-cross-card");
    if (isVendeur) {
      crossCard.style.display = "block";
      var origVendeur = reserveRows.filter(function (r) { return r.origine_prix_reserve === "vendeur"; });
      var origReco = reserveRows.filter(function (r) { return r.origine_prix_reserve === "recommandation"; });
      var pctVendeur = origVendeur.length ? Math.round((origVendeur.filter(function (r) { return r.freq_reserve_non_atteinte === "souvent"; }).length / origVendeur.length) * 100) : 0;
      var pctReco = origReco.length ? Math.round((origReco.filter(function (r) { return r.freq_reserve_non_atteinte === "souvent"; }).length / origReco.length) * 100) : 0;
      var crossMax = Math.max(pctVendeur, pctReco, 10);
      document.getElementById("reserve-cross").innerHTML =
        '<div class="cross-item"><div class="cross-label"><strong>Fixé par le vendeur lui-même</strong><span>' + origVendeur.length + ' réponses</span></div><div class="cross-bar"><div class="fill" style="width:' + (pctVendeur / crossMax * 100) + "%; background:" + GREEN + ';">' + pctVendeur + '%</div></div></div>' +
        '<div class="cross-item"><div class="cross-label"><strong>Recommandé par Auctelia</strong><span>' + origReco.length + ' réponses</span></div><div class="cross-bar"><div class="fill" style="width:' + (pctReco / crossMax * 100) + "%; background:" + RED + ';">' + pctReco + "%</div></div></div>";

      var insight = document.getElementById("reserve-insight");
      if (origVendeur.length >= 5 && origReco.length >= 5) {
        var delta = pctReco - pctVendeur;
        insight.style.display = "flex";
        document.getElementById("reserve-insight-text").innerHTML =
          "Écart de <strong>" + Math.abs(delta) + " points</strong> entre une réserve recommandée par Auctelia et une réserve fixée par le vendeur lui-même — la réserve recommandée rate " +
          (delta > 0 ? "plus souvent" : "moins souvent") + ".";
      } else {
        insight.style.display = "none";
      }
    } else {
      crossCard.style.display = "none";
    }
  }

  /* ------------------------------------------------------------------
     Bloc 3 — Freins / raisons / leviers (choix multiple + corrélation)
  ------------------------------------------------------------------ */
  function getChoicesConfig(type, isChurn) {
    if (type === "acheteurs" && !isChurn) {
      return { title: "Freins à enchérir davantage", sub: "", field: "freins", isMulti: true, labelsMap: FREINS_LABELS, highlight: ["prix_reserve_eleve"], correlate: true, secondary: null };
    }
    if (type === "acheteurs" && isChurn) {
      return {
        title: "Raisons de l'arrêt", sub: "Sélection multiple — un répondant peut citer plusieurs raisons à la fois.",
        field: "raisons_arret", isMulti: true, labelsMap: RAISONS_ACHETEUR_LABELS, highlight: ["reserve_non_atteinte", "qualite_interactions"], correlate: true,
        secondary: { title: "Ce qui ferait reconsidérer Auctelia", field: "leviers_retour", isMulti: true, labelsMap: LEVIERS_ACHETEUR_LABELS }
      };
    }
    if (type === "vendeurs" && !isChurn) {
      return { title: "Intention de revente", sub: "", field: "intention_retour", isMulti: false, labelsMap: INTENTION_LABELS, highlight: [], correlate: false, secondary: null };
    }
    return {
      title: "Raisons de l'arrêt", sub: "Sélection multiple — un répondant peut citer plusieurs raisons à la fois.",
      field: "raisons_arret", isMulti: true, labelsMap: RAISONS_VENDEUR_LABELS, highlight: ["reserve_non_atteinte", "qualite_interactions"], correlate: true,
      secondary: { title: "Ce qui ferait remettre du matériel industriel en vente", field: "leviers_retour", isMulti: true, labelsMap: LEVIERS_VENDEUR_LABELS }
    };
  }

  function renderChoicesSection(rows, type, isChurn, isVendeur) {
    var cfg = getChoicesConfig(type, isChurn);
    document.getElementById("choices-title").textContent = cfg.title;
    document.getElementById("choices-sub").textContent = cfg.sub;

    safeRender(renderChoicesChart, rows, cfg);

    var corrCard = document.getElementById("choices-correlation").parentElement;
    var insight = document.getElementById("choices-insight");
    if (cfg.correlate) {
      corrCard.style.display = "block";
      renderChoicesNpsCorrelation(rows, cfg);
      showCorrInsight(rows, cfg, insight);
    } else {
      corrCard.style.display = "none";
      insight.style.display = "none";
    }

    var block2 = document.getElementById("choices-block-2");
    if (cfg.secondary) {
      block2.style.display = "block";
      document.getElementById("choices-title-2").textContent = cfg.secondary.title;
      safeRender(renderChoicesChart2, rows, cfg.secondary);
    } else {
      block2.style.display = "none";
    }
  }

  function renderChoicesChart(rows, cfg) {
    var t = tally(rows, cfg.field, cfg.isMulti);
    var entries = Object.keys(t).map(function (k) { return { key: k, label: cfg.labelsMap[k] || k, count: t[k] }; });
    entries.sort(function (a, b) { return b.count - a.count; });

    destroyChart("choices");
    state.charts["choices"] = new Chart(document.getElementById("chart-choices"), {
      type: "bar",
      data: {
        labels: entries.map(function (e) { return e.label; }),
        datasets: [{
          data: entries.map(function (e) { return e.count; }),
          backgroundColor: entries.map(function (e) { return cfg.highlight.indexOf(e.key) !== -1 ? GOLD : DARK; }),
          borderRadius: 4, maxBarThickness: 28
        }]
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

  function renderChoicesChart2(rows, cfg2) {
    var t = tally(rows, cfg2.field, cfg2.isMulti);
    var entries = Object.keys(t).map(function (k) { return { key: k, label: cfg2.labelsMap[k] || k, count: t[k] }; });
    entries.sort(function (a, b) { return b.count - a.count; });

    destroyChart("choices-2");
    state.charts["choices-2"] = new Chart(document.getElementById("chart-choices-2"), {
      type: "bar",
      data: {
        labels: entries.map(function (e) { return e.label; }),
        datasets: [{ data: entries.map(function (e) { return e.count; }), backgroundColor: GOLD, borderRadius: 4, maxBarThickness: 26 }]
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

  // Objectifies how much each cited item actually correlates with loyalty,
  // computed after the fact from independent answers (NPS vs. checkbox)
  // rather than asked directly — avoids leading respondents toward a
  // causal link the questions never suggested.
  function renderChoicesNpsCorrelation(rows, cfg) {
    var wrap = document.getElementById("choices-correlation");
    if (!wrap) return;

    var overallAvg = average(rows, "nps");
    var byKey = {};
    rows.forEach(function (r) {
      var v = r[cfg.field];
      if (v === undefined || v === "" || v === null) return;
      var vals = cfg.isMulti ? splitMulti(v) : [v];
      vals.forEach(function (k) { if (!byKey[k]) byKey[k] = []; byKey[k].push(r.nps); });
    });

    var entries = Object.keys(byKey)
      .filter(function (k) { return byKey[k].length >= 5; })
      .map(function (k) {
        var vals = byKey[k];
        var avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
        return { label: cfg.labelsMap[k] || k, count: vals.length, avg: avg, delta: avg - overallAvg };
      });

    entries.sort(function (a, b) { return a.delta - b.delta; });

    if (!entries.length) {
      wrap.innerHTML = '<p style="color:var(--au-ink3); font-size:0.85rem;">Pas encore assez de réponses par item pour calculer une corrélation fiable (minimum 5 par item).</p>';
      return;
    }

    wrap.innerHTML =
      '<div style="font-size:0.8rem; color:var(--au-ink3); margin-bottom:10px;">NPS moyen des répondants ayant cité chaque item, comparé au NPS moyen global (' + overallAvg.toFixed(1) + ') — calculé après coup, pas suggéré par la question.</div>' +
      entries.map(function (e) {
        var color = e.delta <= -8 ? RED : (e.delta >= 8 ? GREEN : INK3);
        var sign = e.delta > 0 ? "+" : "";
        return '<div class="corr-row"><span class="lbl">' + escapeHtml(e.label) + ' <span class="cnt">(' + e.count + ')</span></span><span class="val" style="color:' + color + ';">' + e.avg.toFixed(1) + ' <span class="d">(' + sign + e.delta.toFixed(1) + ')</span></span></div>';
      }).join("");
  }

  function showCorrInsight(rows, cfg, box) {
    var overallAvg = average(rows, "nps");
    var byKey = {};
    rows.forEach(function (r) {
      var v = r[cfg.field];
      if (v === undefined || v === "" || v === null) return;
      var vals = cfg.isMulti ? splitMulti(v) : [v];
      vals.forEach(function (k) { if (!byKey[k]) byKey[k] = []; byKey[k].push(r.nps); });
    });
    var entries = Object.keys(byKey).filter(function (k) { return byKey[k].length >= 5; }).map(function (k) {
      var vals = byKey[k];
      var avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      return { label: cfg.labelsMap[k] || k, count: vals.length, delta: avg - overallAvg };
    });
    entries.sort(function (a, b) { return a.delta - b.delta; });
    var worst = entries[0];
    if (!worst || worst.delta > -6) { box.style.display = "none"; return; }
    box.style.display = "flex";
    document.getElementById("choices-insight-text").innerHTML =
      "Les répondants citant « <strong>" + escapeHtml(worst.label) + "</strong> » ont un NPS moyen " + Math.abs(worst.delta).toFixed(1) + " points sous la moyenne (n=" + worst.count + ") — le signal le plus net de ce groupe.";
  }

  /* ------------------------------------------------------------------
     Bloc 4 — NPS distribution
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
      data: { labels: labels, datasets: [{ data: counts, backgroundColor: colors, borderRadius: 4, maxBarThickness: 34 }] },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { var pct = ((ctx.raw / total) * 100).toFixed(0); return ctx.raw + " réponses (" + pct + "%)"; } } }
        },
        scales: { x: { grid: { display: false }, ticks: { precision: 0 } }, y: { grid: { display: false }, reverse: true } }
      }
    });
  }

  /* ------------------------------------------------------------------
     Bloc 5 — Segments donut
  ------------------------------------------------------------------ */
  function renderSegments(rows, type, audience) {
    var labelsMap = SEGMENT_LABELS[type][audience];
    var keys = Object.keys(labelsMap);
    var counts = keys.map(function (k) { return rows.filter(function (r) { return r.segment === k; }).length; });

    destroyChart("segments");
    state.charts["segments"] = new Chart(document.getElementById("chart-segments"), {
      type: "doughnut",
      data: { labels: keys.map(function (k) { return labelsMap[k]; }), datasets: [{ data: counts, backgroundColor: [GOLD, DARK, INK3], borderWidth: 2, borderColor: "#fff" }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 16 } } } }
    });
  }

  /* ------------------------------------------------------------------
     Bloc 6 — CSAT detail charts (actifs uniquement — pas posé aux churn)
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

      var scale = q.scale === 7 ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5];
      var counts = scale.map(function (v) { return rows.filter(function (r) { return r[q.field] === v; }).length; });

      destroyChart("csat-" + idx);
      state.charts["csat-" + idx] = new Chart(document.getElementById(canvasId), {
        type: "bar",
        data: { labels: scale.map(String), datasets: [{ data: counts, backgroundColor: GOLD, borderRadius: 4, maxBarThickness: 44 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }
      });
    });
  }

  /* ------------------------------------------------------------------
     Bloc 7 — Verbatims
  ------------------------------------------------------------------ */
  function renderVerbatims(rows, type, audience) {
    var list = document.getElementById("verbatim-list");
    list.innerHTML = "";

    var withText = rows.filter(function (r) { return r.verbatim && String(r.verbatim).trim() !== ""; });
    withText.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
    var top20 = withText.slice(0, 20);

    if (!top20.length) {
      list.innerHTML = '<p style="color:var(--au-ink3); font-size:0.9rem;">Aucun verbatim pour le moment.</p>';
      return;
    }

    var labelsMap = SEGMENT_LABELS[type][audience];
    top20.forEach(function (r) {
      var category = r.nps <= 6 ? "detractor" : (r.nps <= 8 ? "passive" : "promoter");
      var div = document.createElement("div");
      div.className = "dash-verbatim " + category;
      var segLabel = labelsMap[r.segment] || r.segment;
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
     Bloc 8 — raw data table
  ------------------------------------------------------------------ */
  var PAGE_SIZE = 20;

  function renderRawTable(rows, type) {
    var head = document.getElementById("raw-table-head");
    var isVendeur = type === "vendeurs";
    var freqLabelMap = isVendeur ? FREQ_VENDEUR_LABELS : FREQ_ACHETEUR_LABELS;
    var labelsMap = SEGMENT_LABELS[type][state.audience];

    var headCols = ["Date", "Langue", "Segment", "NPS"];
    if (isVendeur) headCols.push("Réserve mise ?");
    headCols.push("Réserve non atteinte", "Verbatim");
    head.innerHTML = headCols.map(function (h) { return "<th>" + h + "</th>"; }).join("");

    var sorted = rows.slice().sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
    var totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    state.page = clamp(state.page, 1, totalPages);
    var pageRows = sorted.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    var body = document.getElementById("raw-table-body");
    body.innerHTML = pageRows.map(function (r) {
      var verbatim = (r.verbatim || "").toString();
      if (verbatim.length > 60) verbatim = verbatim.slice(0, 60) + "…";
      var segLabel = labelsMap[r.segment] || r.segment;
      var reserveCell = isVendeur ? "<td>" + (r.a_mis_reserve === "oui" ? "Oui" : "Non") + "</td>" : "";
      return "<tr>" +
        "<td>" + formatDate(new Date(r.timestamp)) + "</td>" +
        "<td>" + (r.lang || "").toUpperCase() + "</td>" +
        "<td>" + escapeHtml(segLabel) + "</td>" +
        "<td>" + r.nps + "</td>" +
        reserveCell +
        "<td>" + escapeHtml(freqLabelMap[r.freq_reserve_non_atteinte] || "—") + "</td>" +
        "<td>" + escapeHtml(verbatim) + "</td>" +
        "</tr>";
    }).join("");

    document.getElementById("page-label").textContent = "Page " + state.page + " / " + totalPages;
    document.getElementById("page-prev").disabled = state.page <= 1;
    document.getElementById("page-next").disabled = state.page >= totalPages;
  }

  function changePage(delta) {
    state.page += delta;
    renderRawTable(filterByAudience(state.data[state.type], state.audience), state.type);
  }

  /* ------------------------------------------------------------------
     CSV export
  ------------------------------------------------------------------ */
  function exportCsv() {
    var type = state.type;
    var rows = filterByAudience(state.data[type], state.audience);
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
    a.download = "auctelia-enquete-" + type + "-" + state.audience + ".csv";
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

  // Auto-bypass the gate (no password required, or already authenticated
  // this session). Placed at the end of the file, after every var/function
  // declaration above has run — showDashboard() -> init() reaches into
  // things like VERBATIMS_MOCK that are only assigned once their own
  // top-level statement executes, and calling it any earlier would read
  // them while still undefined.
  if (!CONFIG.REQUIRE_PASSWORD || sessionStorage.getItem("au_dash_auth") === "1") {
    showDashboard();
  }
})();
