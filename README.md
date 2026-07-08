# Auctelia — Plateforme d'enquêtes de satisfaction

Outil interne Clictelia SA (Estela Group) pour les enquêtes de satisfaction vendeurs et acheteurs Auctelia, dans le cadre du relaunch de marque de septembre 2026.

- 2 formulaires publics bilingues FR/NL (vendeurs, acheteurs), envoyés via Mailchimp
- 1 dashboard interne protégé par mot de passe pour la direction
- 1 fonction serverless qui relaie les réponses vers n8n → Google Sheets

Stack : HTML/CSS/JS vanilla + Chart.js (CDN) + Vercel serverless. Aucun framework, aucune étape de build.

---

## 1. Structure du projet

```
/
├── index.html              → Redirige vers /vendeurs ou /acheteurs selon ?type=
├── vendeurs.html           → Formulaire enquête vendeurs (FR/NL)
├── acheteurs.html          → Formulaire enquête acheteurs (FR/NL)
├── merci.html              → Page de confirmation post-soumission
├── dashboard.html          → Dashboard résultats (protégé mot de passe)
├── styles/
│   └── main.css            → Design system partagé (formulaires + dashboard)
├── assets/
│   ├── survey-engine.js    → Logique du stepper, partagée par les 2 formulaires
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

- Vendeurs (FR) : `https://survey.auctelia.be/vendeurs?utm_source=mailchimp_vendeurs`
- Vendeurs (NL) : `https://survey.auctelia.be/vendeurs?lang=nl&utm_source=mailchimp_vendeurs_nl`
- Acheteurs (FR) : `https://survey.auctelia.be/acheteurs?utm_source=mailchimp_acheteurs`
- Acheteurs (NL) : `https://survey.auctelia.be/acheteurs?lang=nl&utm_source=mailchimp_acheteurs_nl`

Le paramètre `source`/`utm_source` est enregistré tel quel dans chaque réponse (colonne `source`), ce qui permet de distinguer les campagnes dans les résultats.

Le lien générique `https://survey.auctelia.be/?type=vendeurs` (ou `?type=acheteurs`) fonctionne aussi et redirige automatiquement, en conservant les autres paramètres (`lang`, `utm_source`).

---

## 3. Configuration n8n

### 3.1. Structure du workflow

```
[Webhook (POST)] → [Switch: survey_type] → [Google Sheets: Append row — Vendeurs]
                                          → [Google Sheets: Append row — Acheteurs]
```

1. **Webhook node** : méthode `POST`, chemin `auctelia-survey`, réponse immédiate (`Respond Immediately` ou `Respond to Webhook` avec `{ "received": true }`). L'URL complète du webhook est celle à mettre dans `N8N_WEBHOOK_URL`.
2. **Switch node** : branche sur `{{$json.survey_type}}` — valeurs possibles `vendeurs` / `acheteurs`.
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

**Formulaire Vendeurs** — onglet Google Sheets `Vendeurs`, colonnes dans cet ordre :

```
timestamp | lang | source | user_agent | survey_type | segment | nps | csat_prix | csat_suivi | ces_facilite | concurrence | concurrence_order | intention_retour | verbatim
```

**Formulaire Acheteurs** — onglet Google Sheets `Acheteurs`, colonnes dans cet ordre :

```
timestamp | lang | source | user_agent | survey_type | segment | nps | csat_confiance | csat_descriptions | ces_enlevement | freins | freins_order | usage_mobile | verbatim
```

`concurrence_order` / `freins_order` enregistrent l'ordre d'affichage réellement vu par le répondant pour la question à choix multiples (dont les options sont mélangées à chaque chargement pour éviter le biais de position — voir section 8). C'est un champ d'audit méthodologique, pas une donnée à analyser directement.

`csat_descriptions` et `ces_enlevement` (Acheteurs) peuvent arriver vides : ces deux questions sont sautées pour le segment "Inscrit, aucun achat" (`non_acheteur`), qui n'a jamais réceptionné de lot. Le dashboard exclut automatiquement ces cellules vides du calcul des moyennes.

Dans le node Google Sheets de n8n, mappe chaque colonne sur `{{$json.<nom_du_champ>}}` (ex: `{{$json.nps}}`, `{{$json.verbatim}}`).

### 3.3. Template des colonnes Google Sheets (copier-coller)

**Onglet "Vendeurs"** — ligne d'en-tête à coller en `A1` :

```
timestamp	lang	source	user_agent	survey_type	segment	nps	csat_prix	csat_suivi	ces_facilite	concurrence	concurrence_order	intention_retour	verbatim
```

**Onglet "Acheteurs"** — ligne d'en-tête à coller en `A1` :

```
timestamp	lang	source	user_agent	survey_type	segment	nps	csat_confiance	csat_descriptions	ces_enlevement	freins	freins_order	usage_mobile	verbatim
```

(Copie chaque ligne dans la cellule `A1` de l'onglet correspondant — Google Sheets répartit automatiquement les valeurs séparées par tabulation dans les colonnes.)

---

## 4. Connecter le dashboard aux vraies données

Par défaut, `dashboard.html` affiche des **données de démonstration** générées côté client (bannière orange visible en haut du dashboard), pour que le rendu soit testable avant d'avoir de vraies réponses.

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

Puis ouvre `http://localhost:8000/vendeurs.html`, `/acheteurs.html`, `/dashboard.html`, etc.

L'API `/api/submit` ne fonctionne pas avec un simple serveur statique — pour la tester en local, utilise :

```bash
npx vercel dev
```

---

## 8. Notes de maintenance

- Tout le texte des formulaires (FR/NL) est centralisé dans l'objet `I18N` en haut de `vendeurs.html` et `acheteurs.html` — pas besoin de toucher à `assets/survey-engine.js` pour modifier une question ou une traduction.
- La langue est déterminée par le paramètre d'URL `?lang=fr` ou `?lang=nl` (par défaut `fr`), ce qui permet à Mailchimp de cibler directement la bonne langue par lien.
- `assets/survey-engine.js` est partagé par les deux formulaires : toute évolution du design du stepper (nouvelle transition, nouveau type de question) se fait à un seul endroit.
- Si le webhook n8n est indisponible, le formulaire affiche quand même la page de remerciement — c'est voulu (voir section 3.1). Surveiller les logs Vercel pour détecter les échecs silencieux d'écriture Google Sheets.
- **Anti-biais des questions à choix multiples (Q6)** : les options des cases à cocher sont marquées `shuffle: true` avec une liste `anchors` (ex: `["rien_satisfait", "autre"]`) dans la config de la question. L'ordre des autres options est randomisé une fois par répondant (calculé et mis en cache au premier rendu, stable ensuite) pour éviter le biais de position — sans ça, l'item listé en premier est mécaniquement plus coché, indépendamment de sa pertinence réelle. Les items d'ancrage restent toujours en dernier, dans l'ordre déclaré. Pour ajouter une nouvelle option à une liste existante, il suffit de l'ajouter dans le tableau `options` — elle sera automatiquement incluse dans le mélange sauf si son `value` est aussi listé dans `anchors`.
- **Corrélation NPS × irritants (dashboard)** : le bloc "Corrélation avec le NPS" sous le graphique Freins/Concurrence calcule, après coup, le NPS moyen des répondants ayant coché chaque item vs. la moyenne globale. C'est volontairement une analyse a posteriori et non une question posée directement (du type "est-ce que X vous a fait moins acheter ?") — poser la causalité dans la question orienterait la réponse. Le calcul n'affiche un delta que si au moins 5 répondants ont coché l'item, pour éviter des moyennes non significatives sur un petit échantillon.
- **Skip logic (Acheteurs Q4/Q5)** : les questions peuvent porter une propriété `skipIf: function(answers) { ... }` dans leur config — si elle retourne `true`, la question est sautée à la navigation et exclue du calcul de la barre de progression (`X / Y` s'adapte au nombre réel de questions visibles). Actuellement utilisé pour cacher "Qualité des descriptions" et "Enlèvement" au segment "Inscrit, aucun achat", qui n'a jamais réceptionné de lot. Les réponses des questions sautées sont retirées du payload avant l'envoi (pas de valeur fantôme dans Google Sheets).
- **Échelles CES (effort)** : `1 = négatif` (très difficile/compliqué) et `7 = positif` (très facile/fluide), dans le même sens que le NPS et les CSAT (plus haut = mieux). Si vous ajoutez une nouvelle question CES, gardez cette convention — le dashboard (KPI, code couleur du thermomètre) suppose que 7 est la meilleure note.
- **Persistance de la langue en cours de formulaire** : cliquer sur FR/NL en pleine saisie sauvegarde `state.answers` dans `sessionStorage` juste avant le rechargement de page, et les restaure au chargement dans la nouvelle langue — le répondant ne reperd pas sa progression en changeant de langue.
- **Anti-double-soumission** : après un envoi (réussi ou non, voir plus haut), un flag est posé dans `localStorage` (`au_submitted_<survey_type>`). Toute visite ultérieure du même formulaire sur le même navigateur redirige directement vers la page de remerciement, sans réafficher le questionnaire. Utile pour les tests : videz le `localStorage` du site (ou ouvrez une fenêtre de navigation privée) pour re-soumettre.
