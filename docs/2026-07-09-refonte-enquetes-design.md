# Refonte des enquêtes de satisfaction Auctelia — identifier la cause du déclin acheteurs/vendeurs

**Date** : 2026-07-09 (mis à jour après la review de Lorenzo)
**Repo** : `Pinkman-C/customer-survey`
**Statut** : implémenté sur la branche `feature/refonte-enquetes-reserve-prix`

## 1. Contexte et problème

Auctelia perd des acheteurs et des vendeurs depuis 4 ans, dans une dynamique en spirale :
moins d'acheteurs → moins d'enchérisseurs par lot → moins de prix de réserve atteints →
vendeurs moins satisfaits → moins de nouveaux lots → moins d'acheteurs. L'hypothèse de
David (fondateur) : l'augmentation du nombre de lots avec prix de réserve est le nœud —
elle frustre les acheteurs qui enchérissent sans que le lot soit finalement vendu, ce qui
les décourage de revenir.

Les deux enquêtes existantes (`acheteurs.html`, `vendeurs.html`) ont déjà été corrigées
une fois sur le plan méthodologique (voir `FEEDBACK.md` : segments MECE, skip logic,
échelles CES cohérentes, anti-biais checkbox avec `shuffle`/`anchors`). Mais elles avaient
deux limites structurelles pour répondre à la question actuelle :

1. **Biais de survie** : envoyées à toute la base Mailchimp, elles ne touchent en pratique
   que les utilisateurs encore assez engagés pour ouvrir un email et répondre — les vrais
   partants (churned) sont sous-représentés.
2. **Pas de question testant directement la chaîne causale** prix de réserve → frustration
   → désengagement, seulement une option parmi d'autres dans une liste de freins généraux.

## 2. Contraintes validées avec l'utilisateur

- **Ciblage** : extraction CRM possible et fiable pour distinguer *actifs* (ench./vente
  dans les 12 derniers mois) de *churn* (déjà actif par le passé — lifetime > 0 — mais
  silencieux depuis plus de 12 mois). Les jamais-activés sont hors scope de la campagne
  churn.
- **Anonymat** : pas de croisement identité ↔ données de plateforme. Les questions
  factuelles (fréquences vécues) reposent donc sur le rappel déclaré, pas sur les logs.
- **Longueur** : format court partout (~6-9 questions, ~2 min), pas de version longue pour
  le segment churn — la différenciation se fait par contenu/temps grammatical, pas par le
  nombre de questions.

## 3. Architecture

4 pages, même moteur (`assets/survey-engine.js`), même feuille de style (`styles/main.css`),
seul le contenu (`I18N`) change :

- `acheteurs.html` — acheteurs actifs (existant, modifié)
- `acheteurs-churn.html` — acheteurs churn (nouveau)
- `vendeurs.html` — vendeurs actifs (existant, modifié)
- `vendeurs-churn.html` — vendeurs churn (nouveau)

`survey_type` reste `acheteurs` / `vendeurs` (2 valeurs) pour ne pas casser le mapping
Google Sheets existant. Un nouveau champ commun **`audience`** = `actif` / `churn` est
rempli automatiquement selon la page (pas une question posée au répondant) et envoyé dans
le payload comme les autres métadonnées (`timestamp`, `lang`, `source`, etc.).

Les 2 onglets Google Sheets existants (`Vendeurs`, `Acheteurs`) sont conservés, avec de
nouvelles colonnes. Un champ est **partagé** entre la variante actif et la variante churn
d'une même enquête quand il mesure la même chose (permet la comparaison actif/churn dans
le dashboard) ; il est **spécifique** à une variante quand il n'a de sens que pour elle.

**Vocabulaire** : toutes les mentions de « matériel » ont été reformulées en « matériel
industriel » (retour de Lorenzo) pour rester alignées avec le positionnement B2B d'Auctelia.

## 4. Questionnaire — Acheteurs actifs (`acheteurs.html`)

Cible : a enchéri dans les 12 derniers mois. 8 questions.

| # | Champ | Question (FR) | Type |
|---|---|---|---|
| 1 | `segment` | Quelle situation vous correspond ? (3 achats ou plus / 1 à 2 achats) | radio |
| 2 | `nps` | Recommandation (0-10) | nps |
| 3 | `csat_confiance` | Confiance dans les transactions sécurisées | stars |
| 4 | `csat_descriptions` | Correspondance description/matériel industriel reçu | stars |
| 5 | `ces_enlevement` | Facilité d'enlèvement après adjudication | ces |
| 6 | `freq_reserve_non_atteinte` | *« Ces 12 derniers mois, combien de fois avez-vous enchéri sur un lot où le prix de réserve n'a finalement pas été atteint ? »* — Jamais / Une ou deux fois / Plusieurs fois / Je ne sais pas | radio (fréquence) |
| 7 | `freins` | Freins à enchérir davantage (checkbox, mélangé, champ « Précisez » si Autre) | checkbox |
| 8 | `verbatim` | Qu'est-ce qu'Auctelia pourrait améliorer ? | textarea |

**Logique anti-biais** : Q6 est posée en amont de Q7, formulée comme un simple comptage
factuel, sans qualificatif de frustration — elle ne suggère pas que rater une réserve est
un problème. Q7 garde `prix_reserve_eleve` diluée parmi 7 autres options mélangées. Si les
répondants "plusieurs fois" à Q6 cochent aussi massivement cette option en Q7, la
corrélation devient un signal auto-porté par les données, jamais suggéré par la question.

**Retours de Lorenzo appliqués** : « Frais d'adjudication » → « Frais de vente » ;
« Le risque d'annulation après adjudication » → « Le risque d'annuler la vente après avoir
gagné l'enchère » ; un champ texte « Précisez » apparaît dès que l'option Autre est cochée
(`freins_autre_detail`).

## 5. Questionnaire — Acheteurs churn (`acheteurs-churn.html`, nouveau)

Cible : a acheté au moins une fois, aucun achat depuis 12 mois. 6 questions, au passé.

| # | Champ | Question (FR) | Type |
|---|---|---|---|
| 1 | `segment` | *« Avant d'arrêter, à quelle fréquence achetiez-vous sur Auctelia ? »* | radio |
| 2 | `nps` | Recommandation (0-10) | nps |
| 3 | `raisons_arret` | *« Qu'est-ce qui explique le mieux votre arrêt ? »* (**sélection multiple**, mélangé, champ « Précisez » si Autre) | checkbox |
| 4 | `freq_reserve_non_atteinte` | *« Repensez à vos achats : à quelle fréquence avez-vous enchéri sur un lot dont le prix de réserve n'a finalement pas été atteint ? »* — champ réutilisé | radio (fréquence) |
| 5 | `leviers_retour` | *« Qu'est-ce qui vous ferait reconsidérer Auctelia aujourd'hui ? »* (checkbox, champ « Précisez » si Autre) | checkbox |
| 6 | `verbatim` | *« Autre chose à ajouter, sur cette expérience ou sur Auctelia en général ? »* | textarea |

**Retours de Lorenzo appliqués** :
- Q3 passe en **sélection multiple** (était mono-select) et gagne l'option **« Qualité
  insuffisante des échanges avec le service client Auctelia »** (`qualite_interactions`).
- Q5 gagne l'option **« Amélioration du service client »** (`amelioration_service_client`).
- Champ « Précisez » sur Q3 et Q5 si Autre est cochée.

**Q4 est posée à tous, pas seulement si Q3 cite le prix de réserve** : quelqu'un peut
citer une autre raison principale tout en ayant aussi vécu des réserves ratées comme
frustration secondaire. Poser la question à tous préserve le signal de corrélation.

**Q5 vs Q6 (verbatim) — corrigé en review** : les deux posaient initialement la même
question (« qu'est-ce qui vous ferait revenir ») sous deux formes, une fermée une ouverte —
redondant pour le répondant. Q6 est une question libre générale qui capture ce que Q5 ne
capte pas, plutôt que de répéter la même question.

Pas de CSAT confiance ni de CES enlèvement dans cette variante : ces échelles perdent leur
fiabilité sur un souvenir ancien et non récurrent.

## 6. Questionnaire — Vendeurs actifs (`vendeurs.html`)

Cible : a vendu dans les 12 derniers mois. Jusqu'à 9 questions (2 sautées si pas de réserve).

| # | Champ | Question (FR) | Type |
|---|---|---|---|
| 1 | `segment` | Plusieurs ventes / Une seule vente | radio |
| 2 | `nps` | Recommandation (0-10) | nps |
| 3 | `csat_prix` | Satisfaction prix de vente vs attentes | stars |
| 4 | `ces_facilite` | Facilité de mise en vente | ces |
| 5 | `a_mis_reserve` | **[NOUVEAU]** *« Avez-vous mis un prix de réserve sur vos derniers lots mis en vente ? »* — Oui / Non | radio |
| 6 | `origine_prix_reserve` | *« Sur ces lots, comment le prix de réserve a-t-il été déterminé ? »* — **sautée si Q5 = Non** | radio |
| 7 | `freq_reserve_non_atteinte` | *« Sur ces lots, à quelle fréquence le prix de réserve n'a-t-il pas été atteint ? »* — **sautée si Q5 = Non** | radio (fréquence) |
| 8 | `intention_retour` | Envisagez-vous de faire appel à Auctelia pour une prochaine vente ? | radio |
| 9 | `verbatim` | Qu'est-ce qu'Auctelia pourrait améliorer pour que vous vendiez davantage ? | textarea |

**Retour de Lorenzo appliqué** : avant de poser l'origine et la fréquence d'échec du prix
de réserve, on demande d'abord si un prix de réserve a même été mis. Si non, ces deux
questions n'ont pas de sens et sont automatiquement sautées (skip logic déjà supportée par
`survey-engine.js`) — la barre de progression s'adapte (7/7 au lieu de 9/9 pour ces
répondants).

**Retiré** : `csat_suivi` (qualité du suivi commercial) et `concurrence` (plateformes
concurrentes), pour garder le questionnaire court malgré les ajouts. Les colonnes Google
Sheets correspondantes restent en place pour l'historique, simplement plus alimentées.

**Croisement clé permis par Q6 × Q7** : si les réserves fixées "sur recommandation
Auctelia" ratent significativement plus souvent que celles fixées par le vendeur
lui-même, c'est un signal direct que la politique interne de recommandation de prix de
réserve — pas seulement le marché — pousse le taux d'échec. C'est le graphique le plus
direct pour trancher l'hypothèse de David (voir section 8, bloc "Prix de réserve").

**Q8 reformulée en review** : la version initiale (« qu'est-ce qui vous ferait revenir »)
supposait à tort un vendeur déjà parti. Corrigée pour rester tournée vers l'avenir,
symétrique à la formulation acheteurs actifs.

## 7. Questionnaire — Vendeurs churn (`vendeurs-churn.html`, nouveau)

Cible : a vendu au moins une fois, aucune vente depuis 12 mois. Jusqu'à 8 questions.

| # | Champ | Question (FR) | Type |
|---|---|---|---|
| 1 | `segment` | *« Avant d'arrêter, quelle était votre activité de vente sur Auctelia ? »* | radio |
| 2 | `nps` | Recommandation (0-10) | nps |
| 3 | `raisons_arret` | *« Qu'est-ce qui explique le mieux votre arrêt ? »* (**sélection multiple**, champ « Précisez » si Autre) | checkbox |
| 4 | `a_mis_reserve` | **[NOUVEAU]** *« Aviez-vous mis un prix de réserve sur vos ventes ? »* — Oui / Non | radio |
| 5 | `freq_reserve_non_atteinte` | *« Repensez à vos ventes : à quelle fréquence le prix de réserve n'a-t-il pas été atteint ? »* — **sautée si Q4 = Non** | radio (fréquence) |
| 6 | `origine_prix_reserve` | Même question qu'en Q6 actifs, au passé — **sautée si Q4 = Non** | radio |
| 7 | `leviers_retour` | *« Qu'est-ce qui vous ferait remettre du matériel industriel en vente ? »* (checkbox, champ « Précisez » si Autre) | checkbox |
| 8 | `verbatim` | *« Autre chose à ajouter, sur cette expérience ou sur Auctelia en général ? »* | textarea |

**Retours de Lorenzo appliqués** :
- Q3 passe en **sélection multiple** (par cohérence avec la version acheteurs) et gagne
  l'option **« Qualité insuffisante des échanges avec le service client Auctelia »**.
- Même gate Oui/Non prix de réserve qu'en actifs, insérée avant origine/fréquence.

## 8. Schéma de données (Google Sheets)

**Onglet `Acheteurs`** — colonnes complètes :
```
timestamp, lang, source, user_agent, survey_type, audience, segment, nps,
csat_confiance, csat_descriptions, ces_enlevement, freq_reserve_non_atteinte,
freins, freins_order, freins_autre_detail,
raisons_arret, raisons_arret_order, raisons_arret_autre_detail,
leviers_retour, leviers_retour_order, leviers_retour_autre_detail,
verbatim
```
`csat_confiance`/`csat_descriptions`/`ces_enlevement`/`freins*` ne sont alimentés que par
les réponses actifs ; `raisons_arret*`/`leviers_retour*` que par les réponses churn.
`freq_reserve_non_atteinte` et `verbatim` sont communs aux deux.

**Onglet `Vendeurs`** — colonnes complètes :
```
timestamp, lang, source, user_agent, survey_type, audience, segment, nps,
csat_prix, ces_facilite, a_mis_reserve, origine_prix_reserve,
freq_reserve_non_atteinte, intention_retour,
raisons_arret, raisons_arret_order, raisons_arret_autre_detail,
leviers_retour, leviers_retour_order, leviers_retour_autre_detail,
verbatim
```
`csat_prix`/`ces_facilite`/`intention_retour` ne sont alimentés que par les réponses
actifs ; `raisons_arret*`/`leviers_retour*` que par les réponses churn. `a_mis_reserve`,
`origine_prix_reserve`, `freq_reserve_non_atteinte` et `verbatim` sont communs — mais
`origine_prix_reserve`/`freq_reserve_non_atteinte` restent vides si `a_mis_reserve = non`.

Colonnes qui cessent d'être alimentées côté vendeurs actifs (mais conservées pour
l'historique) : `csat_suivi`, `concurrence`, `concurrence_order`.

Le dashboard (`assets/dashboard.js`) implémente :
- un **filtre Audience** (Actifs/Churn) en plus du filtre Type (Acheteurs/Vendeurs) —
  les deux se combinent, comme les deux switches dans la sidebar ;
- une **synthèse comparative** en tête de page : les 4 combinaisons type × audience
  côte à côte (n, NPS, % réserve non atteinte, signal principal), cliquable pour ouvrir
  le détail — indépendante du filtre actif ;
- des **tendances semaine vs semaine** (flèches ↑/↓) sur le NPS et le KPI de réserve,
  calculées en comparant les 7 derniers jours aux 7 jours précédents (repris du calcul
  `splitByRecency` déjà existant, étendu au nouveau KPI) ;
- un bloc **« Prix de réserve »** : distribution de `freq_reserve_non_atteinte`, et pour
  les vendeurs un **croisement origine × fréquence d'échec** (barres comparatives
  « fixé par le vendeur » vs « recommandé par Auctelia »), calculé uniquement sur les
  répondants ayant `a_mis_reserve = oui` ;
- des **encarts "Ce que ça dit"** — la corrélation NPS et le croisement origine × fréquence
  sont traduits en une phrase, pas seulement montrés en graphique ;
- pour le churn, un classement de `raisons_arret` (sélection multiple, tally) au lieu
  d'un simple comptage mono-select.

## 9. Diffusion

- 4 liens dédiés dans Mailchimp/CRM (2 existants + 2 nouveaux pour les variantes churn),
  suivant le même schéma d'URL que l'existant (`?lang=`, `?utm_source=`/`?source=`).
- Campagne churn : objet d'email distinct (ex. *« On a remarqué votre absence — 2 min pour
  nous dire pourquoi »*), envoyée uniquement au segment CRM extrait comme churn.
- `vercel.json` : rewrites `/acheteurs-churn` et `/vendeurs-churn` ajoutés, sur le même
  modèle que les routes existantes.

## 10. Hors scope

- Croisement identité ↔ données comportementales de plateforme (refusé pour préserver
  l'anonymat et la franchise des réponses).
- Enquête ciblant les inscrits jamais activés (problème d'onboarding/activation, distinct
  de la spirale prix de réserve étudiée ici).
- Version longue du questionnaire churn (le format court a été explicitement demandé pour
  toutes les variantes).

## 11. Limites connues

- Les questions de fréquence (`freq_reserve_non_atteinte`) reposent sur un rappel déclaré,
  pas sur un comptage réel — risque de biais de mémoire, atténué par le fait qu'on ne
  demande pas un chiffre exact mais une fréquence qualitative.
- Sans croisement avec les données de plateforme, on ne peut pas distinguer un biais de
  perception d'une fréquence réelle élevée — le résultat de l'enquête doit être lu comme
  un signal à confirmer avec les données internes d'enchères (taux réel de lots non vendus
  faute de réserve atteinte sur la même période), pas comme une preuve autosuffisante.
