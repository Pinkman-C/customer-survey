# Auctelia — Plateforme d'enquêtes de satisfaction

Outil interne Clictelia SA (Estela Group) pour les enquêtes de satisfaction vendeurs et acheteurs Auctelia, dans le cadre du relaunch de marque de septembre 2026.

- 4 formulaires publics bilingues FR/NL (vendeurs, acheteurs, et leurs variantes « churn » pour les utilisateurs inactifs depuis plus de 12 mois), envoyés via Mailchimp
- 1 dashboard interne protégé par mot de passe pour la direction
- 1 fonction serverless qui relaie les réponses vers n8n → Google Sheets

Stack : HTML/CSS/JS vanilla + Chart.js (CDN) + Vercel serverless. Aucun framework, aucune étape de build.

Contexte produit : ces enquêtes visent à trancher une hypothèse précise — la hausse des
lots avec prix de réserve frustre les acheteurs (enchère perdue) et alimente une spirale de
désengagement acheteurs ↔ vendeurs. Voir `docs/2026-07-09-refonte-enquetes-design.md` pour
le raisonnement complet et les choix méthodologiques.

---

## 1. Structure du projet

```
/
├── index.html              → Redirige vers /vendeurs ou /acheteurs selon ?type=
├── vendeurs.html           → Formulaire enquête vendeurs actifs (FR/NL)
├── vendeurs-churn.html     → Formulaire enquête vendeurs churn (FR/NL)
├── acheteurs.html          → Formulaire enquête acheteurs actifs (FR/NL)
├── acheteurs-churn.html    → Formulaire enquête acheteurs churn (FR/NL)
├── merci.html              → Page de confirmation post-soumission
├── dashboard.html          → Dashboard résultats (protégé mot de passe)
├── styles/
│   └── main.css            → Design system partagé (formulaires + dashboard)
├── assets/
│   ├── survey-engine.js    → Logique du stepper, partagée par les 4 formulaires
│   └── dashboard.js        → Logique du dashboard (data, charts, export)
├── api/
│   └── submit.js           → Fonction serverless Vercel (POST → webhook n8n)
├── vercel.json              → Routes, rewrites, headers de cache
└── package.json
```

---

## 2. Déploiement pas-à-pas (pour David)

### 2.1. Déployer sur Vercel

1. Connecte-toi sur [vercel.com](https://vercel.com) avec le compte Clictelia.
2. **Add New → Project**, importe le repo GitHub `Pinkman-C/customer-survey`.
3. Framework Preset : choisis **Other** (aucun build nécessaire, c'est du statique + une fonction serverless).
4. Build Command : laisse vide. Output Directory : laisse vide (racine).
5. Avant de cliquer sur "Deploy", configure les variables d'environnement (section 2.2 ci-dessous).
6. Clique sur **Deploy**. Le site est en ligne sur une URL `*.vercel.app` en ~1 minute.

### 2.2. Variables d'environnement Vercel

Dans **Project Settings → Environment Variables**, ajoute :

| Variable | Valeur | Environnements |
|---|---|---|
| `N8N_WEBHOOK_URL` | `https://[ton-instance-n8n]/webhook/auctelia-survey` | Production, Preview |

> Le mot de passe du dashboard n'est **pas** une variable d'environnement : il est directement dans le code (voir section 5), car c'est un usage interne occasionnel sans besoin d'authentification serveur.

Après avoir ajouté/modifié une variable d'environnement, il faut **redéployer** (Vercel ne relit pas les variables sur un déploiement déjà fait).

### 2.3. Domaine custom `survey.auctelia.be`

1. Dans **Project Settings → Domains**, ajoute `survey.auctelia.be`.
2. Vercel affiche un enregistrement CNAME à créer, du type :
   ```
   survey.auctelia.be   CNAME   cname.vercel-dns.com.
   ```
3. Ajoute ce CNAME dans la zone DNS d'`auctelia.be` (chez le registrar/hébergeur DNS actuel).
4. La propagation DNS prend de quelques minutes à quelques heures. Vercel émet automatiquement le certificat SSL une fois le CNAME détecté.

### 2.4. Liens à utiliser dans Mailchimp

**Base active** (ench./vente dans les 12 derniers mois) :

- Vendeurs (FR) : `https://survey.auctelia.be/vendeurs?utm_source=mailchimp_vendeurs`
- Vendeurs (NL) : `https://survey.auctelia.be/vendeurs?lang=nl&utm_source=mailchimp_vendeurs_nl`
- Acheteurs (FR) : `https://survey.auctelia.be/acheteurs?utm_source=mailchimp_acheteurs`
- Acheteurs (NL) : `https://survey.auctelia.be/acheteurs?lang=nl&utm_source=mailchimp_acheteurs_nl`

**Base churn** (déjà actif par le passé, silencieux depuis plus de 12 mois — exclure les
inscrits jamais activés de ce segment CRM, voir `docs/2026-07-09-refonte-enquetes-design.md`
section 2) — utiliser un objet d'email distinct de la campagne active :

- Vendeurs churn (FR) : `https://survey.auctelia.be/vendeurs-churn?utm_source=mailchimp_vendeurs_relance`
- Vendeurs churn (NL) : `https://survey.auctelia.be/vendeurs-churn?lang=nl&utm_source=mailchimp_vendeurs_relance_nl`
- Acheteurs churn (FR) : `https://survey.auctelia.be/acheteurs-churn?utm_source=mailchimp_acheteurs_relance`
- Acheteurs churn (NL) : `https://survey.auctelia.be/acheteurs-churn?lang=nl&utm_source=mailchimp_acheteurs_relance_nl`

Le paramètre `source`/`utm_source` est enregistré tel quel dans chaque réponse (colonne `source`), ce qui permet de distinguer les campagnes dans les résultats. L'audience (actif/churn) est elle enregistrée séparément dans la colonne `audience`, déduite automatiquement de la page visitée — pas besoin de l'encoder dans l'URL.

Le lien générique `https://survey.auctelia.be/?type=vendeurs` (ou `?type=acheteurs`) fonctionne aussi et redirige automatiquement, en conservant les autres paramètres (`lang`, `utm_source`). Il ne couvre que les variantes actives — utilise les URLs `-churn` directement pour la base churn.

---

## 3. Configuration n8n

### 3.1. Structure du workflow

```
[Webhook (POST)] → [Switch: survey_type] → [Google Sheets: Append row — Vendeurs]
                                          → [Google Sheets: Append row — Acheteurs]
```

1. **Webhook node** : méthode `POST`, chemin `auctelia-survey`, réponse immédiate (`Respond Immediately` ou `Respond to Webhook` avec `{ "received": true }`). L'URL complète du webhook est celle à mettre dans `N8N_WEBHOOK_URL`.
2. **Switch node** : branche sur `{{$json.survey_type}}` — valeurs possibles `vendeurs` / `acheteurs`. Les 4 formulaires (actifs + churn) partagent ces 2 valeurs ; c'est la colonne `audience` (`actif`/`churn`) qui distingue la variante, pas `survey_type`.
3. **Google Sheets node** (un par branche) : action `Append Row`, sur le classeur "Auctelia — Résultats enquêtes", onglet `Vendeurs` ou `Acheteurs`.

> La fonction `api/submit.js` répond `{ success: true }` au navigateur **avant même** de savoir si n8n a bien reçu la donnée (timeout de 5s), pour ne jamais faire attendre ou frustrer le répondant. Si n8n est down, l'erreur est loguée dans les logs Vercel (**Project → Logs**) mais la réponse n'est pas perdue côté navigateur — pense à surveiller ces logs pendant les premières semaines d'envoi.

### 3.2. Mapping des champs → colonnes Google Sheets

Le payload JSON envoyé par le formulaire (et reçu par le Webhook n8n) contient toujours ces métadonnées, plus les champs spécifiques au type d'enquête :

**Métadonnées communes**

| Champ JSON | Description |
|---|---|
| `timestamp` | Date/heure ISO 8601 de la soumission |
| `lang` | `fr` ou `nl` |
| `source` | Valeur du paramètre `utm_source` (ou `source`) présent dans l'URL |
| `user_agent` | User-agent du navigateur (permet de déduire mobile/desktop) |
| `survey_type` | `vendeurs` ou `acheteurs` |
| `audience` | `actif` ou `churn` — déduit automatiquement de la page (voir `AU_SURVEY_CONFIG.audience` dans chaque `.html`), pas une question posée au répondant |

**Formulaire Vendeurs** (actifs + churn, même onglet) — onglet Google Sheets `Vendeurs`, colonnes dans cet ordre :

```
timestamp | lang | source | user_agent | survey_type | audience | segment | nps | csat_prix | ces_facilite | a_mis_reserve | origine_prix_reserve | freq_reserve_non_atteinte | intention_retour | raisons_arret | raisons_arret_order | raisons_arret_autre_detail | leviers_retour | leviers_retour_order | leviers_retour_autre_detail | verbatim
```

**Formulaire Acheteurs** (actifs + churn, même onglet) — onglet Google Sheets `Acheteurs`, colonnes dans cet ordre :

```
timestamp | lang | source | user_agent | survey_type | audience | segment | nps | csat_confiance | csat_descriptions | ces_enlevement | freq_reserve_non_atteinte | freins | freins_order | freins_autre_detail | raisons_arret | raisons_arret_order | raisons_arret_autre_detail | leviers_retour | leviers_retour_order | leviers_retour_autre_detail | verbatim
```

Chaque type d'enquête (Vendeurs / Acheteurs) garde **un seul onglet**, alimenté par ses deux variantes (actif et churn) — c'est la colonne `audience` qui permet de les distinguer et de les comparer dans le dashboard, pas deux onglets séparés.

`*_order` enregistre l'ordre d'affichage réellement vu par le répondant pour la question à choix multiples correspondante (dont les options sont mélangées à chaque chargement pour éviter le biais de position — voir section 8). C'est un champ d'audit méthodologique, pas une donnée à analyser directement.

`*_autre_detail` capture le texte libre saisi quand le répondant a coché l'option « Autre » de la question correspondante (voir section 8, "Autre" reveal) — utile en lecture qualitative, non repris dans les graphiques du dashboard.

Colonnes vides selon le contexte :
- `csat_prix`/`ces_facilite`/`intention_retour` (Vendeurs) et `csat_confiance`/`csat_descriptions`/`ces_enlevement` (Acheteurs) ne sont alimentées que par les réponses `audience = actif`.
- `raisons_arret*`/`leviers_retour*` ne sont alimentées que par les réponses `audience = churn`.
- `origine_prix_reserve` et `freq_reserve_non_atteinte` (Vendeurs) restent vides si `a_mis_reserve = non` (question sautée — pas de valeur fantôme).

Le dashboard exclut automatiquement ces cellules vides des calculs (moyennes, tallys) plutôt que de les compter comme des zéros.

Dans le node Google Sheets de n8n, mappe chaque colonne sur `{{$json.<nom_du_champ>}}` (ex: `{{$json.nps}}`, `{{$json.verbatim}}`).

### 3.3. Template des colonnes Google Sheets (copier-coller)

**Onglet "Vendeurs"** — ligne d'en-tête à coller en `A1` :

```
timestamp	lang	source	user_agent	survey_type	audience	segment	nps	csat_prix	ces_facilite	a_mis_reserve	origine_prix_reserve	freq_reserve_non_atteinte	intention_retour	raisons_arret	raisons_arret_order	raisons_arret_autre_detail	leviers_retour	leviers_retour_order	leviers_retour_autre_detail	verbatim
```

**Onglet "Acheteurs"** — ligne d'en-tête à coller en `A1` :

```
timestamp	lang	source	user_agent	survey_type	audience	segment	nps	csat_confiance	csat_descriptions	ces_enlevement	freq_reserve_non_atteinte	freins	freins_order	freins_autre_detail	raisons_arret	raisons_arret_order	raisons_arret_autre_detail	leviers_retour	leviers_retour_order	leviers_retour_autre_detail	verbatim
```

(Copie chaque ligne dans la cellule `A1` de l'onglet correspondant — Google Sheets répartit automatiquement les valeurs séparées par tabulation dans les colonnes.)

> Si des onglets existants utilisent encore l'ancien schéma (sans `audience`, avec `csat_suivi`/`concurrence`/`usage_mobile`), il n'est pas nécessaire de les migrer rétroactivement : ajoute simplement les nouvelles colonnes à droite des existantes. Les lignes historiques auront ces nouvelles cellules vides, ce que le dashboard gère déjà nativement.

---

## 4. Connecter le dashboard aux vraies données

Par défaut, `dashboard.html` affiche des **données de démonstration** générées côté client (bannière orange visible en haut du dashboard), pour que le rendu soit testable avant d'avoir de vraies réponses. Les données de démo mélangent des réponses `actif` et `churn` fictives dans chaque tableau, exactement comme le fera la vraie collecte.

Pour afficher les vraies réponses :

1. Dans Google Sheets, pour **chaque onglet** (`Vendeurs` et `Acheteurs`) : **Fichier → Partager → Publier sur le web**.
2. Choisis l'onglet concerné, format **Valeurs séparées par des virgules (.csv)**, clique sur **Publier**.
3. Copie l'URL générée (du type `https://docs.google.com/spreadsheets/d/e/.../pub?gid=...&single=true&output=csv`).
4. Ouvre `assets/dashboard.js`, en haut du fichier :
   ```js
   var CONFIG = {
     DASHBOARD_PASSWORD: "auctelia2026",
     SHEET_CSV_URL: {
       vendeurs: "",   // ← colle l'URL CSV de l'onglet Vendeurs ici
       acheteurs: ""   // ← colle l'URL CSV de l'onglet Acheteurs ici
     }
   };
   ```
5. Colle les deux URLs, commit et push. Vercel redéploie automatiquement.

Le classeur doit être partagé en lecture via "Publier sur le web" (pas besoin de le rendre public dans les paramètres de partage classiques — la publication web suffit et reste séparée du partage normal du fichier).

Si l'URL est mal configurée ou temporairement inaccessible, le dashboard retombe automatiquement sur les données de démonstration plutôt que d'afficher une erreur.

---

## 5. Changer le mot de passe du dashboard

Le mot de passe est vérifié côté client dans `assets/dashboard.js` (pas d'authentification serveur — usage interne occasionnel) :

```js
var CONFIG = {
  DASHBOARD_PASSWORD: "auctelia2026",
  ...
};
```

Pour le changer : modifie la valeur de `DASHBOARD_PASSWORD`, commit, push. Vercel redéploie automatiquement et le nouveau mot de passe est actif.

> ⚠️ Ce mot de passe apparaît en clair dans le code source livré au navigateur. C'est un choix assumé pour un dashboard interne à faible sensibilité (pas de données nominatives, verbatims anonymes) — ne pas y stocker d'informations confidentielles au-delà des résultats d'enquête.

---

## 6. Variables d'environnement — récapitulatif

| Variable | Où | Description |
|---|---|---|
| `N8N_WEBHOOK_URL` | Vercel (env var) | URL du webhook n8n qui reçoit les réponses et les écrit dans Google Sheets |
| `DASHBOARD_PASSWORD` | `assets/dashboard.js` (constante) | Mot de passe d'accès au dashboard (pas une vraie variable d'environnement, voir section 5) |
| `SHEET_CSV_URL.vendeurs` / `.acheteurs` | `assets/dashboard.js` (constante) | URLs CSV publiées des onglets Google Sheets (voir section 4) |

---

## 7. Développement local

Aucune dépendance ni étape de build. Pour prévisualiser :

```bash
npx serve .
# ou
python3 -m http.server 8000
```

Puis ouvre `http://localhost:8000/vendeurs.html`, `/vendeurs-churn.html`, `/acheteurs.html`, `/acheteurs-churn.html`, `/dashboard.html`, etc.

L'API `/api/submit` ne fonctionne pas avec un simple serveur statique — pour la tester en local, utilise :

```bash
npx vercel dev
```

---

## 8. Notes de maintenance

- Tout le texte des formulaires (FR/NL) est centralisé dans l'objet `I18N` en haut de chaque `.html` — pas besoin de toucher à `assets/survey-engine.js` pour modifier une question ou une traduction.
- La langue est déterminée par le paramètre d'URL `?lang=fr` ou `?lang=nl` (par défaut `fr`), ce qui permet à Mailchimp de cibler directement la bonne langue par lien.
- `assets/survey-engine.js` est partagé par les 4 formulaires : toute évolution du design du stepper (nouvelle transition, nouveau type de question) se fait à un seul endroit.
- **Audience (`AU_SURVEY_CONFIG.audience`)** : chaque formulaire déclare `audience: "actif"` ou `audience: "churn"` dans sa config — c'est une métadonnée, pas une question posée. `survey_type` (`acheteurs`/`vendeurs`) reste inchangé entre les deux variantes, pour que les 4 formulaires continuent d'alimenter seulement 2 onglets Google Sheets.
- Si le webhook n8n est indisponible, le formulaire affiche quand même la page de remerciement — c'est voulu (voir section 3.1). Surveiller les logs Vercel pour détecter les échecs silencieux d'écriture Google Sheets.
- **Anti-biais des questions à choix multiples** : les options des cases à cocher sont marquées `shuffle: true` avec une liste `anchors` (ex: `["rien_satisfait", "autre"]`) dans la config de la question. L'ordre des autres options est randomisé une fois par répondant (calculé et mis en cache au premier rendu, stable ensuite) pour éviter le biais de position. Les items d'ancrage restent toujours en dernier, dans l'ordre déclaré. Pour ajouter une nouvelle option à une liste existante, il suffit de l'ajouter dans le tableau `options` — elle sera automatiquement incluse dans le mélange sauf si son `value` est aussi listé dans `anchors`.
- **"Autre" reveal** : une question checkbox marquée `autreReveal: true` fait apparaître un champ texte libre dès que l'option de valeur `"autre"` est cochée (voir `renderCheckbox` dans `survey-engine.js`). La valeur saisie est envoyée dans le payload sous `<nom_du_champ>_autre_detail`. Pour l'ajouter à une nouvelle question checkbox, il suffit de poser `autreReveal: true` sur la question et de s'assurer qu'une option a la valeur exacte `"autre"`.
- **Corrélation NPS × irritants (dashboard)** : le bloc "Corrélation avec le NPS" sous le graphique Freins/Raisons calcule, après coup, le NPS moyen des répondants ayant cité chaque item vs. la moyenne globale. C'est volontairement une analyse a posteriori et non une question posée directement — poser la causalité dans la question orienterait la réponse. Le calcul n'affiche un delta que si au moins 5 répondants ont cité l'item, pour éviter des moyennes non significatives sur un petit échantillon. Un encart "Ce que ça dit" traduit automatiquement le signal le plus fort en phrase.
- **Skip logic** : les questions peuvent porter une propriété `skipIf: function(answers) { ... }` dans leur config — si elle retourne `true`, la question est sautée à la navigation et exclue du calcul de la barre de progression (`X / Y` s'adapte au nombre réel de questions visibles). Utilisé sur `vendeurs.html`/`vendeurs-churn.html` pour sauter l'origine et la fréquence d'échec du prix de réserve si le répondant indique n'en avoir jamais mis. Les réponses des questions sautées (et leur éventuel `_autre_detail`) sont retirées du payload avant l'envoi.
- **Échelles CES (effort)** : `1 = négatif` (très difficile/compliqué) et `7 = positif` (très facile/fluide), dans le même sens que le NPS et les CSAT (plus haut = mieux). Si vous ajoutez une nouvelle question CES, gardez cette convention — le dashboard (KPI, code couleur du thermomètre) suppose que 7 est la meilleure note.
- **Persistance de la langue en cours de formulaire** : cliquer sur FR/NL en pleine saisie sauvegarde `state.answers` dans `sessionStorage` juste avant le rechargement de page, et les restaure au chargement dans la nouvelle langue — le répondant ne reperd pas sa progression en changeant de langue.
- **Anti-double-soumission** : après un envoi (réussi ou non, voir plus haut), un flag est posé dans `localStorage` (`au_submitted_<survey_type>`). Toute visite ultérieure du même formulaire sur le même navigateur redirige directement vers la page de remerciement, sans réafficher le questionnaire. Utile pour les tests : videz le `localStorage` du site (ou ouvrez une fenêtre de navigation privée) pour re-soumettre. Ce flag est partagé entre la variante actif et churn d'un même type (`au_submitted_acheteurs` sert pour `acheteurs.html` et `acheteurs-churn.html`) — un répondant qui a déjà soumis l'une ne verra pas l'autre.
- **Dashboard — deux filtres combinables** : la sidebar a un switch Audience (Actifs/Churn) en plus du switch Type (Acheteurs/Vendeurs). Le bloc "Synthèse comparative" en haut de page montre les 4 combinaisons côte à côte indépendamment du filtre actif, et cliquer une ligne bascule les deux switches en même temps.
