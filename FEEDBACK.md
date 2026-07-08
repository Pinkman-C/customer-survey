# Feedback méthodologique — Enquêtes quantitatives Auctelia

Analyse des questionnaires `acheteurs.html` et `vendeurs.html` (branche
`claude/auctelia-survey-platform-rgtvn8`), du moteur `assets/survey-engine.js`
et du dashboard `assets/dashboard.js`.

**Verdict global** : la base est solide — 8 questions, une par écran, bilingue
FR/NL, randomisation des choix multiples avec ancres, corrélation NPS calculée
a posteriori plutôt que suggérée. Mais 4 défauts méthodologiques sérieux
pollueront les données quantitatives si les enquêtes partent telles quelles.

---

## 🔴 Problèmes critiques

### 1. Les "inscrits non-acheteurs" sont forcés de répondre à des questions sans objet (enquête acheteurs)

Le segment Q1 inclut « Inscrit non-acheteur — je n'ai jamais remporté de lot »
(`acheteurs.html:64`), mais Q4 (« correspond à la réalité du matériel **reçu** »,
ligne 81) et Q5 (« **Récupérer un lot** après adjudication a été… », ligne 88)
sont **obligatoires** et supposent un achat. Un non-acheteur devra inventer une
note pour passer → données fausses mélangées aux vraies.

**Correction** : branchement (sauter Q4/Q5 si `segment = non_acheteur`), ou
option « Non concerné » exclue des moyennes du dashboard.

### 2. Les segments ne sont pas mutuellement exclusifs (les deux enquêtes)

- Vendeurs (`vendeurs.html:65-67`) : « Actif » = vendu dans les 12 derniers
  mois, « Occasionnel » = vendu une seule fois à ce jour. Quelqu'un qui a vendu
  une seule fois il y a 3 mois coche les deux. Les catégories mélangent récence
  et fréquence.
- Acheteurs (`acheteurs.html:62-63`) : « Régulier » = plusieurs achats sur
  12 mois, « Occasionnel » = 1 à 2 achats à ce jour. Deux achats dans les
  12 derniers mois = les deux cases à la fois.

**Correction** : une seule dimension avec des seuils nets. Acheteurs :
« 3 achats ou plus (12 derniers mois) / 1 à 2 achats / aucun achat ».
Vendeurs : « Plusieurs ventes / Une seule vente / Dernière vente il y a plus
d'un an ».

### 3. L'échelle CES est à polarité inversée par rapport à tout le reste

NPS (0→10) et étoiles (1→5) : plus haut = mieux. Les deux CES (1 = « Très
fluide/facile », 7 = « Très compliqué/difficile », `acheteurs.html:88-91`,
`vendeurs.html:91-94`) : plus haut = pire. Un répondant pressé va straight-liner
et se contredire sans le vouloir — biais classique. Le dashboard gère
l'inversion pour la couleur (`dashboard.js:434`), mais le problème est côté
répondant.

**Correction** : inverser — 1 = très difficile → 7 = très facile — et ajuster
le dashboard en conséquence.

### 4. Questions à choix multiples optionnelles alors qu'elles ont une option "aucun"

Q6 acheteurs (« freins », ancre « Rien, je suis satisfait ») et Q6 vendeurs
(« concurrence », ancre « Non, uniquement Auctelia ») sont `optional: true`.
Impossible de distinguer « a sauté la question » de « rien ne me freine » /
« uniquement Auctelia » — dénominateur flou pour les pourcentages.

**Correction** : rendre ces deux questions obligatoires (la porte de sortie
explicite existe déjà).

---

## 🟠 Problèmes moyens

- **Questions à double objet** : Q3 acheteurs « transactions fiables **et**
  sécurisées » (ligne 74) ; Q4 acheteurs « descriptions **et** photos »
  (ligne 81) — si les photos sont bonnes mais les descriptions trompeuses, la
  note est ininterprétable ; Q6 vendeurs « déjà vendu **ou** envisagé de
  vendre » (ligne 98) mélange comportement réel et intention. Trancher pour un
  seul objet par question (recommandé : le comportement réel).
- **Formulation oui/non posée sur une échelle** : « Faites-vous confiance à
  Auctelia… ? » (ligne 74) appelle un oui/non mais se répond en 5 étoiles →
  reformuler en degré (« Quel est votre niveau de confiance… ? »). Idem Q4
  acheteurs : échelle de fréquence (Jamais/Toujours) affichée en étoiles — les
  étoiles connotent la satisfaction, pas la fréquence.
- **Options non exhaustives** Q7 acheteurs (ligne 115) : Ordinateur /
  Smartphone / Les deux — pas de tablette, question obligatoire → réponse
  forcée fausse. Ajouter « Tablette » ou renommer « Les deux » en « Plusieurs
  appareils ». (Le `user_agent` est déjà collecté — question à faible
  rendement, slot réallouable.)
- **Libellés NPS non standards** : « 0 = Pas du tout / 10 = Certainement »
  (`acheteurs.html:52-53`). Standard : « Pas du tout probable / Extrêmement
  probable ».
- **Option de frein « J'ai déjà vécu l'annulation d'un achat… »** (ligne 107) :
  c'est un vécu passé, pas un frein — reformuler « Le risque d'annulation après
  adjudication ».

---

## 🟡 Points mineurs / techniques

- **Changer de langue efface toutes les réponses** : le switch FR/NL recharge
  la page (`survey-engine.js:80-85`) et `state.answers` est perdu.
- **Aucune protection contre les soumissions multiples** (pas de token, pas de
  flag localStorage).
- **L'ordre randomisé des options n'est pas enregistré** dans le payload —
  impossible de vérifier a posteriori l'effet de position.
- Les placeholders des verbatims suggèrent des réponses — léger effet
  d'amorçage, acceptable mais à connaître.

---

## ✅ À garder tel quel

- Randomisation avec ancres des choix multiples
- Corrélation NPS a posteriori (bien documentée dans le README)
- Format une-question-par-écran, 8 questions courtes
- Verbatims optionnels en dernière position
- Bilinguisme FR/NL centralisé dans l'objet `I18N`

---

## 📋 Bloc à coller dans un chat de correction

```
Sur la branche claude/quantitative-surveys-feedback-r9vz5t du repo Pinkman-C/customer-survey,
corrige les enquêtes acheteurs.html et vendeurs.html (objets I18N, FR **et** NL) ainsi que
survey-engine.js et dashboard.js quand indiqué :

1. BRANCHEMENT (acheteurs) : si segment = "non_acheteur", sauter les questions
   csat_descriptions (Q4) et ces_enlevement (Q5), et adapter la barre de progression.
   Le dashboard doit exclure ces champs vides des moyennes.
2. SEGMENTS MECE :
   - acheteurs Q1 : "3 achats ou plus (12 derniers mois)" / "1 à 2 achats" / "Inscrit, aucun achat"
   - vendeurs Q1 : "Plusieurs ventes via Auctelia" / "Une seule vente" / "Dernière vente il y a plus d'un an"
   (garder les values existantes pour ne pas casser le mapping Google Sheets)
3. INVERSER LES DEUX ÉCHELLES CES pour que 7 = positif (Très facile / Très fluide) et
   1 = négatif, comme les autres échelles. Mettre à jour dashboard.js (thermoColor et
   tout endroit qui suppose "CES bas = bien").
4. Rendre OBLIGATOIRES les questions checkbox Q6 (freins / concurrence) des deux
   enquêtes (retirer optional: true) — elles ont déjà une option "aucun".
5. Reformulations :
   - acheteurs Q3 : "Quel est votre niveau de confiance dans Auctelia pour des
     transactions sécurisées ?" (un seul objet)
   - acheteurs Q4 : ne garder qu'un objet ("Les descriptions des lots correspondent-elles
     au matériel reçu ?" — ou photos, au choix) et formuler en degré
   - vendeurs Q6 : "Avez-vous déjà vendu via une autre plateforme ?" (retirer "ou envisagé")
   - frein "annulation_post_adjudication" : "Le risque d'annulation après adjudication"
   - labels NPS : "0 = Pas du tout probable" / "10 = Extrêmement probable" (FR),
     "0 = Helemaal niet waarschijnlijk" / "10 = Uiterst waarschijnlijk" (NL)
   - acheteurs Q7 : ajouter option "Tablette" ou renommer "Les deux" en "Plusieurs appareils"
6. TECHNIQUE (survey-engine.js) :
   - préserver state.answers lors du changement de langue (sessionStorage avant reload,
     restauration au chargement)
   - anti-double-soumission : flag localStorage par survey_type après envoi
   - enregistrer l'ordre affiché des options mélangées dans le payload (ex. champ
     "freins_order")
Ne pas oublier de répercuter chaque changement dans la version NL, et de vérifier que
les noms de champs envoyés à n8n/Google Sheets restent identiques.
```
