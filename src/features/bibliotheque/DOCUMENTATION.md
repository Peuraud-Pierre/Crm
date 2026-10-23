# Documentation — Feature Bibliothèque de réponses

Ce document est écrit pour être compréhensible même par quelqu'un qui débute en programmation : chaque terme technique un peu spécialisé est expliqué la première fois qu'il apparaît.

---

## 1. Logique métier

La **Bibliothèque de réponses** est un outil interne permettant aux équipes de gérer un catalogue centralisé de questions fréquentes et de leurs réponses officielles, disponible en **français et en anglais**.

L'objectif est de donner aux collaborateurs un référentiel unique où ils peuvent :
- retrouver rapidement une réponse validée à une question client courante,
- copier cette réponse dans le format adapté au canal de communication utilisé (email formel, message Instagram, WhatsApp),
- garder une cohérence de discours entre tous les collaborateurs, quel que soit qui répond au client.

### Organisation du contenu

- Le contenu est classé en **thématiques** (ex : "Délais de livraison", "Retours & échanges"). Chaque thématique peut avoir un nom, une image d'illustration et une icône (les deux optionnelles).
- Chaque thématique contient une liste de **paires Question / Réponse** ("Q&R").
- Un **brief global** unique (les règles de communication à respecter, appelées "Règles d'or") et des **chiffres de référence** sont communs à TOUTE la Bibliothèque — ils ne sont pas répétés par thématique. Ils s'affichent dans le panneau de droite quand aucune thématique n'est sélectionnée.
- Pour chaque Q&R, il est possible de stocker trois versions du texte de réponse, adaptées au ton et au format de chaque canal :
  - **Email** — formel, structuré, formules de politesse
  - **DM Instagram** — ton complice, court, vivant
  - **WhatsApp** — direct, orienté action

### Qui peut faire quoi

- **Lecture** (voir les thématiques, Q&R, brief, formats) : tout utilisateur authentifié possédant la permission `bibliotheque.view`.
- **Écriture** (créer/modifier/supprimer du contenu) : réservée au service **Tech**, via la permission `bibliotheque.manage` (voir §5 "Système de permissions").

---

## 2. Fonctionnalités

### Gestion des thématiques
- Créer une thématique (nom FR + EN, image d'illustration et icône SVG optionnelles)
- Renommer une thématique — l'image et l'icône associées sont automatiquement renommées dans le stockage pour rester synchronisées avec le nouveau nom
- Supprimer une thématique (avec avertissement si des Q&R y sont rattachées : elles seront supprimées en cascade, ainsi que leurs formats de réponse)

### Brief global et chiffres de référence
- Modifier le brief global "Règles d'or" (FR + EN) — commun à toute la Bibliothèque
- Modifier les chiffres de référence (FR + EN)
- Affichés dans le panneau de droite quand aucune thématique n'est sélectionnée

### Gestion des Q&R
- Ajouter une question/réponse à une thématique (FR + EN)
- Modifier une Q&R existante, y compris la réaffecter à une autre thématique
- Supprimer une Q&R

### Formats de réponse
- Créer ou modifier la version Email, DM Instagram et WhatsApp d'une réponse (FR + EN, 6 champs au total)
- Copier en un clic la version souhaitée dans le presse-papier, avec confirmation visuelle temporaire

### Recherche
- Recherche en temps réel (avec un léger délai d'attente, voir §4) sur les noms de thématiques, les questions et les réponses
- Les résultats sont groupés par thématique
- Les termes trouvés sont surlignés dans les résultats
- Cliquer sur une thématique dans les résultats y navigue directement ; cliquer sur une Q&R affiche son détail complet sans quitter la recherche

### Internationalisation
- Toute l'interface bascule entre **Français** et **Anglais** via un sélecteur en haut de page (`BiblioToolbar`), accessible au clavier (navigation par flèches, norme ARIA "radiogroup")
- Le panneau des réponses formatées (`FormatPanel`) porte son propre sélecteur FR/EN local, indépendant de celui de la barre supérieure : il permet de consulter/copier une réponse dans l'autre langue sans changer la langue de toute l'interface. Les deux sélecteurs partagent le même composant (`LangToggle`, voir §3 et §4)
- Tous les contenus (thématiques, questions, réponses, brief, chiffres, formats) sont stockés en double en base — une colonne FR et une colonne EN pour chaque champ traduisible

### Collaboration en temps réel
- Si un collaborateur modifie une thématique, une Q&R, un format ou le brief depuis son poste, tous les autres utilisateurs qui ont la page ouverte voient la mise à jour apparaître automatiquement, sans recharger la page

### Robustesse face aux erreurs
- Un écran dédié s'affiche si le chargement initial échoue (panne réseau, erreur Supabase), avec un bouton "Réessayer", plutôt que de laisser la page vide ou bloquée.
- Si un bug de rendu imprévu survient dans un composant de la feature, un "filet de sécurité" (`BiblioErrorBoundary`, voir §3) affiche un message d'erreur localisé avec un bouton "Réessayer" au lieu de faire planter toute l'application.

---

## 3. Structure exhaustive des dossiers et fichiers

Cette section liste **chaque fichier** du dossier `src/features/bibliotheque/`, avec son utilité précise. Les fichiers `*.test.ts(x)` sont des fichiers de test (ils ne font pas partie de l'application livrée aux utilisateurs, ils vérifient automatiquement que le code fonctionne) — voir §7 pour ce qu'ils vérifient concrètement.

### Racine de la feature

| Fichier | Utilité |
|---|---|
| `DOCUMENTATION.md` | Ce document. |
| `index.ts` | **Point d'entrée officiel** de la feature pour le reste du projet : liste tout ce que la Bibliothèque expose publiquement (le composant `Bibliotheque` et les types métier). Un fichier extérieur à la feature ne doit importer QUE depuis ce fichier (`@/features/bibliotheque`), jamais directement un fichier interne (`services/`, `hooks/`, `context/`) — cela garantit que les détails internes peuvent changer sans casser le reste du projet. |
| `types.ts` | Définit tous les types TypeScript de la feature (`Thematique`, `QR`, `Brief`, `Lang`, `FormatChannel`, `FormatMap`, `SearchGroup`, `QRContent`). Un "type" décrit la forme attendue d'une donnée (quels champs, quel genre de valeur) ; TypeScript vérifie au moment de l'écriture du code, avant même de l'exécuter, que ces formes sont respectées partout. C'est le "dictionnaire" commun : changer un type ici se répercute automatiquement partout où il est utilisé, et TypeScript signale immédiatement tout endroit devenu incohérent. |
| `constants.ts` | Centralise tous les textes affichés à l'écran, en français ET en anglais (`UI_TEXT`), ainsi que les libellés des canaux de format (`FORMAT_LABELS`) et la liste de leurs clés (`FORMAT_CHANNELS`). Objectif : éviter les "chaînes magiques" (du texte écrit en dur un peu partout dans le code) éparpillées, qu'on oublierait de mettre à jour partout en cas de changement. |
| `utils.tsx` | Fonctions pures (une fonction "pure" est une fonction qui, pour les mêmes entrées, renvoie toujours la même sortie et ne modifie rien en dehors d'elle-même — donc facile à tester) réutilisées dans toute la feature : `highlight()` (surligne un terme cherché), `tLabel`/`tQuestion`/`tReponse`/`tFormat` (extraient un champ dans la langue active), `slugify()` (dérive un nom de fichier Storage à partir d'un nom de thématique), `hasUnsafeSvgContent()` (vérification anti-XSS avant upload d'une icône SVG — XSS = une faille de sécurité où du code malveillant caché dans un contenu utilisateur s'exécuterait dans le navigateur d'un autre utilisateur). Extension `.tsx` (et non `.ts`) car `highlight()` retourne du JSX (la syntaxe qui ressemble à du HTML dans du code React, ici la balise `<mark>`). |
| `utils.test.tsx` | Teste les fonctions de `utils.tsx` : surlignage (cas normal, insensible à la casse, caractères spéciaux échappés), extraction bilingue, normalisation de nom de fichier. |
| `imageResize.ts` | Redimensionne, côté navigateur (donc AVANT l'envoi au serveur), l'image d'illustration d'une thématique si elle est trop grande, pour ne jamais stocker en ligne une image inutilement lourde. Utilise des fonctionnalités du navigateur (`createImageBitmap`, un `<canvas>` — une zone de dessin invisible utilisée ici uniquement pour recalculer les pixels de l'image) plutôt qu'une bibliothèque externe. Isolé de `utils.tsx` car ces fonctions du navigateur sont asynchrones (elles prennent du temps et ne bloquent pas le reste du programme pendant qu'elles s'exécutent, d'où le mot-clé `async`/`await` dans le code) et absentes de l'environnement simulé utilisé pour les tests automatiques. |
| `imageResize.test.ts` | Teste le calcul du redimensionnement (conservation du ratio, pas d'agrandissement d'une image déjà petite, conservation du nom de fichier) en simulant les fonctions du navigateur. |

### `services/` — accès aux données (Supabase)

Seuls les fichiers de ce dossier ont le droit d'appeler Supabase directement (règle du projet, voir `CLAUDE.md` "couche service obligatoire"). Aucun composant ni aucun hook n'importe `@/integrations/supabase/client` en dehors de ce dossier. (Supabase est le service en ligne qui héberge la base de données et le stockage de fichiers de tout le projet — voir §6.)

| Fichier | Utilité |
|---|---|
| `mappers.ts` | Convertit les lignes brutes renvoyées par Supabase (colonnes en `snake_case`, c'est-à-dire `nom_avec_underscores`, avec des valeurs parfois `null` c'est-à-dire "absentes") en objets métier propres (`camelCase`, c'est-à-dire `nomSansEspace`, jamais `null`). Contient aussi `TABLE_NAMES`, qui centralise les noms exacts des 4 tables SQL pour éviter les fautes de frappe. |
| `mappers.test.ts` | Teste les 4 fonctions de conversion (`mapThematique`, `mapQR`, `mapFormatRow`, `mapBriefRow`), notamment le remplacement des valeurs `null` par des chaînes vides. |
| `db.ts` | Client Supabase re-typé "à la main" pour les 4 tables de la feature, en attendant que la génération automatique de types (`supabase gen types`) produise un schéma à jour. Porte un `TODO` explicite décrivant les étapes de sa propre suppression. Déclare aussi 6 schémas de validation runtime **zod** (`thematiqueRowSchema`, `qrRowSchema`, `formatRowSchema`, `briefRowSchema`, `rowIdSchema`, `formatRowOldSchema`) : un type TypeScript garantit une forme uniquement à la compilation, pas à l'exécution — ces schémas vérifient réellement, au moment où la donnée arrive (payload Supabase Realtime), qu'elle a bien les champs attendus, utilisés par `useBiblioRealtime.ts` (voir plus bas). |
| `db.test.ts` | Ne teste pas une fonctionnalité, mais **surveille la dette technique** de `db.ts` : des assertions de type qui ne compilent plus le jour où les types générés rattrapent le schéma réel — forçant alors à traiter la suppression de `db.ts` comme une décision volontaire plutôt qu'un oubli. |
| `errors.ts` | Définit `BibliothequeServiceError`, un type d'erreur unique utilisé par tout le reste de `services/` pour envelopper les erreurs renvoyées par Supabase. Sans ce type commun, un appelant ne pourrait pas savoir facilement si une erreur vient "de cette couche service" ou d'ailleurs dans le code. `throwIfError()` est un petit raccourci qui lève cette erreur uniquement si une valeur d'erreur a effectivement été fournie. |
| `errors.test.ts` | Teste la construction du message d'erreur et le comportement de `throwIfError` (ne lève rien si `error` est `null`/absent, lève sinon). |
| `bibliothequeService.ts` | CRUD (Create/Read/Update/Delete — les 4 opérations de base sur des données : créer, lire, modifier, supprimer) des 4 tables (thématiques, Q&R, formats, brief global) : charger toutes les données au démarrage, créer/modifier/supprimer une ligne. Contient aussi la boucle de retry (nouvelle tentative automatique, `insertThematiqueWithMediaRetry`, `patchThematiqueWithMediaRetry`) qui réagit à un conflit de chemin média détecté par la base (voir §6 "Anti-collision des médias"). Réexporte les fonctions de `bibliothequeMediaService.ts` pour que `useBibli.ts` n'ait besoin que d'un seul import. |
| `bibliothequeService.test.ts` | Teste le chargement initial (y compris la gestion du code d'erreur Supabase `PGRST116` quand le brief n'existe pas encore), le CRUD simple des thématiques/Q&R/formats/brief, et la boucle de retry sur conflit média. |
| `bibliothequeMediaService.ts` | Tout ce qui touche au bucket Supabase Storage `bibliotheque` (un "bucket" est un espace de stockage de fichiers, comme un dossier partagé en ligne) : téléverser l'image/l'icône d'une thématique, les renommer quand la thématique est renommée, les supprimer, résoudre un chemin stocké en base en URL affichable. |
| `bibliothequeMediaService.test.ts` | Teste l'upload (dérivation du nom de fichier, anti-collision, gestion des extensions), le renommage best-effort, la suppression, et la résolution d'URL. |
| `bibliothequeMediaConflict.ts` | Détection et correction d'un conflit de chemin détecté au niveau base (`detectMediaConflict`, `relocateThematiqueMedia`) — extrait de `bibliothequeMediaService.ts` qui approchait à nouveau le seuil de 400 lignes (`Architecture_Feature.pdf` §15). Importé directement par `bibliothequeService.ts` (`import * as mediaConflict`), pas via `bibliothequeMediaService.ts`. |
| `bibliothequeMediaConflict.test.ts` | Teste les deux fonctions de détection/correction de conflit ajoutées pour l'anti-collision atomique (index UNIQUE partiels en base). |
| `mediaSlug.ts` | Helpers bas niveau de génération/vérification de slug de fichier (`BIBLIOTHEQUE_BUCKET`, `sanitizeExt`, `extractExt`, `findFreeSlugBatched`), partagés par `bibliothequeMediaService.ts` et `bibliothequeMediaConflict.ts` — extraits dans un troisième fichier neutre pour que ces deux derniers n'aient pas à s'importer l'un l'autre (ce qui créerait une dépendance circulaire). |

### `hooks/` — logique côté React

Un "hook" est une fonction spéciale de React (son nom commence toujours par `use`) qui permet à un composant de "se souvenir" de valeurs entre deux affichages (état) ou de déclencher des actions au bon moment (effets). Séparer la logique dans des hooks, plutôt que de tout écrire directement dans les composants visuels, permet de la tester et de la réutiliser indépendamment de l'affichage.

| Fichier | Utilité |
|---|---|
| `useDialog.ts` | Mémorise quelle fenêtre modale (dialog — une fenêtre qui s'affiche par-dessus le reste de la page) est actuellement ouverte, et avec quelles données (ex : quelle Q&R est en cours de suppression). Ne connaît ni Supabase ni les textes d'interface — une pure machine à états (un système qui n'a, à tout instant, qu'un seul "mode" actif parmi une liste connue à l'avance). |
| `useDialog.test.ts` | Teste l'état initial, chaque fonction d'ouverture (avec ou sans donnée associée), la fermeture, et les transitions entre modes. |
| `useSearch.ts` | Toute la logique de la barre de recherche : texte tapé, délai d'attente de 150ms avant de filtrer ("debounce" : une technique qui attend une courte pause dans la frappe avant de lancer le calcul, pour ne pas relancer un filtrage à chaque caractère tapé), résultats groupés par thématique, Q&R sélectionnée dans les résultats, navigation. |
| `useSearch.test.ts` | Teste l'état initial, le débounce (avec avancée de temps simulée), le filtrage et le regroupement des résultats, la sélection de détail. |
| `useBiblioPage.ts` | Orchestrateur de la page : assemble `useBibli`, `useDialog` et `useSearch`, ajoute les actions de haut niveau (sauvegarder, avec toast d'erreur si Supabase échoue — un "toast" est une petite notification qui apparaît brièvement à l'écran — fermeture du dialog uniquement en cas de succès) et les valeurs calculées (compteur de Q&R par thématique, thématique active, Q&R actives). Retourne un objet structuré en 4 groupes (`data`, `nav`, `dialogs`, `handlers`) consommé par le contexte. |
| `useBiblioPage.test.ts` | Teste chaque handler (fonction qui répond à une action utilisateur) de haut niveau (sauvegarde/suppression de Q&R, thématique, format), en vérifiant le bon enchaînement toast d'erreur / fermeture du dialog selon le résultat. |
| `data/useBibli.ts` | Hook de données central : charge toutes les données au montage (la première fois que le composant apparaît à l'écran) via les services, expose les fonctions CRUD aux composants, et met à jour l'état React de façon **optimiste** (l'écran change avant même que Supabase ait confirmé l'opération, pour une interface qui semble instantanée — si Supabase échoue ensuite, le changement est annulé). Gère aussi le rollback (l'annulation d'un changement local) de position en cas d'échec d'une création concurrente (deux créations en même temps). |
| `data/useBibli.test.ts` | Teste le chargement initial, la création/modification/suppression optimiste de thématiques et de Q&R (y compris les scénarios de concurrence — deux créations simultanées), et le rollback du renommage de média en cas d'échec d'écriture. |
| `data/useBiblioQR.ts` | CRUD des Questions/Réponses et de leurs formats de réponse — extrait de `useBibli.ts` pour rester sous le seuil de 400 lignes fixé par le projet (voir §4). Ne détient aucun état propre (aucun `useState`) : reçoit les fonctions de mise à jour et références de `useBibli.ts` en paramètres. |
| `data/useBiblioQR.test.ts` | Teste `createQR`/`updateQR`/`deleteQR`/`upsertFormat` en isolation (avec des fonctions de mise à jour simulées) : succès, échec de service (retour `false`/`null` + message d'erreur journalisé), et le garde-fou de rollback de position sur `createQR` en cas de création concurrente. |
| `data/useBiblioRealtime.ts` | Écoute les changements faits par D'AUTRES utilisateurs via Supabase Realtime (un canal, 4 tables — "Realtime" est le système de Supabase qui prévient automatiquement l'application quand une donnée change en base, sans que l'application ait besoin de redemander sans arrêt) et met à jour l'état local en conséquence — sans cela, il faudrait recharger la page pour voir leurs modifications. Déclenche aussi le chargement initial une fois l'utilisateur authentifié. Chaque payload reçu est d'abord validé (`parseOrWarn()`, avec les schémas zod de `db.ts`) avant d'être utilisé : un payload dont la forme ne correspond pas à ce qui est attendu (colonne renommée en base, migration non répercutée...) est journalisé puis ignoré plutôt que de propager une donnée potentiellement corrompue dans l'état de l'application — l'événement manqué est de toute façon rattrapable au prochain chargement complet. |
| `data/useBiblioRealtime.test.ts` | Teste la souscription/désouscription au montage/démontage (l'inscription puis la désinscription au canal d'événements), et chaque type d'événement (INSERT/UPDATE/DELETE) sur les 4 tables, y compris un cas de régression corrigé (un bug déjà réparé, qu'on vérifie qu'il ne revient pas — absence de `quest_rep_id` sur un DELETE de format). |

### `context/` — partage d'état

Un "contexte" React (`Context`) permet à des données d'être lues par n'importe quel composant descendant d'un `Provider`, sans avoir à les faire transiter manuellement de composant en composant ("prop drilling").

| Fichier | Utilité |
|---|---|
| `BiblioContext.tsx` | Crée le contexte React de la feature. `BiblioProvider` appelle `useBiblioPage()` une seule fois et distribue le résultat ; `useBiblioContext()` permet à n'importe quel composant de la feature de lire ces données sans que les composants intermédiaires aient à les transmettre en props (les "props" sont les données passées d'un composant parent à un composant enfant). Lève une erreur explicite si utilisé hors d'un `BiblioProvider`. |
| `BiblioContext.test.tsx` | Teste l'erreur hors Provider, et que tous les composants enfants reçoivent bien la même valeur partagée. |

### `components/` — interface

Un "composant" React est un morceau réutilisable d'interface (un bouton, une carte, une fenêtre...), écrit comme une fonction qui retourne du JSX (la syntaxe proche du HTML utilisée dans le code React).

| Fichier | Utilité |
|---|---|
| `BiblioErrorBoundary.tsx` | "Filet de sécurité" qui attrape une erreur de rendu imprévue n'importe où dans la feature (un bug dans un composant, une valeur inattendue) et affiche un message d'erreur avec un bouton "Réessayer", au lieu de faire planter toute l'application. Techniquement, c'est une "Error Boundary" React — un type de composant qui doit obligatoirement être écrit sous forme de classe (et non de fonction, contrairement aux autres composants de cette feature) car c'est la seule façon dont React permette d'attraper ces erreurs. |
| `BiblioErrorBoundary.test.tsx` | Teste l'affichage normal des enfants sans erreur, l'affichage du message de secours quand un enfant lève une erreur, et le bon fonctionnement du bouton "Réessayer". |
| `BiblioToolbar.tsx` | Barre supérieure : sélecteur de langue FR/EN (`LangToggle`) + barre de recherche. |
| `BiblioToolbar.test.tsx` | Teste la sélection de langue, la navigation clavier, la saisie et l'effacement de la recherche. |
| `LangToggle.tsx` | Sélecteur de langue FR/EN réutilisable (groupe de boutons ARIA "radiogroup", navigation clavier par flèches avec "roving tabindex" — seul le bouton actif est atteignable par la touche Tab, les flèches directionnelles déplacent le focus entre les deux). Extrait de `BiblioToolbar.tsx` puis réutilisé par `FormatPanel.tsx` pour son sélecteur local (voir §2 "Internationalisation"), afin de ne pas dupliquer cette logique clavier entre les deux endroits. |
| `LangToggle.test.tsx` | Teste l'état affiché selon la langue active, le clic sur chaque bouton, la navigation clavier (flèches dans les deux sens, et qu'une touche non gérée comme Échap ne déclenche rien), et l'application de la prop `className` (cas d'usage `FormatPanel`). |
| `BiblioSidebar.tsx` | Colonne de gauche : liste des thématiques (bouton "Brief général" + une ligne par thématique via `ThematiqueItem`) + bouton "Nouvelle thématique". |
| `BiblioSidebar.test.tsx` | Teste le rendu de la liste, la sélection d'une thématique ou du brief général, et le déclenchement des actions créer/renommer/supprimer. |
| `BiblioMainColumn.tsx` | Colonne de droite affichée quand une thématique est sélectionnée : en-tête (image + nom + bouton d'ajout) et liste de ses Q&R (`QRCard`), ou état vide avec invitation à créer la première question. |
| `BiblioMainColumn.test.tsx` | Teste l'en-tête, le compteur de Q&R, l'état vide et l'affichage de la liste. |
| `BriefPanel.tsx` | Colonne de droite affichée quand aucune thématique n'est sélectionnée : brief global et chiffres de référence, dans la langue active, avec bouton d'édition. |
| `BriefPanel.test.tsx` | Teste la sélection de la langue affichée, les messages de repli quand le contenu est vide, et les boutons d'édition. |
| `SearchResults.tsx` | Vue affichée dès que la recherche contient du texte : colonne gauche (résultats groupés, cliquables) + colonne droite (`QRDetailPanel`). |
| `SearchResults.test.tsx` | Teste le message "aucun résultat", le compteur total, la navigation vers une thématique vs la sélection d'une Q&R, et l'intégration avec `QRDetailPanel`. |
| `ThematiqueItem.tsx` | Composant pur (aucun contexte, tout en props) représentant une ligne de thématique dans la sidebar : icône, libellé, compteur, boutons Renommer/Supprimer accessibles au clavier même sans survol de la souris. Enveloppé dans `memo()` — `BiblioSidebar` lui transmet `id` + des callbacks à référence stable (`handleRename`/`handleDelete` via `useCallback`) pour que ce mémo soit effectif malgré l'affichage en liste. |
| `ThematiqueItem.test.tsx` | Teste le rendu, l'état actif/inactif, chaque callback (appelé avec l'id de la thématique), et l'accessibilité clavier (ordre de tabulation). |
| `QRCard.tsx` | Carte d'affichage d'une Q&R dans la colonne principale : question, réponse (avec "Voir plus/Voir moins" si le texte déborde, détecté via `ResizeObserver` — un outil du navigateur qui prévient le code quand la taille d'un élément change), bouton "Formater" (ouvre `FormatViewDialog`), boutons Modifier/Supprimer. Composant pur enveloppé dans `memo()` (pas d'appel à `useBiblioContext` en interne) : `canManage`/`lang`/`ui`/callbacks sont transmis en props par `BiblioMainColumn`, avec des callbacks à référence stable (`openEditQR`/`openDeleteQR`/`openViewFormat`), pour que le mémo évite de re-rendre chaque carte à chaque changement de contexte sans rapport. |
| `QRCard.test.tsx` | Teste le rendu, les actions Modifier/Supprimer, et l'ouverture du pop-up Formater (`onViewFormat`), en passant les props directement (composant pur, pas de mock de contexte nécessaire). |
| `QRDetailPanel.tsx` | Colonne de droite de la vue recherche : détail complet de la Q&R sélectionnée, avec surlignage des termes cherchés, fil d'Ariane (rappel du chemin de navigation, ici vers la thématique parente), et boutons Modifier/Supprimer/Formater identiques à `QRCard.tsx` (Modifier/Supprimer réservés à `bibliotheque.manage`). |
| `QRDetailPanel.test.tsx` | Teste le message d'invite sans sélection, l'affichage avec surlignage, la navigation vers la thématique, les actions Modifier/Supprimer/Formater, et leur masquage sans la permission `bibliotheque.manage`. |
| `FormatPanel.tsx` | Onglets de canal (Email/Instagram/WhatsApp) avec zone de texte en lecture seule et bouton Copier (avec confirmation visuelle temporaire). Porte aussi son propre sélecteur `LangToggle` FR/EN local (indépendant de celui de `BiblioToolbar`), pour lire/copier une réponse dans l'autre langue sans changer la langue de toute l'interface. Affiché dans `FormatViewDialog`, qui lui transmet `readOnly` selon la permission `bibliotheque.manage` (`canManage`) — même règle depuis `QRCard` et `QRDetailPanel`. |
| `FormatPanel.test.tsx` | Teste l'état vide, le changement d'onglet, le bouton Modifier (masqué en lecture seule), et la copie (succès et échec du presse-papiers). |
| `FormatToggleButton.tsx` | Petit bouton "Formater" (icône + libellé) qui ouvre `FormatViewDialog` via `openViewFormat`. Extrait pour ne pas dupliquer ce bloc entre `QRCard` et `QRDetailPanel`. |
| `FormatToggleButton.test.tsx` | Teste l'affichage du label et le callback au clic. |
| `FormatViewDialog.tsx` | Pop-up (même mécanisme que les dialogs de création/modification) affichant `FormatPanel` pour la Q&R du dialog courant (`dialog.mode === "view-format"`). Le bouton Modifier de `FormatPanel` (qui ouvre `FormatEditDialog` via `openEditFormat`) est masqué uniquement par la permission `bibliotheque.manage` (`!canManage`). |
| `FormatViewDialog.test.tsx` | Teste la visibilité selon le mode, le contenu (question, réponses formatées), le masquage du bouton Modifier sans la permission `bibliotheque.manage`, et l'appel à `openEditFormat`. |
| `MaskIcon.tsx` | Icône SVG colorisable via CSS mask (une technique CSS où le SVG définit uniquement la forme, une classe Tailwind définit la couleur), pour ne pas avoir à maintenir un fichier SVG par couleur utilisée. Partagée par plusieurs composants (thématiques, canaux de format). |
| `MaskIcon.test.tsx` | Teste que le chemin de l'icône et les classes de couleur transmises en props sont correctement appliqués au rendu. |
| `MediaPickerField.tsx` | Champ réutilisable "choisir un fichier" : un `<input type="file">` invisible, déclenché par un bouton stylé, avec aperçu de l'image/icône déjà choisie et indicateur de chargement pendant l'upload. Utilisé deux fois dans `ThematiqueFormDialog.tsx` (image, icône) — extrait pour ne pas dupliquer cette structure. |
| `MediaPickerField.test.tsx` | Teste le rendu de l'aperçu, l'état de chargement, le déclenchement du sélecteur de fichier au clic, et la désactivation du champ. |
| `mediaUpload.ts` | Logique commune (hors JSX) aux deux champs média de `ThematiqueFormDialog.tsx` : vérifie la taille du fichier, valide son contenu si demandé (ex : anti-XSS pour un SVG), le transforme si besoin (ex : redimensionnement d'image via `imageResize.ts`), puis l'envoie au service d'upload en gérant l'état de chargement et les erreurs. Extrait pour que `ThematiqueFormDialog.tsx` n'ait plus qu'à fournir les particularités propres à chaque champ. |
| `mediaUpload.test.ts` | Teste le rejet d'un fichier trop volumineux, la validation de contenu, la transformation avant upload, et la gestion des erreurs d'upload. |
| `QRFormDialog.tsx` | Fenêtre modale de création/modification d'une Q&R : sélection de la thématique + 4 champs (question/réponse FR et EN). Utilise le composant partagé `DialogSaveFooter` pour son pied de fenêtre (Annuler/Enregistrer). |
| `QRFormDialog.test.tsx` | Teste la visibilité selon le mode, le pré-remplissage, la validation, et la soumission. |
| `DeleteDialogs.tsx` | Fenêtres modales de confirmation de suppression, pour une Q&R (`DeleteQRDialog`) et pour une thématique (`DeleteThematiqueDialog`), avec avertissement de suppression en cascade pour cette dernière. Les deux partagent un composant interne `DeleteConfirmDialog`, qui utilise lui-même le composant partagé `DialogSaveFooter` (variante rouge "destructive") pour son pied de fenêtre. |
| `DeleteDialogs.test.tsx` | Teste la visibilité, le message (avec ou sans avertissement de cascade), la confirmation, l'annulation, et la protection contre la double soumission. |
| `DialogSaveFooter.tsx` | Composant partagé : le pied de fenêtre "Annuler / Action principale avec icône de chargement pendant l'opération", utilisé par les 5 dialogs de formulaire et de suppression de la feature (`QRFormDialog`, `FormatEditDialog`, `ThematiqueFormDialog`, `DeleteConfirmDialog`, `DualTextareaDialog`). Évite de réimplémenter 5 fois le même bloc bouton + icône de chargement ; un prop `variant` bascule sa couleur entre "normal" (bleu, sauvegarde) et "destructive" (rouge, suppression). |
| `DialogSaveFooter.test.tsx` | Teste le clic sur le bouton principal, l'affichage de l'état "en cours" (icône de chargement + libellé dédié), la désactivation du bouton Annuler, et les deux variantes de couleur. |
| `ThematiqueFormDialog.tsx` | Fenêtre modale de création/renommage d'une thématique, avec upload d'image et d'icône : téléversement immédiat au choix du fichier, nettoyage des fichiers abandonnés si l'utilisateur change d'avis ou annule, vérification anti-XSS du contenu SVG. Utilise `MediaPickerField.tsx` (affichage des champs média) et `mediaUpload.ts` (logique d'upload), extraits d'ici pour rester sous le seuil de 400 lignes, ainsi que `DialogSaveFooter` pour son pied de fenêtre. |
| `ThematiqueFormDialog.test.tsx` | Teste la visibilité, le contenu selon le mode, et la validation des champs obligatoires. |
| `ThematiqueFormDialog.upload.test.tsx` | Teste spécifiquement le flux d'upload (taille max, type de fichier, anti-collision). |
| `ThematiqueFormDialog.soumission.test.tsx` | Teste la soumission du formulaire, l'état `isSaving` (indicateur "sauvegarde en cours"), et le blocage de la sélection de média pendant la sauvegarde. |
| `ThematiqueFormDialog.media-cleanup.test.tsx` | Teste le nettoyage des uploads abandonnés (annulation après upload, fermeture bloquée pendant un upload en vol, remplacement d'un média avant validation). |
| `BriefChiffresDialogs.tsx` | Fenêtres modales de modification du brief global (`BriefEditDialog`, les deux langues obligatoires) et des chiffres de référence (`ChiffresEditDialog`, une seule langue suffit), partageant un composant interne `DualTextareaDialog`, qui utilise lui-même `DialogSaveFooter` pour son pied de fenêtre. |
| `BriefChiffresDialogs.test.tsx` | Teste la visibilité, le pré-remplissage, et la règle de validation différente entre les deux dialogs (deux langues obligatoires vs une seule). |
| `FormatEditDialog.tsx` | Fenêtre modale de modification des formats de réponse d'une Q&R : interface à onglets (un par canal), les 6 champs stockés dans un seul objet pour un seul appel de sauvegarde. Utilise `DialogSaveFooter` pour son pied de fenêtre. |
| `FormatEditDialog.test.tsx` | Teste la visibilité, le pré-remplissage, le changement d'onglet, la validation (au moins un champ rempli), et la soumission. |

### `routes/` — point d'entrée

| Fichier | Utilité |
|---|---|
| `Bibliotheque.tsx` | Composant chargé par le routeur de l'application. `Bibliotheque` (export par défaut) enveloppe `BiblioProvider` dans `BiblioErrorBoundary` (le filet de sécurité, voir `components/BiblioErrorBoundary.tsx` ci-dessus) ; `BiblioPage` (composant interne) lit le contexte et gère 4 états d'affichage (chargement / erreur / base vide / interface complète), et positionne tous les dialogs (toujours montés dans le DOM, invisibles tant qu'aucun mode ne correspond). |
| `Bibliotheque.test.tsx` | Teste les 4 états d'affichage, la bascule vers la vue recherche, et le déclenchement des actions depuis chaque état. |

---

## 4. Pourquoi cette organisation de dossiers/fichiers

Cette feature suit la doctrine d'architecture "Vertical Slice / Feature-First" du projet (voir `docs/Architecture_Feature.pdf`, source de vérité — ce qui suit résume les raisons appliquées ici, sans dupliquer ce document). "Vertical Slice" signifie que tout le code d'une fonctionnalité (types, accès aux données, logique, interface) vit dans UN SEUL dossier de feature, plutôt que d'être éclaté par couche technique à travers tout le projet (ex : tous les "services" ensemble, tous les "composants" ensemble) — cela rend une feature facile à comprendre, modifier ou même supprimer d'un bloc.

- **Fondations à la racine (`types.ts`, `constants.ts`, `utils.tsx`, `imageResize.ts`)** : ce sont des briques sans dépendance à React ni à Supabase, utilisées par tout le reste de la feature. Les isoler à la racine signale clairement "ceci est stable et partagé", et les rend triviales à tester (fonctions pures, pas de simulation — "mock" — nécessaire).

- **`index.ts` comme unique porte d'entrée** : plutôt que de laisser n'importe quel fichier du projet importer n'importe quel fichier interne de la feature, un seul fichier (`index.ts`) déclare ce qui est public. Cela permet de réorganiser librement l'intérieur de la feature (renommer un hook, déplacer un composant) sans jamais casser le reste du projet, tant que ce que `index.ts` expose reste stable.

- **Couche `services/` obligatoire et isolée** : c'est une règle non négociable du projet (`CLAUDE.md`) — aucun composant ni hook n'appelle `supabase.from(...)` directement. Objectif : si Supabase est un jour remplacé, ou si une requête doit changer, un seul dossier est concerné, jamais l'interface. Le dossier a lui-même été scindé en plusieurs fichiers (`bibliothequeService.ts` pour le CRUD SQL, `bibliothequeMediaService.ts` pour le stockage de fichiers, `errors.ts` pour le type d'erreur commun, `db.ts`/`mappers.ts` pour le typage et la conversion des données) parce qu'un fichier unique dépasserait vite le seuil de 400 lignes fixé par le projet pour éviter les "god files" (des fichiers surchargés qui mélangent trop de responsabilités différentes) — au-delà, un fichier devient difficile à lire d'un bloc et mélange des responsabilités qui n'ont pas les mêmes risques (une requête SQL simple n'a pas la même complexité qu'une logique anti-collision de fichiers).

- **`hooks/` séparé en plusieurs fichiers à responsabilité unique** : `useDialog` (état des fenêtres modales), `useSearch` (recherche) et `useBibli`/`useBiblioQR`/`useBiblioRealtime` (données + temps réel) pourraient techniquement être un seul hook géant. Les séparer permet de tester chaque logique indépendamment, et surtout d'éviter qu'une modification de la recherche ne risque de casser le CRUD ou l'inverse. Le sous-dossier `hooks/data/` (convention `CLAUDE.md`) regroupe spécifiquement les hooks qui parlent à Supabase (chargement, CRUD Q&R, temps réel), séparés les uns des autres pour ne pas cumuler "chargement initial + CRUD optimiste + abonnement temps réel" dans un seul fichier.

- **`useBiblioPage.ts` comme orchestrateur unique** : plutôt que de faire consommer `useBibli`, `useDialog` et `useSearch` séparément par chaque composant (ce qui multiplierait les points de couplage, c'est-à-dire les dépendances directes entre morceaux de code), un seul hook les assemble et expose une API stable et structurée (`data`/`nav`/`dialogs`/`handlers`). Un composant n'a jamais besoin de savoir COMMENT les données sont chargées, seulement QUOI lire.

- **`context/` pour éviter le prop drilling** : la feature a une vingtaine de composants qui ont tous besoin d'accéder aux mêmes données (langue active, thématique sélectionnée, fonctions d'ouverture de dialog...). Sans contexte, il faudrait les faire transiter en props à travers chaque niveau intermédiaire, même pour des composants qui ne font que les retransmettre sans les utiliser eux-mêmes. Le contexte ne fait qu'exposer `useBiblioPage()` — il ne contient aucune logique propre.

- **`components/` organisé par rôle, pas par "atomic design"** : mise en page (assemblage de la page), éléments (blocs réutilisables), dialogs (fenêtres modales). Ce n'est PAS une hiérarchie atoms/molecules/organisms (une méthode de classement de composants par niveau d'abstraction) — cette organisation-là est réservée au design system partagé du projet (`src/shared/ui`, voir `docs/DESIGN_SYSTEM.md`) ; à l'intérieur d'une feature métier, l'organisation reste par domaine fonctionnel.

- **`BiblioErrorBoundary.tsx` enveloppant `BiblioProvider` dans `routes/Bibliotheque.tsx`** : positionné volontairement AUTOUR du provider (et pas seulement autour des composants d'affichage) pour attraper aussi une éventuelle erreur de rendu qui viendrait du provider lui-même, pas uniquement de ses enfants.

- **Primitifs internes non exportés (`DeleteConfirmDialog`, `DualTextareaDialog`) et composant partagé exporté (`DialogSaveFooter`)** : quand deux dialogs ont une structure quasi identique (ex : suppression Q&R et suppression thématique), le bloc commun est factorisé dans un composant interne au même fichier plutôt que dupliqué — principe DRY ("Don't Repeat Yourself", "ne te répète pas"). Quand ce même motif se répète ENTRE plusieurs fichiers différents (le pied de fenêtre Annuler/Sauvegarder, identique dans 5 dialogs distincts), il est extrait dans son propre fichier exporté (`DialogSaveFooter.tsx`) plutôt que dupliqué fichier par fichier — la limite entre "composant interne au fichier" et "composant partagé exporté" est simplement la portée de la duplication qu'on cherche à éviter.

- **`LangToggle.tsx` extrait de `BiblioToolbar.tsx`** : même principe DRY que `DialogSaveFooter.tsx` ci-dessus — le sélecteur FR/EN (avec sa navigation clavier ARIA "radiogroup") était initialement écrit uniquement dans `BiblioToolbar.tsx` ; quand `FormatPanel.tsx` a eu besoin du même sélecteur pour sa bascule de langue locale (voir §2), la logique a été extraite dans son propre composant plutôt que recopiée une seconde fois.

- **`MediaPickerField.tsx` et `mediaUpload.ts` extraits de `ThematiqueFormDialog.tsx`** : ce dialog gère un formulaire complexe (deux champs texte + deux champs média avec upload, aperçu, état de chargement, nettoyage). Pour rester sous le seuil de 400 lignes du projet, l'affichage du champ média (JSX) a été extrait dans `MediaPickerField.tsx`, et sa logique d'upload (vérifications, transformation, appel réseau) dans `mediaUpload.ts` — chacun reste testable et lisible séparément.

- **Tests colocalisés (`Fichier.tsx` + `Fichier.test.tsx` dans le même dossier)**, plutôt qu'un dossier `__tests__/` séparé : en ouvrant un dossier, on voit immédiatement si un fichier a des tests, et le test reste physiquement à côté de ce qu'il vérifie. `ThematiqueFormDialog.tsx`, le composant le plus complexe de la feature, a même 4 fichiers de test distincts (`*.test.tsx`, `*.upload.test.tsx`, `*.soumission.test.tsx`, `*.media-cleanup.test.tsx`) plutôt qu'un seul fichier géant, pour que chaque aspect (rendu, upload, soumission, nettoyage) reste isolé et rapide à localiser en cas d'échec.

---

## 5. Intégration dans le projet global

### Routage

La feature est accessible à l'URL `/bibliotheque`. Elle est déclarée dans le routeur central du projet (`src/app/routes/router.tsx`) avec un **chargement différé** (`lazy import` — une technique qui reporte le téléchargement du code d'une page tant que personne n'y accède) : le code de la feature n'est téléchargé par le navigateur que lorsqu'un utilisateur navigue vers cette page, ce qui accélère le chargement initial de l'application.

```
/bibliotheque  →  src/features/bibliotheque/routes/Bibliotheque.tsx
```

### Système de permissions

Deux permissions distinctes contrôlent l'accès :
- `bibliotheque.view` conditionne l'accès à la page elle-même. Sans elle, le système d'authentification du projet (`AuthGuardLayout`) affiche une page "non autorisé" au lieu de la Bibliothèque. Configurée dans la migration `20260618120000_bibliotheque_view_permission.sql`.
- `bibliotheque.manage` conditionne le droit de créer/modifier/supprimer du contenu (thématiques, Q&R, formats, médias). La lecture seule (`view`) reste ouverte à tout utilisateur authentifié ; seul le service **Tech** possède `manage` (voir la migration `20260720120000_bibliotheque_manage_restrict_tech.sql`, qui a retiré ce droit aux autres services après l'avoir constaté trop largement accordé lors d'un audit).

### Composants partagés

La feature utilise exclusivement des composants de l'UI partagée du projet (`@/shared/ui/`) : `Button`, `Card`, `Dialog`, `Input`, `Textarea`, `Select`, `sonner` (notifications toast). Elle ne recrée rien de ce qui existe déjà dans la base commune, conformément à `docs/DESIGN_SYSTEM.md`.

### Résilience aux erreurs

En plus du filet de sécurité local `BiblioErrorBoundary` (voir §3 et §4), le projet a un filet de sécurité global (`AppErrorBoundary`, `src/shared/components/misc/AppErrorBoundary.tsx`) monté au sommet de toute l'application, qui journalise les erreurs vers Supabase. Les deux ne se remplacent pas : `BiblioErrorBoundary` attrape en priorité une erreur DANS la Bibliothèque (fallback local, l'utilisateur peut continuer à utiliser le reste de l'application) ; `AppErrorBoundary` reste le filet de dernier recours pour toute erreur qui lui échapperait.

### Authentification

`useBibli.ts` lit l'utilisateur courant via `useAuth()` (`@/features/auth/hooks/useAuth/AuthProvider`), pour associer un `created_by` aux thématiques et Q&R créées, et pour nommer le canal Supabase Realtime de façon unique par utilisateur.

---

## 6. Connexion à la base de données

Supabase est le service en ligne utilisé par tout le projet Nokk_project : il fournit à la fois une base de données PostgreSQL (un système de tables reliées entre elles), un espace de stockage de fichiers ("Storage"), et un système d'authentification.

### Migrations déjà appliquées

Les tables et le stockage de la feature sont créés par une série de **migrations** (des fichiers `.sql` numérotés, chacun décrivant un changement précis à appliquer à la base — c'est ce qui permet de reconstruire le schéma de la base pas à pas, et de savoir exactement quand et pourquoi chaque colonne ou table a été ajoutée) dans `supabase/migrations/` (par ordre chronologique) : création des 3 tables initiales, permission `bibliotheque.view`, ajout du brief (`bibliotheque_brief`, table séparée), des chiffres de référence, renommage de colonnes, ajout de l'image et de l'icône de thématique, du bucket Storage, de la permission `bibliotheque.manage` (puis sa restriction au service Tech), de la réplication temps réel, et enfin des deux index UNIQUE qui garantissent qu'aucun média ne peut être référencé par deux thématiques à la fois (voir "Anti-collision des médias" ci-dessous).

### Les quatre tables

| Table | Contenu |
|---|---|
| `bibliotheque_thematiques` | Catégories : nom FR/EN, chemin de l'image et de l'icône dans le bucket Storage, position |
| `bibliotheque_questions_reponses` | Q&R : question/réponse FR/EN, rattachée à une thématique, position |
| `bibliotheque_format_reponses` | Versions formatées : email, instagram, whatsapp (FR + EN), rattachées à une Q&R |
| `bibliotheque_brief` | Table singleton (une seule ligne, id = 1 — une table "singleton" est une table qui ne contiendra jamais qu'une seule ligne par construction) : brief global et chiffres de référence FR/EN |

### Stockage des médias (Supabase Storage)

Le bucket public `bibliotheque` contient les images d'illustration (à la racine) et les icônes SVG (dans `icons/`) des thématiques. La base ne stocke que le CHEMIN dans le bucket (ex : `livraison.png`), jamais l'URL complète — l'URL est reconstruite à l'affichage par `resolveThematiqueMediaUrl()` (voir `bibliothequeMediaService.ts`), pour ne jamais figer l'adresse du serveur Supabase (différente entre préprod et prod) en base.

### Sécurité (RLS)

Chaque migration active le **Row Level Security** (RLS — un mécanisme PostgreSQL qui filtre directement au niveau de la base de données quelles lignes un utilisateur a le droit de lire ou modifier, indépendamment de ce que fait le code applicatif) sur la table qu'elle crée : tout utilisateur authentifié peut lire, seul le service Tech peut écrire (permission `bibliotheque.manage`, voir §5). Un utilisateur non connecté est bloqué au niveau de la base, indépendamment du frontend — même si quelqu'un contournait l'interface, la base refuserait quand même la requête.

### Anti-collision des médias

Deux index `UNIQUE` partiels (une contrainte de base de données qui interdit à deux lignes d'avoir la même valeur dans une colonne donnée) sur `image_url` et `icon_url` empêchent la base d'accepter deux thématiques pointant vers le même fichier — un garde-fou nécessaire car l'API Storage de Supabase ne permet pas de rejeter un renommage (`move`) vers un chemin déjà occupé, contrairement à un nouvel upload. Si ce cas rare se produit (deux renommages simultanés vers le même nom), le service détecte le conflit et déplace automatiquement le fichier perdant vers un autre chemin avant de réessayer — voir `insertThematiqueWithMediaRetry` / `patchThematiqueWithMediaRetry` dans `bibliothequeService.ts`.

### Temps réel

`useBiblioRealtime.ts` s'abonne aux événements Supabase Realtime sur les 4 tables. Si un collaborateur modifie une Q&R depuis son poste, tous les autres utilisateurs qui ont la page ouverte voient la mise à jour apparaître automatiquement, sans recharger la page.

### Dette technique connue

`db.ts` déclare manuellement les types des 4 tables car les types générés automatiquement (`src/integrations/supabase/types.ts`) existent mais sont périmés (schéma antérieur à plusieurs migrations). Régénérer ces types nécessite un accès authentifié à Supabase (`supabase login`) qui n'est pas toujours disponible selon l'environnement de travail. `db.test.ts` surveille cet état et fera échouer `tsc --noEmit` (la vérification de types du projet) le jour où la régénération redevient possible, pour que la suppression de `db.ts` soit une décision explicite plutôt qu'un oubli.

---

## 7. Tests unitaires : ce qui est couvert et résultats

Un "test unitaire" est un petit programme qui vérifie automatiquement qu'une portion précise du code (une fonction, un composant, un hook) se comporte comme prévu — il s'exécute sans navigateur ni vraie base de données, en quelques millisecondes, et peut être relancé à tout moment pour détecter une régression (un comportement qui casse suite à une modification ailleurs dans le code).

### Outil

Les tests utilisent **rstest** (`@rstest/core`), le test runner du projet (le programme qui exécute les tests — d'API proche de Jest/Vitest, deux outils très répandus dans l'écosystème JavaScript), avec **@testing-library/react** pour le rendu et les interactions sur les composants (une bibliothèque qui simule un navigateur minimal pour afficher un composant React et cliquer dessus, sans avoir besoin d'un vrai navigateur).

Commande pour lancer uniquement les tests de cette feature :
```
npx rstest run src/features/bibliotheque
```

### Résultat au moment de la rédaction

```
40 fichiers de test — 445 tests — tous réussis, 0 échec
```

`npx tsc --noEmit` (vérification des types) et `npx eslint src/features/bibliotheque` (vérification des règles de style et de qualité du code) sont propres (aucune erreur, aucun avertissement) sur l'ensemble de la feature.

Comme pour toute mesure de ce type dans une documentation, ce chiffre est une photographie prise à un instant donné : relancer la commande ci-dessus donne le compte exact et à jour.

### Répartition par domaine

| Domaine | Fichiers de test | Ce qui est vérifié |
|---|---|---|
| Fonctions pures (`utils.tsx`, `imageResize.ts`, `mappers.ts`) | `utils.test.tsx`, `imageResize.test.ts`, `mappers.test.ts` | Surlignage, extraction bilingue, normalisation de nom de fichier, redimensionnement d'image, conversion snake_case → camelCase |
| Services (accès Supabase) | `db.test.ts`, `errors.test.ts`, `bibliothequeService.test.ts`, `bibliothequeMediaService.test.ts`, `bibliothequeMediaConflict.test.ts` | CRUD des 4 tables, gestion d'erreur (dont le cas normal "brief pas encore créé"), upload/renommage/suppression de médias, anti-collision de chemin, retry sur conflit détecté en base |
| Hooks (état React) | `useDialog.test.ts`, `useSearch.test.ts`, `useBiblioPage.test.ts`, `useBibli.test.ts`, `useBiblioQR.test.ts`, `useBiblioRealtime.test.ts` | État des dialogs, debounce et filtrage de recherche, handlers de haut niveau (toast + fermeture), mises à jour optimistes et leur rollback en cas d'échec (y compris des scénarios de concurrence entre deux créations simultanées), synchronisation temps réel |
| Contexte | `BiblioContext.test.tsx` | Erreur explicite hors Provider, partage d'une valeur unique entre composants |
| Composants de mise en page et d'assemblage | `BiblioToolbar`, `BiblioSidebar`, `BiblioMainColumn`, `BriefPanel`, `SearchResults`, `Bibliotheque` (route), `BiblioErrorBoundary` | Sélection/navigation, affichage conditionnel selon l'état (chargement/erreur/vide/complet), déclenchement des bonnes actions, capture d'une erreur de rendu et rétablissement |
| Composants d'éléments | `ThematiqueItem`, `QRCard`, `QRDetailPanel`, `FormatPanel`, `FormatToggleButton`, `LangToggle`, `MaskIcon`, `MediaPickerField` | Rendu, callbacks, accessibilité clavier (dont la navigation par flèches de `LangToggle`), copie presse-papiers, aperçu de média |
| Dialogs et composants partagés | `QRFormDialog`, `DeleteDialogs`, `ThematiqueFormDialog` (+ 3 fichiers dédiés upload/soumission/nettoyage), `BriefChiffresDialogs`, `FormatEditDialog`, `FormatViewDialog`, `DialogSaveFooter` | Visibilité selon le mode, pré-remplissage, validation, soumission, protection contre la double soumission, upload de fichiers et nettoyage des uploads abandonnés, comportement du pied de fenêtre partagé (dont sa variante destructive) |

### Stratégie de mock

Un "mock" est une version simulée d'une dépendance (une fonction, un module), utilisée en test à la place de la vraie pour ne pas dépendre d'un vrai réseau, d'une vraie base de données ou d'un composant réel — ce qui rend les tests rapides, fiables et indépendants les uns des autres.

- Les services testent le comportement réel de leurs fonctions en simulant le client Supabase (`db.from(...)`, `supabase.storage.from(...)`) avec un faux "query builder" qui imite le comportement `thenable` (un objet qui se comporte comme une `Promise`, utilisable avec `await`) du vrai client.
- Les hooks testent leur logique en simulant le module `services/bibliothequeService.ts` — le comportement Supabase réel n'est donc testé qu'une fois, dans les tests de service, pas répété dans chaque test de hook.
- Les composants testent leur rendu et leurs interactions en simulant `useBiblioContext()` (le contexte), pour ne dépendre ni de Supabase ni des hooks réels — seuls la route et quelques composants d'assemblage rendent leurs vrais enfants (ex : `SearchResults` rend un vrai `QRDetailPanel`) pour vérifier que l'intégration entre eux fonctionne.

### Ce qui n'est volontairement PAS couvert par des tests unitaires

- Le rendu visuel exact (CSS, mise en page) — non vérifiable de façon fiable par des tests unitaires ; à vérifier manuellement dans le navigateur.
- Le comportement réel de Supabase Storage et Realtime (réseau, latence) — les tests simulent leur API, pas le service en ligne lui-même.
- Le détecteur de débordement de texte basé sur `ResizeObserver` dans `QRCard` — jsdom (l'environnement simulé utilisé pour les tests, qui reproduit une partie du comportement d'un navigateur sans en être un) ne calcule pas de vraies dimensions de layout ; un stub minimal (une version simplifiée qui ne fait que le strict nécessaire pour ne pas planter) est utilisé pour éviter un crash, sans vérifier le comportement réel.

---

## 8. Technologies utilisées, justifications et alternatives envisageables

| Technologie | Rôle dans cette feature | Pourquoi ce choix | Alternative envisageable et pourquoi elle n'a pas été retenue |
|---|---|---|---|
| **React 19** | Construction de l'interface sous forme de composants | Framework déjà standard dans tout le projet | Vue, Svelte, Angular : changer de framework pour une seule feature créerait une incohérence technique majeure dans le projet |
| **TypeScript** | Typage statique de toutes les données (vérification, avant l'exécution, que les données ont bien la forme attendue) | Détecte les erreurs avant l'exécution — indispensable quand plusieurs fichiers échangent des données structurées (`Thematique`, `QR`, `FormatMap`…) ; gate obligatoire du projet (`tsc --noEmit`) | JavaScript pur (sans les types) : plus rapide à écrire au premier jet, mais aucune détection statique des erreurs de type — risque élevé sur une feature avec beaucoup d'objets partagés entre couches |
| **React Context** | Partage d'état entre composants sans prop drilling | Solution native à React, suffisante pour une feature isolée où un seul `Provider` distribue l'état à ses descendants | Redux / Zustand / Jotai (des bibliothèques de gestion d'état plus avancées) : apportent des outils de debug et une meilleure scalabilité pour un état très partagé entre features, mais sont une dépendance et une complexité supplémentaires injustifiées pour un état qui ne sort jamais de cette feature |
| **Supabase** | Base de données PostgreSQL + API REST + Storage + temps réel | Déjà utilisé dans tout le projet ; les abonnements temps réel évitent d'implémenter un système de sondage ("polling", qui consiste à redemander sans arrêt "y a-t-il du nouveau ?") manuel ; RLS intégré au niveau base | Firebase / backend Node.js custom : changerait la base technique de tout le projet pour une seule feature ; polling manuel : plus simple à comprendre mais moins réactif et plus coûteux en requêtes répétées |
| **Tailwind CSS v4** | Stylisation des composants | Système de classes utilitaires (des classes CSS courtes et prêtes à l'emploi, combinées directement dans le JSX plutôt que dans un fichier CSS séparé) déjà en place dans le projet, tokens `@theme` centralisés (des valeurs de style réutilisables nommées, comme des couleurs ou tailles), pas de CSS personnalisé à maintenir | CSS Modules / styled-components : offriraient un scoping par fichier (l'isolement des styles à un seul composant), mais dupliqueraient un système de design déjà résolu par les tokens Tailwind du projet |
| **shadcn/ui** | Composants `Dialog`, `Button`, `Card`, `Input`, `Textarea`, `Select` | Bibliothèque de composants accessibles déjà intégrée au design system du projet (`src/shared/ui`) | MUI / Chakra UI / Ant Design : imposeraient leur propre système de theming (habillage visuel), en conflit avec les tokens Tailwind déjà en place |
| **lucide-react** | Icônes (`Pencil`, `Trash2`, `Search`, `ChevronDown`…) | Bibliothèque d'icônes légère déjà présente dans le projet, cohérente avec le reste de l'application | react-icons / Heroicons : redondant avec une bibliothèque déjà choisie au niveau du projet |
| **CSS mask (`MaskIcon`)** | Icônes SVG colorisables (thématiques, canaux de format) | Un seul fichier SVG par icône, coloré dynamiquement via une classe Tailwind (`bg-current`, `bg-brand`…), au lieu de maintenir une variante de couleur par fichier | Une bibliothèque d'icônes React par couleur, ou un `<img>` classique : perdrait la capacité de suivre dynamiquement la couleur du texte/thème environnant |
| **rstest** (`@rstest/core`) + **@testing-library/react** | Exécution des tests unitaires | Test runner et bibliothèque de test déjà standard dans le projet | Jest / Vitest : proches en API, mais changer d'outil pour une seule feature casserait l'homogénéité de la suite de tests du projet |
| **`useMemo` / `useCallback`** | Optimisation des calculs et des fonctions (deux hooks React qui évitent de refaire un calcul ou de recréer une fonction à chaque nouvel affichage si rien n'a changé) | Évite de recalculer les résultats de recherche ou de recréer des handlers à chaque rendu React, notamment dans les listes (une thématique/Q&R par ligne) | Ne pas mémoïser du tout : plus simple à lire, mais dégraderait les performances de la recherche et des listes sur un catalogue volumineux |
| **Debounce (150ms) manuel** (`useSearch.ts`) | Retarde le filtrage de la recherche après la dernière frappe | Implémentation directe avec `setTimeout`/`clearTimeout` dans un `useEffect`, sans dépendance supplémentaire | `lodash.debounce` ou `use-debounce` : ajouteraient une dépendance externe pour un besoin de quelques lignes déjà entièrement couvert par un `useEffect` |
| **Mises à jour optimistes** (`useBibli.ts`) | L'interface change avant la confirmation de Supabase | Meilleure réactivité perçue par l'utilisateur ; le risque d'incohérence est limité par la déduplication à l'arrivée de l'événement Realtime et par le rollback en cas d'échec | Attendre systématiquement la réponse serveur avant de mettre à jour l'écran : plus simple et plus sûr, mais l'interface paraîtrait plus lente à chaque action |
| **Error Boundary** (`BiblioErrorBoundary.tsx`) | Isole un crash de rendu à la feature Bibliothèque plutôt qu'à toute l'application | Mécanisme natif de React pour ce besoin précis (seules les classes de composant peuvent jouer ce rôle) ; complète le filet de sécurité global (`AppErrorBoundary`) déjà existant dans le projet, sans le remplacer | Ne rien ajouter et compter uniquement sur le filet global : un bug localisé à la Bibliothèque ferait alors planter toute l'application au lieu d'un seul écran |

---

## 9. Git : où en est cette feature, et comment le projet s'organise autour

Git est l'outil qui garde l'historique de toutes les modifications apportées au code au fil du temps (qui a changé quoi, quand, et pourquoi), sous forme de "commits" (des instantanés successifs du code, chacun accompagné d'un message expliquant le changement).

### Dépôt et branche

Le projet est hébergé sur un GitLab auto-hébergé : `https://git.nokk-project.example/root/Nokk_project` (remote `origin` — le nom donné, en local, à l'adresse du dépôt distant). Toute la feature Bibliothèque a été développée sur une branche dédiée, `feat/bibli_reponses`, créée à partir de `main` (une "branche" est une ligne de développement parallèle, qui permet de travailler sur une fonctionnalité sans perturber le code déjà stable) — convention "une branche par fonctionnalité" qui permet de revoir (review — la relecture du code par un ou plusieurs collègues avant de l'intégrer) et de fusionner (merge — réunir les changements d'une branche dans une autre) le travail indépendamment du reste du projet, sans bloquer les autres développements en cours.

### Historique de la feature

L'historique Git de cette feature (`git log -- src/features/bibliotheque`) montre une construction incrémentale, commit par commit : mise en place initiale de la page, contexte et hook d'orchestration, refactoring des hooks et composants pour la gestion des dialogs, réorganisation de l'architecture pour corriger une inversion de dépendance (déplacement de `db.ts`/`mappers.ts` vers `services/`), ajout de la souscription temps réel, renommage du dossier des hooks de données vers la convention `hooks/data/`, extraction du pied de fenêtre partagé `DialogSaveFooter`, ajout du filet de sécurité `BiblioErrorBoundary`, puis vagues successives de correction TypeScript/ESLint et d'ajout de tests. Chaque migration SQL (`supabase/migrations/*.sql`) est versionnée dans Git au même titre que le code applicatif — le schéma de base de données a donc, comme le code, un historique complet et reproductible, au lieu d'être appliqué "à la main" sans trace.

### Qualité avant commit

Le projet n'utilise pas de hook Git automatique (pas de `husky`/`pre-commit` détecté dans ce dépôt — un "hook Git" est un script qui s'exécute automatiquement à certains moments, comme juste avant un commit, pour bloquer une action si une vérification échoue) : la discipline de qualité repose sur une convention documentée dans `CLAUDE.md` — `npm run lint` (vérification du style et de bonnes pratiques) et `npm run typecheck` (`tsc --noEmit`, vérification des types) doivent passer avant tout commit — complétée par un mécanisme de **"ratchet"** (littéralement un "cliquet", un mécanisme qui n'autorise le mouvement que dans un seul sens) (`npm run check:lint-ratchet`, `npm run check:typecheck-ratchet`) : un script qui compare le nombre d'erreurs actuel à une référence enregistrée, et empêche que ce nombre augmente, même s'il n'impose pas encore de le faire baisser à zéro d'un coup. Aucun pipeline d'intégration continue (CI — un système qui relance automatiquement les vérifications à chaque envoi de code sur le serveur distant) propre à ce dépôt n'a été trouvé au moment de la rédaction ; ces vérifications sont donc, pour l'instant, à la responsabilité de la personne qui commit.

### État au moment de la rédaction

Cette section reflète une photographie, pas un état garanti à jour — se référer à `git status` et `git log` pour l'état exact au moment de la lecture. Au moment de la rédaction de cette version du document, la feature a bénéficié de plusieurs vagues successives d'audit qualité (scission des services, garde-fou d'atomicité anti-collision de médias, ajout d'un test dédié pour chaque hook de données, extraction du pied de fenêtre partagé `DialogSaveFooter` pour éliminer une duplication entre 5 dialogs, ajout du filet de sécurité `BiblioErrorBoundary`), avec à chaque étape une vérification que `npm run lint`, `tsc --noEmit` et la suite de tests complète (`npx rstest run src/features/bibliotheque`) restent au vert.

### Structure des fichiers de la feature

```
src/features/bibliotheque/
├─ components/
│  ├─ BiblioErrorBoundary.test.tsx
│  ├─ BiblioErrorBoundary.tsx
│  ├─ BiblioMainColumn.test.tsx
│  ├─ BiblioMainColumn.tsx
│  ├─ BiblioSidebar.test.tsx
│  ├─ BiblioSidebar.tsx
│  ├─ BiblioToolbar.test.tsx
│  ├─ BiblioToolbar.tsx
│  ├─ BriefChiffresDialogs.test.tsx
│  ├─ BriefChiffresDialogs.tsx
│  ├─ BriefPanel.test.tsx
│  ├─ BriefPanel.tsx
│  ├─ DeleteDialogs.test.tsx
│  ├─ DeleteDialogs.tsx
│  ├─ DialogSaveFooter.test.tsx
│  ├─ DialogSaveFooter.tsx
│  ├─ FormatEditDialog.test.tsx
│  ├─ FormatEditDialog.tsx
│  ├─ FormatPanel.test.tsx
│  ├─ FormatPanel.tsx
│  ├─ FormatToggleButton.test.tsx
│  ├─ FormatToggleButton.tsx
│  ├─ FormatViewDialog.test.tsx
│  ├─ FormatViewDialog.tsx
│  ├─ LangToggle.test.tsx
│  ├─ LangToggle.tsx
│  ├─ MaskIcon.test.tsx
│  ├─ MaskIcon.tsx
│  ├─ MediaPickerField.test.tsx
│  ├─ MediaPickerField.tsx
│  ├─ mediaUpload.test.ts
│  ├─ mediaUpload.ts
│  ├─ QRCard.test.tsx
│  ├─ QRCard.tsx
│  ├─ QRDetailPanel.test.tsx
│  ├─ QRDetailPanel.tsx
│  ├─ QRFormDialog.test.tsx
│  ├─ QRFormDialog.tsx
│  ├─ SearchResults.test.tsx
│  ├─ SearchResults.tsx
│  ├─ ThematiqueFormDialog.media-cleanup.test.tsx
│  ├─ ThematiqueFormDialog.soumission.test.tsx
│  ├─ ThematiqueFormDialog.test.tsx
│  ├─ ThematiqueFormDialog.tsx
│  ├─ ThematiqueFormDialog.upload.test.tsx
│  ├─ ThematiqueItem.test.tsx
│  └─ ThematiqueItem.tsx
├─ constants.ts
├─ context/
│  ├─ BiblioContext.test.tsx
│  └─ BiblioContext.tsx
├─ DOCUMENTATION.md
├─ hooks/
│  ├─ data/
│  │  ├─ useBibli.test.ts
│  │  ├─ useBibli.ts
│  │  ├─ useBiblioQR.test.ts
│  │  ├─ useBiblioQR.ts
│  │  ├─ useBiblioRealtime.test.ts
│  │  └─ useBiblioRealtime.ts
│  ├─ useBiblioPage.test.ts
│  ├─ useBiblioPage.ts
│  ├─ useDialog.test.ts
│  ├─ useDialog.ts
│  ├─ useSearch.test.ts
│  └─ useSearch.ts
├─ imageResize.test.ts
├─ imageResize.ts
├─ index.ts
├─ routes/
│  ├─ Bibliotheque.test.tsx
│  └─ Bibliotheque.tsx
├─ services/
│  ├─ bibliothequeMediaConflict.test.ts
│  ├─ bibliothequeMediaConflict.ts
│  ├─ bibliothequeMediaService.test.ts
│  ├─ bibliothequeMediaService.ts
│  ├─ bibliothequeService.test.ts
│  ├─ bibliothequeService.ts
│  ├─ db.test.ts
│  ├─ db.ts
│  ├─ mediaSlug.ts
│  ├─ errors.test.ts
│  ├─ errors.ts
│  ├─ mappers.test.ts
│  └─ mappers.ts
├─ types.ts
├─ utils.test.tsx
└─ utils.tsx
```
