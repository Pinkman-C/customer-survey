# Refonte des enquêtes de satisfaction Auctelia — identifier la cause du déclin acheteurs/vendeurs

**Date** : 2026-07-09
**Repo** : `Pinkman-C/customer-survey`
**Statut** : validé en brainstorming, prêt pour plan d'implémentation

## 1. Contexte et problème

Auctelia perd des acheteurs et des vendeurs depuis 4 ans, dans une dynamique en spirale :
moins d'acheteurs → moins d'enchérisseurs par lot → moins de prix de réserve atteints →
vendeurs moins satisfaits → moins de nouveaux lots → moins d'acheteurs. L'hypothèse de
David (fondateur) : l'augmentation du nombre de lots avec prix de réserve est le nœud —
elle frustre les acheteurs qui enchérissent sans que le lot soit finalement vendu, ce qui
les décourage de revenir.

Les deux enquêtes existantes (`acheteurs.html`, `vendeurs.html`) ont déjà été corrigées
une fois sur le plan méthodologique (voir `FEEDBACK.md` : segments MECE, skip logic,
échelles CES cohérentes, anti-biais checkbox avec `shuffle`/`anchors`). Mais elles ont
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
- **Longueur** : format court partout (~6-8 questions, ~2 min), pas de version longue pour
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

## 4. Questionnaire — Acheteurs actifs (`acheteurs.html`)

Cible : a enchéri dans les 12 derniers mois. 8 questions.

| # | Champ | Question (FR) | Type | Changement |
|---|---|---|---|---|
| 1 | `segment` | Quelle situation vous correspond ? (3 achats ou plus / 1 à 2 achats) | radio | inchangé |
| 2 | `nps` | Recommandation (0-10) | nps | inchangé |
| 3 | `csat_confiance` | Confiance dans les transactions sécurisées | stars | inchangé |
| 4 | `csat_descriptions` | Correspondance description/matériel reçu | stars | inchangé |
| 5 | `ces_enlevement` | Facilité d'enlèvement après adjudication | ces | inchangé |
| 6 | `freq_reserve_non_atteinte` | **[NOUVEAU]** *« Ces 12 derniers mois, combien de fois avez-vous enchéri sur un lot où le prix de réserve n'a finalement pas été atteint (lot retiré) ? »* — Jamais / Une ou deux fois / Plusieurs fois / Je ne sais pas | radio (fréquence) | remplace la question "appareil utilisé" (retirée — déjà notée à faible valeur dans `FEEDBACK.md`, doublon du `user_agent` déjà collecté) |
| 7 | `freins` | Freins à enchérir davantage (checkbox, options mélangées, `prix_reserve_eleve` reste une option parmi d'autres) | checkbox | inchangé |
| 8 | `verbatim` | Qu'est-ce qu'Auctelia pourrait améliorer ? | textarea | inchangé |

**Logique anti-biais** : Q6 est posée en amont de Q7, formulée comme un simple comptage
factuel (« combien de fois »), sans qualificatif de frustration ni jugement — elle ne
suggère pas que rater une réserve est un problème. Q7 garde `prix_reserve_eleve` diluée
parmi 7 autres options mélangées. Si les répondants "plusieurs fois" à Q6 cochent aussi
massivement cette option en Q7, la corrélation devient un signal auto-porté par les
données, jamais suggéré par la question elle-même.

## 5. Questionnaire — Acheteurs churn (`acheteurs-churn.html`, nouveau)

Cible : a acheté au moins une fois, aucun achat depuis 12 mois. 6 questions, au passé.

| # | Champ | Question (FR) | Type |
|---|---|---|---|
| 1 | `segment` | *« Avant d'arrêter, à quelle fréquence achetiez-vous sur Auctelia ? »* — Régulièrement / Occasionnellement / Une seule fois | radio |
| 2 | `nps` | Recommandation (0-10) — inchangé dans la formulation | nps |
| 3 | `raison_arret` | **[NOUVEAU]** *« Qu'est-ce qui décrit le mieux la raison pour laquelle vous n'avez plus acheté récemment ? »* (une seule réponse, options mélangées, ancres "aucune raison particulière"/"autre") — pas trouvé de lots intéressants / prix de réserve trop souvent hors budget ou non atteints / mauvaise expérience (litige, annulation, déception) / plus besoin de ce type de matériel / alternative trouvée / aucune raison particulière / autre | radio (mono-select) |
| 4 | `freq_reserve_non_atteinte` | *« Repensez à vos achats sur Auctelia : à quelle fréquence avez-vous enchéri sur un lot dont le prix de réserve n'a finalement pas été atteint ? »* — même échelle qu'en Q6 actifs, champ réutilisé | radio (fréquence) |
| 5 | `leviers_retour` | **[NOUVEAU]** *« Qu'est-ce qui vous ferait reconsidérer Auctelia aujourd'hui ? »* (checkbox, tourné vers l'avenir) — plus de lots pertinents / prix de réserve plus réalistes / meilleure communication sur les nouveaux lots / enlèvement plus simple / frais réduits / rien, je ne prévois pas de revenir / autre | checkbox |
| 6 | `verbatim` | *« Qu'est-ce qui vous ferait revenir — ou qu'est-ce qui vous en empêche définitivement ? »* | textarea |

**Pourquoi Q4 est posée à tous, pas seulement si Q3 = prix de réserve** : quelqu'un peut
citer une autre raison principale (ex. "pas trouvé de lots intéressants") tout en ayant
aussi vécu des réserves ratées comme frustration secondaire. Poser la question à tous
préserve le signal de corrélation pour le dashboard.

Pas de CSAT confiance ni de CES enlèvement dans cette variante : ces échelles perdent leur
fiabilité sur un souvenir ancien et non récurrent — mieux vaut les omettre que produire une
donnée bruitée.

## 6. Questionnaire — Vendeurs actifs (`vendeurs.html`)

Cible : a vendu dans les 12 derniers mois. 8 questions.

| # | Champ | Question (FR) | Type | Changement |
|---|---|---|---|---|
| 1 | `segment` | Plusieurs ventes / Une seule vente — l'option "dernière vente il y a plus d'un an" est retirée (va au formulaire churn) | radio | modifié |
| 2 | `nps` | Recommandation (0-10) | nps | inchangé |
| 3 | `csat_prix` | Satisfaction prix de vente vs attentes | stars | inchangé |
| 4 | `ces_facilite` | Facilité de mise en vente | ces | inchangé |
| 5 | `origine_prix_reserve` | **[NOUVEAU]** *« Sur vos derniers lots mis en vente, comment le prix de réserve a-t-il été déterminé ? »* — je l'ai fixé moi-même selon mes attentes / sur recommandation de mon interlocuteur Auctelia / j
| 6 | `freq_reserve_non_atteinte` | **[NOUVEAU]** *« Sur vos derniers lots, à quelle fréquence le prix de réserve n'a-t-il pas été atteint ? »* — Jamais / Parfois / Souvent / Je ne sais pas | radio (fréquence) | nouveau |
| 7 | `intention_retour` | Envisagez-vous de faire appel à Auctelia pour une prochaine vente ? | radio | inchangé |
| 8 | `verbatim` | Qu'est-ce qui vous ferait revenir — ou vous en empêche ? | textarea | inchangé |

**Retiré** : `csat_suivi` (qualité du suivi commercial) et `concurrence` (plateformes
concurrentes utilisées), pour garder 8 questions malgré les 2 ajouts. Ce sont des
questions utiles pour d'autres besoins (pilotage commercial, veille concurrentielle) mais
pas centrales à la question actuelle. Les colonnes Google Sheets correspondantes restent
en place pour l'historique, simplement plus alimentées après la bascule. Réversible
facilement en phase d'implémentation si un format à 9-10 questions est préféré pour les
garder.

**Croisement clé permis par Q5 × Q6** : si les réserves fixées "sur recommandation
Auctelia" ratent significativement plus souvent que celles fixées par le vendeur
lui-même, c'est un signal direct que la politique interne de recommandation de prix de
réserve — pas seulement le marché — pousse le taux d'échec.

## 7. Questionnaire — Vendeurs churn (`vendeurs-churn.html`, nouveau)

Cible : a vendu au moins une fois, aucune vente depuis 12 mois. 7 questions, au passé.

| # | Champ | Question (FR) | Type |
|---|---|---|---|
| 1 | `segment` | *« Avant d'arrêter, quelle était votre activité de vente sur Auctelia ? »* — Plusieurs ventes régulières / Une vente occasionnelle / Une seule vente au total | radio |
| 2 | `nps` | Recommandation (0-10) | nps |
| 3 | `raison_arret` | **[NOUVEAU]** *« Qu'est-ce qui décrit le mieux la raison po(logistique, photos) / alternative trouvée (autre plateforme, vente directe) / plus de matériel à vendre actuellement / aucune raison particulière / autre | radio (mono-select) |
| 4 | `freq_reserve_non_atteinte` | *« Repensez à vos ventes : à quelle fréquence le prix de réserve n'a-t-il pas été atteint ? »* — champ réutilisé de Q6 actifs | radio (fréquence) |
| 5 | `origine_prix_reserve` | Même question que Q5 actifs, au passé — champ réutilisé | radio |
| 6 | `leviers_retour` | **[NOUVEAU]** *« Qu'est-ce qui vous ferait remettre du matériel en vente ? »* (checkbox) — prix de réserve plus réalistes / meilleur accompagnement / processus plus simple / plus de visibilité sur mes lots / rien, je ne prévois pas de revendre / autre | checkbox |
| 7 | `verbatim` | Qu'est-ce qui vous ferait revenir — ou qu'est-ce qui vous en empêche définitivement ? | textarea |

## 8. Schéma de données (Google Sheets)

**Onglet `Acheteurs`** — colonnes ajoutées : `audience`, `freq_reserve_non_atteinte`
(alimentée par les 2 variantes), `raison_arret` (churn uniquement, vide côté actifs),
`leviers_retour` (churn uniquement, vide côté actifs). Colonne retirée du flux actif :
aucune (la question "appareil" est retirée mais sa colonne `usage_mobile` peut être laissée
vide plutôt que supprimée, pour ne pas décaler l'historique).

**Onglet `Vendeurs`** — colonnes ajoutées : `audience`, `origine_prix_reserve`,
`freq_reserve_non_atteinte` (alimentées par les 2 variantes), `raison_arret` et
`leviers_retour` (churn uniquement). Colonnes qui cessent d'être alimentées côté actif
(mais conservées pour l'historique) : `csat_suivi`, `concurrence`, `concurrence_order`.

Le dashboard (`assets/dashboard.js`) doit :
- exclure les cellules vides des moyennes (déjà le comportement existant pour les skips) ;
- ajouter un filtre global `audience` (actif/churn) applicable à tous les graphiques
  existants (NPS, CSAT, CES) — permet de voir si le NPS des churned est réellement plus
  bas, ou si les gens partent malgré un score correct (ce qui orienterait vers une cause
  structurelle plutôt qu'un pur problème de satisfaction déclarée) ;
- ajouter un bloc « Prix de réserve » : distribution de `freq_reserve_non_atteinte`
  (acheteurs et vendeurs séparément) + corrélation NPS déjà existante étendue à ce champ ;
- ajouter côté vendeurs un croisement `origine_prix_reserve` × `freq_reserve_non_atteinte` ;
- ajouter une répartition en barres de `raison_arret` (churn, les deux enquêtes),
  classée par fréquence décroissante — la vue la plus directe de "pourquoi les gens
  partent".

## 9. Diffusion

- 4 liens dédiés dans Mailchimp/CRM (2 existants + 2 nouveaux pour les variantes churn),
  suivant le même schéma d'URL que l'existant (`?lang=`, `?utm_source=`/`?source=`).
- Campagne churn : objet d'email distinct (ex. *« On a remarqué votre absence — 2 min pour
  nous dire pourquoi »*), envoyée uniquement au segment CRM extrait comme churn.
- `vercel.json` : ajouter les rewrites pour `/acheteurs-churn` et `/vendeurs-churn`, sur le
  même modèle que les routes existantes.

## 10. Hors scope

- Croisement identité ↔ données comportementales de plateforme (refusé pour préserver
  l'anonymat et la franchise des réponses).
  de la spirale prix de réserve étudiée ici).
- Version longue du questionnaire churn (le format court a été explicitement demandé pour
  toutes les variantes).

## 11. Limites connues

- Les questions de fréquence (`freq_reserve_non_atteinte`) reposent sur un rappel déclaré,
  pas sur un comptage réel — risque de biais de mémoire, atténué par le fait qu'on ne
  demande pas un chiffre exact mais une fréquence qualitative (Jamais/Parfois/Souvent).
- Sans croisement avec les données de plateforme, on ne peut pas distinguer un biais de
  perception ("j'ai l'impression que ça arrive souvent") d'une fréquence réelle élevée —
  le résultat de l'enquête doit être lu comme un signal à confirmer avec les données
  internes d'enchères (taux réel de lots non vendus faute de réserve atteinte sur la même
  période), pas comme une preuve autosuffisante.

Relisez-le et dites-moi si vous voulez ajuster quelque chose (ex. le compromis "on retire csat_suivi/concurrence" section 6, ou toute formulation) avant qu'on passe au plan d'implémentation détaillé.


Je ne peux pas déclencher /login moi-même — c'est une commande côté client qui ouvre un flux d'authentification dans votre navigateur (OAuth GitHub), donc ça doit venir de vous. Je n'ai pas d'outil pour lancer ça de mon côté.

Ce que je peux faire : retenter la création de branche/fichier dès que vous me dites que le login est refait. Voulez-vous relancer /login maintenant ?

✻ Cogitated for 8s

> /login
  ⎿  Login successful

> as-tu accès mnt ?

  Called plugin:github:github

Toujours le même 403 après le nouveau login. Ça indique que ce n'est probablement pas un problème de session expirée, mais un vrai manque de scope sur le token/l'app GitHub connectée à cette intégration — le /login réauthentifie la session Claude, mais si l'app GitHub installée sur le repo n'a que la permission "Contents: Read", relogin ne suffit pas ; il faut aller dans les paramètres de l'intégration GitHub (côté GitHub App / OAuth App installée sur Pinkman-C/customer-survey) et changer la permission en lecture-écriture, potentiellement en désinstallant/réinstallant l'app avec les bons scopes.

On ne bloque pas dessus — le spec complet a déjà été fourni dans mon message précédent, prêt à copier-coller dans le repo. Voulez-vous qu'on avance directement sur le plan d'implémentation (skill writing-plans) pendant que vous réglez l'accès en écriture de votre côté ?


Correct — sans droits d'écriture, je ne peux pas committer directement sur GitHub via cette intégration (create_or_update_file, create_branch, etc. resteront en 403 tant que ce n'est pas réglé).

Il y a trois façons de quand même arriver à un résultat concret :

1. Vous corrigez les droits de l'app GitHub (dans GitHub → Settings → Applications → l'app/l'installation liée à Claude → permissions du repo customer-survey → passer "Contents" en Read & write). Une fois fait, je peux créer branche + fichiers + PR directement.
2. Je clone le repo en local (si vous me donnez un dossier de travail, ou qu'on clone via git clone avec vos credentials git configurées sur cette machine) — je travaille dans un vrai dossier de projet, je fais les commits localement, et vous faites le git push (ou je le fais si votre git local a déjà les credentials qui autorisent l'écriture — à tester).
3. Je vous donne tout le contenu (fichiers HTML complets, diffs, JS) et vous les collez/committez vous-même sur GitHub — le plus lent mais zéro dépendance sur les permissions.

Étant donné que ce PC (C:\WINDOWS\system32) n'est pas un clone du repo, l'option 2 demanderait d'abord un git clone local. Qu'est-ce que vous préférez ?

● User answered Claude's questions:
· Comment veux-tu qu'on procède pour appliquer les changements une fois le plapratique que je veux encourager.

L'intégration GitHub que j'utilise ici (mcp__plugin_github_github__*) n'est pas configurée avec un token perso que vous géreriez à la main — elle passe par une connexion GitHub App/OAuth gérée dans les paramètres de l'outil GitHub de Claude (pas un champ où coller un PAT). Le 403 signifie que cette connexion-là n'a pas (encore) les droits d'écriture sur Pinkman-C/customer-survey, même si vous avez donné les accès ailleurs.

Deux pistes fiables sans passer par un token en clair :

1. Vérifiez dans GitHub → Settings → Applications → Installed GitHub Apps qu'il y a bien une app du type "Claude" ou "Anthropic" installée avec accès à customer-survey, et que sa permission "Repository contents" est sur Read & write (pas juste "Read"). Souvent ça se règle en cliquant sur l'app → "Configure" → cocher le repo et le niveau d'accès → Save.
2. Si l'app n'apparaît pas du tout dans cette liste, c'est qu'elle n'a jamais été installée correctement sur ce repo précis — il faut la (ré)installer depuis le marketplace/paramètres d'intégration de Claude Code, pas depuis un token GitHub personnel.

Voulez-vous aller vérifier ce point précis (App installée + permission repo), et je retente juste après ?


> att on va tenter de refaire login pour github voir si tu sais pas le faire solo?

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
  demande pas un chiffre exact mais une fréquence qualitative (Jamais/Parfois/Souvent).
- Sans croisement avec les données de plateforme, on ne peut pas distinguer un biais de
  perception ("j'ai l'impression que ça arrive souvent") d'une fréquence réelle élevée —
  le résultat de l'enquête doit être lu comme un signal à confirmer avec les données
  internes d'enchères (taux réel de lots non vendus faute de réserve atteinte sur la même
  période), pas comme une preuve autosuffisante.
