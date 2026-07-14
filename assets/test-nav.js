/* ==========================================================================
   Auctelia — Navigation du mode test (?test=1)
   Menu latéral gauche permettant aux validateurs de passer directement
   d'un questionnaire à l'autre et d'ouvrir le dashboard. Jamais affiché
   aux vrais répondants : il faut le paramètre ?test=1 explicite.
   ========================================================================== */
(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  if (params.get("test") !== "1") return;

  var keep = new URLSearchParams();
  keep.set("test", "1");
  if (params.get("lang")) keep.set("lang", params.get("lang"));
  var qs = "?" + keep.toString();

  var ITEMS = [
    { path: "index.html", label: "Accueil" },
    { path: "vendeurs.html", label: "Vendeurs" },
    { path: "acheteurs.html", label: "Acheteurs" },
    { path: "vendeurs-churn.html", label: "Vendeurs — relance" },
    { path: "acheteurs-churn.html", label: "Acheteurs — relance" },
    { path: "dashboard.html", label: "Dashboard" }
  ];

  // Current page, robust to Vercel clean URLs ("/vendeurs" ↔ "vendeurs.html")
  var current = window.location.pathname.split("/").pop() || "index.html";
  if (current.indexOf(".") === -1) current += ".html";

  var nav = document.createElement("nav");
  nav.className = "au-test-nav";
  nav.setAttribute("aria-label", "Navigation mode test");

  var title = document.createElement("div");
  title.className = "au-test-nav-title";
  title.textContent = "🧪 Mode test";
  nav.appendChild(title);

  ITEMS.forEach(function (item) {
    var a = document.createElement("a");
    a.href = item.path + qs;
    a.textContent = item.label;
    if (item.path === current) a.className = "active";
    nav.appendChild(a);
  });

  document.body.insertBefore(nav, document.body.firstChild);
})();
