# Codes QR des emplacements — stock handpick

Date : 2026-09-24 · Statut : design validé en conversation, spec à relire

## Objectif

Pouvoir **générer et imprimer** une étiquette QR par emplacement du stock
handpick (`B · R2 · E3 · H1`, `A · SOL`…), puis **la lire** au téléphone pour
voir ce que contient l'emplacement.

Critères de réussite :

- depuis un nouvel onglet « Codes », sélectionner des emplacements et imprimer
  une planche d'étiquettes lisible ;
- scanner une étiquette (appareil photo natif **ou** lecteur intégré) affiche
  le chemin de l'emplacement et ses balles ;
- une étiquette reste valable si l'emplacement est renommé.

## Décisions

| Sujet | Décision |
|---|---|
| Module | `src/features/stock_handpick` (nouvel onglet), pas le module `stock`. |
| Cible des codes | Les **emplacements** (feuilles `emplacements_handpick`), pas les balles. |
| Format | **QR code**. Aucune dépendance ajoutée : `qrcode` (génération) et `html5-qrcode` (lecture) sont déjà installés. |
| Contenu du QR | L'URL de l'app vers l'emplacement : `<origin>/stock-handpick/codes/<emplacement-id>`. |
| Action au scan | Afficher le contenu (chemin + balles) avec un bouton « Voir dans le plan ». Pas d'action de rangement. |
| Données | **Aucune migration, aucune table.** Tout vient des emplacements et balles existants. |
| Impression | Fenêtre dédiée (`window.open` + `print()`), planche A4 3 colonnes en mm. L'app-shell n'est pas masquable proprement par des variantes `print:` depuis un onglet. Pas de format d'étiquettes spécifique. |

### Pourquoi l'URL avec l'id

- L'**id** est stable : renommer un emplacement ne périme pas l'étiquette
  (le libellé imprimé, lui, devient faux — c'est accepté : réimprimer).
- L'**URL** permet à l'appareil photo natif du téléphone d'ouvrir directement
  la fiche de l'emplacement, sans passer par l'onglet ; le lecteur intégré lit
  la même URL.

## Navigation (docs/ROUTING.md)

- Nouvel onglet `codesTab`, segment `codes`, **à la place de l'onglet Flux** (retiré de la navigation ; son code, ses tables et sa permission restent), dans `STOCK_HANDPICK_TABS`
  (`types/ui.types.ts`), permission **`P.planView`** (pas de nouvelle
  permission).
- `detail` = id d'emplacement : `/stock-handpick/codes/<id>` ouvre le panneau
  de résultat. Fermer le panneau → `navigate("/stock-handpick/codes")`.
  L'état est dérivé du `detail`, jamais d'état bidirectionnel.
- Id inconnu une fois les emplacements chargés : le panneau affiche « Code non
  reconnu » (pas de redirection : l'utilisateur doit comprendre que son
  étiquette ne correspond à rien).
- « Voir dans le plan » → `/stock-handpick/plan/emp-<id>`. L'onglet Plan
  interprète un `detail` préfixé `emp-` comme un emplacement ; sinon, comme
  aujourd'hui, comme une balle.

## Composants et unités

### `utils/emplacementCode.ts` (pur, testé)

- `emplacementCodeUrl(origin: string, id: string): string` — construit l'URL.
- `parseEmplacementCode(text: string): string | null` — extrait l'id d'une URL
  lue (`…/stock-handpick/codes/<uuid>`, quel que soit l'origin) ; accepte aussi
  un uuid nu (saisie manuelle). `null` pour tout autre texte.
- `PLAN_EMPLACEMENT_PREFIX = "emp-"` et `planDetailOfEmplacement(id)` /
  `emplacementOfPlanDetail(detail)`.

### `utils/emplacementGroups.ts` (pur, testé)

- Regroupe les emplacements **actifs** pour la liste de sélection : un
  groupe par rack (`B · R2`), zones sans rack groupées par zone (`A`). Tri
  numérique (`localeCompare` `numeric`). S'appuie sur
  `buildEmplacementPaths`.

### `components/codes/`

- **`CodesTab.tsx`** — deux blocs : « Générer » et « Lire ». Reçoit `detail`.
  Charge emplacements et balles via `usePlanHandpick()` (comme l'onglet Plan).
- **`CodeSelectionList.tsx`** — liste groupée avec cases à cocher,
  « tout sélectionner » par rangée / zone, compteur, bouton « Imprimer (n) ».
- **`CodeLabelSheet.tsx`** — aperçu des étiquettes sélectionnées : QR (généré
  en data URL par `qrcode.toDataURL`), chemin en gros (`B · R2 · E3 · H1`),
  libellé de la zone ; bouton « Imprimer » qui ouvre la planche
  (`utils/codeLabelSheet.ts`) dans une fenêtre dédiée.
- **`CodeScanner.tsx`** — dialog caméra `Html5Qrcode` (caméra arrière
  `facingMode: "environment"`), s'arrête au premier code valide et appelle
  `onScan(id)`. Nettoie la caméra au démontage. Saisie manuelle en secours :
  URL, uuid, ou chemin tapé (`B R2 E3 H1`).
- **`EmplacementScanResult.tsx`** — panneau : chemin, état (actif / retiré),
  balles de l'emplacement (chacune ouvre sa fiche comme dans
  `PlanDetailPanel`), bouton « Voir dans le plan », bouton fermer.

Chaque fichier < 400 lignes (Architecture_Feature.pdf §15).

### Onglet Plan

- `hooks/ui/usePlanBalleFocus.ts` : si `detail` commence par `emp-`, la cible
  est l'emplacement (focus via `focusFromSegments(segmentsFor(id))`, libellé =
  chemin) au lieu d'une balle. Le reste de `PlanTab` est inchangé.

## Flux de données

```
étiquette QR ──(caméra native)──▶ /stock-handpick/codes/<id>
             ──(CodeScanner)────▶ parseEmplacementCode ─▶ navigate(/codes/<id>)
/codes/<id> ─▶ CodesTab(detail) ─▶ EmplacementScanResult
                 useEmplacementHandpick : emplacement, chemin, is_active
                 contexte balles         : balles de l'emplacement
```

Les balles d'un emplacement viennent du contexte balles existant
(`useBalleHandpickContext`), comme pour `PlanDetailPanel`. Aucun appel
`supabase.from` hors services.

## Erreurs

- **Caméra refusée / indisponible / pas en HTTPS** : message clair dans le
  dialog, saisie manuelle proposée.
- **QR étranger** (pas une URL de code) : toast « Code non reconnu », le
  scanner continue.
- **Id inconnu** : panneau « Code non reconnu ».
- **Emplacement désactivé** (ex. R4/E5, R2/E1/H1) : panneau affiché avec la
  mention « Emplacement retiré » ; il n'est plus proposé à l'impression.
- **Échec de génération d'un QR** : l'étiquette affiche le chemin seul, avec
  un toast d'erreur.

## Tests

- `emplacementCode.test.ts` : aller-retour URL ↔ id, origins différents, uuid
  nu, textes étrangers, préfixe `emp-`.
- `emplacementGroups.test.ts` : regroupement, tri, exclusion des inactifs.
- `EmplacementScanResult.test.tsx` : chemin + balles, emplacement retiré, id
  inconnu, clic balle.
- `usePlanBalleFocus` : `detail` `emp-<id>` donne le focus de l'emplacement.
- Le scanner caméra n'est pas testé unitairement (API navigateur) : vérifié à
  la main sur téléphone.

## Hors périmètre

- Codes-barres 1D, douchettes.
- Étiquettes de balles.
- Ranger / déplacer une balle depuis le scan.
- Formats d'étiquettes adhésives spécifiques (Avery…).
