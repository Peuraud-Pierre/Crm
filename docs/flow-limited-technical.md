# Tableau des Arrivages — Documentation Technique

> Feature : `src/features/stock/components/flow/`  
> Scope : Tableau de suivi des arrivages manuels (conteneurs import)  
> Statut prod : ✅ Déployé

## Table de version

| Version | Date | Auteur | Résumé |
|---------|------|--------|--------|
| 1.8 | Septembre 2026 | Équipe tech | **Le classement des packing lists apprend de l'usage (§3.6).** Le service `packing-api` (Python/FastAPI) est réécrit et devient le service d'import : portage du parseur de référence (repasse le corpus GR153/GR154), écriture avec le JWT de l'utilisateur via PostgREST. Chaque décision humaine est journalisée par trigger dans `packing_label_feedback`, avec la proposition affichée à ce moment ; un modèle (Naive Bayes sur les mots de la clé) en est réentraîné à chaque import. Nouveau `resolution = 'model'` : le modèle classe seul **uniquement** au-dessus d'un seuil calibré sur sa précision mesurée (98 % sur 50 propositions vérifiées au moins, sinon jamais), avec un écart net sur la 2ᵉ catégorie et aucun mot inconnu. Les lignes classées par le modèle forment une strate visible et corrigeable, et n'entrent jamais dans le tableau de correspondance. Bloc « Apprentissage » dans Paramètres → Correspondances. Migration `20260918100000_stock_packing_learning.sql` |
| 1.7 | Septembre 2026 | Équipe tech | **Packing lists (§3.6) alignées sur le document réel du fournisseur**, mesuré sur `CONTENEUR GR153` et `GR154`. Le modèle portait deux nombres par ligne, le document en porte quatre en deux régimes d'unité : le nombre de COLIS — seule grandeur additive et seule que le fournisseur totalise — était perdu, et le poids, absent de 93 lignes sur 97, faisait diverger l'écart à chaque import. Migrations `20260917100000_stock_packing_list_document_shape.sql` et `20260917101000_stock_packing_label_dictionary.sql`. Ajout du tableau de correspondance libellé → catégorie, alimenté par la seule validation d'une packing : GR154 importé après GR153 arrive avec 47 de ses 121 libellés déjà reconnus. Verrou de rigueur rétabli — seule une correspondance exacte retient une catégorie, un rapprochement approximatif reste une suggestion et bloque la validation. Deux contrôles neufs : intégrité arithmétique du fichier (GR153 annonce 548 colis et n'en totalise 543) et rapprochement du titre du fichier avec le conteneur de l'arrivage. Parseur de référence testé sur les deux vrais fichiers, à repasser par le service Go. `.xls` retiré des formats acceptés |
| 1.6 | Août 2026 | Équipe tech | **Bannière de mois dans le classeur** (§3.5) : le libellé du mois ouvre désormais son bloc au lieu de n'exister que dans la ligne de total placée sous ses lignes — le tableau se lisait comme si les arrivages d'un mois étaient rangés sous le libellé du mois suivant. Correctif appliqué à l'identique côté `newsletter-console` (`internal/excel/generator.go`). Ajout de l'impression A4 (§3.8) : bouton « Imprimer », dialog avec choix de format (détaillé / simple), sélecteur de période et prévisualisation. Extraction des colonnes, du groupement et du builder de classeur dans `features/stock/utils/` pour partage export ↔ impression |
| 1.5 | Juillet 2026 | Équipe tech | Routing par URL : `/stock/arrivage[/new\|/{id}]` (§1, §3.1), voir `docs/ROUTING.md`. Les sheets de création/édition sont désormais pilotées par l'URL au lieu d'un state local — deep-link direct depuis une notification. Migration `20260717120000_arrivage_notification_deeplink.sql` : les notifications arrivage (rappel facture, journal d'activité) pointent vers le conteneur précis (`/stock/arrivage/{id}`) au lieu de la liste générique (`/stock`) |
| 1.4 | Juillet 2026 | Équipe tech | Documentation des transitions automatiques de statut (§4) et correction du bug « bloqué en_transit » : ajout du scan pg_cron horaire (`20260707140000`). RLS `arrivage_manuel` alignée sur des permissions dédiées par opération (§5) : `stock.arrivage.view`/`.delete` créées (`20260707130000`) |
| 1.3 | Juillet 2026 | Équipe tech | Annulation du renommage `stock.arrivage.newsletter.<permKey>` → `.export.<permKey>` introduit en v1.1 : ce permKey est en réalité **partagé intentionnellement** avec `NewsletterSubscriptionCard.tsx`, pas un doublon accidentel. Ajout de la documentation de ce composant (§3.7) et de `stock.arrivage.newsletter.view` |
| 1.2 | Juillet 2026 | Équipe tech | Correction du statut de l'import de packing list : **non déployé** (permission absente de prod/preprod, code présent uniquement sur la branche `features/arrivages-packing` non mergée). Précision sur le statut preprod-only de `stock.arrivage.newsletter.send` |
| 1.1 | Juillet 2026 | Équipe tech | Ajout des sections import packing list et newsletter, table de correspondance des noms, renommage du permKey d'export, correction des permissions §5 |
| 1.0 | — | Équipe tech | Version initiale |

> Pour la documentation destinée aux utilisateurs finaux, voir le [Guide utilisateur — Tableau des arrivages](./flow-limited-user-guide.html).

---

## 1. Vue d'ensemble

Le module Stock expose un tableau de suivi des arrivages de conteneurs import, dits « arrivages manuels » : les expéditions dont les données ne proviennent pas d'un EDI mais sont saisies à la main par les utilisateurs habilités. Il permet de **saisir, visualiser et exporter** ces arrivages, avec une newsletter par abonnement en complément (§3.7). Un import de packing list est en développement, non encore déployé (§3.6).

### Routing

L'onglet Arrivages est deep-linkable via l'URL (contrat générique documenté dans [`docs/ROUTING.md`](./ROUTING.md)) :

```
/stock                  → redirige vers /stock/arrivage
/stock/arrivage         → onglet Arrivages, liste
/stock/arrivage/new     → sheet de création ouverte (ArrivageLimitedCreationSheet)
/stock/arrivage/{id}    → sheet d'édition du conteneur {id} (ArrivageLimitedEditSheet), id = arrivage_manuel.id (uuid)
```

`FlowBoard.tsx` dérive l'ouverture des sheets depuis le paramètre `detail` de la route (pas de state local) — voir §3.1. Les notifications arrivage (rappel facture §4, journal d'activité) portent directement cette URL pour ouvrir le conteneur concerné.

### Arborescence

```
src/features/stock/components/flow/
├── FlowBoard.tsx                     # Composant racine / orchestrateur
├── ArrivageLimitedTable.tsx          # Tableau paginé par mois
├── ArrivageLimitedCreationSheet.tsx  # Formulaire de création (sheet)
├── ArrivageLimitedEditSheet.tsx      # Formulaire d'édition (sheet)
├── ExportArrivageButton.tsx          # Export Excel (.xlsx)
└── print/
    ├── PrintArrivageButton.tsx       # Bouton « Imprimer » (même garde de permission que l'export)
    ├── PrintArrivageDialog.tsx       # Choix du format + période + prévisualisation
    ├── ArrivagePrintDocument.tsx     # Document imprimable (formats détaillé et simple)
    └── print.css                     # @page, @media print, styles du document
```

Les définitions partagées entre l'export et l'impression vivent dans `src/features/stock/utils/` :

```
arrivageExportColumns.ts   # COLUMN_DEFS, permKeys, largeurs, palette d'emphase
arrivageGrouping.ts        # groupByMonth, monthBannerLabel, filterArrivagesByRange, fmtDate/fmtDatetime
buildArrivageWorkbook.ts   # construction du classeur xlsx-js-style + téléchargement
```

> `PackingListSheet.tsx` et le dossier `components/flow/packing/` (import de packing list, voir §3.6) n'apparaissent **pas** dans cette arborescence : ils ne sont mergés ni en prod ni en preprod à ce jour (branche `features/stock-packing`).

Le service `newsletter-console` (dépôt séparé, Go) complète cette feature côté back — voir §3.7. Le service de lecture et de classement des packing lists (§3.6) est `packing-api` (dépôt séparé, Python/FastAPI), réécrit pour cette version.

### Dépendances clés

| Chemin | Rôle |
|--------|------|
| `hooks/context/StockProvider` | Context React — données & actions (`rows`, `create`, `update`) |
| `types/arrivage-manuel.types.ts` | Types `ArrivageManuelRow`, inputs, fonction `referenceArrivageManuel` |
| `types/stock.types.ts` | Type `ArrivageStatus` |
| `utils/arrivageHelpers.ts` | `parseDechargement`, `daysFromDechargement`, `isArrivageInvoiceAlert` |
| `constants.ts` | `ARRIVAGE_STATUS_CONFIG`, `TRANSPORT_MODES`, `ARRIVAGE_MONTHS_PER_PAGE`, `INVOICE_ALERT_DAYS` |
| `features/auth/hooks/useAuth/AuthProvider` | `hasPermission()` |

### Correspondance des noms de champs

Certains champs portent des noms différents selon la couche (base de données, interface, export). Pour éviter toute ambiguïté, voici la correspondance complète — les champs non listés ici utilisent le même nom dans les trois couches :

| Nom technique (DB) | Libellé UI | permKey d'export |
|---------------------|-----------|-------------------|
| `conteneur_no_raw` | N° Interne | `internal_ref` |
| `fournisseur.siege_localisation` | *(absent du tableau principal)* | `fournisseur_lieu` |

---

## 2. Modèle de données

### `ArrivageManuelRow`

```ts
interface ArrivageManuelRow {
    id:                   string          // UUID Supabase
    container_no:         string          // N° BIC normalisé (ex: CSLU6080095) — voir note [1]
    conteneur_no_raw:     string | null   // Référence interne libre (ex: GR 123)
    fournisseur_id:       string | null   // FK vers table fournisseurs
    fournisseur?:         { id, name, siege_localisation } | null  // join eager
    status:               ArrivageStatus
    status_auto:          boolean         // true = statut calculé, non confirmé
    transport_mode:       string | null   // voir TRANSPORT_MODES
    departure_date:       string | null   // YYYY-MM-DD
    port_arrival_date:    string | null   // YYYY-MM-DD (Le Havre)
    prev_dechargement_at: string | null   // ISO timestamp (UTC)
    invoice_date:         string | null   // YYYY-MM-DD
    notes:                string | null
    total_weight_kg:      number | null
    total_qty:            number | null
    created_at:           string          // ISO timestamp
    updated_at:           string          // ISO timestamp
}
```

> [1] **BIC** : identifiant de conteneur normalisé (ISO 6346) — 4 lettres (code propriétaire + catégorie) suivies de 7 chiffres. C'est le numéro utilisé par les transporteurs et douanes pour tracer un conteneur, distinct du "N° Interne" (`conteneur_no_raw`) qui est une référence libre propre à l'entreprise.

### Statuts (`ArrivageStatus`)

| Valeur | Label affiché | Couleur UI |
|--------|--------------|-----------|
| `planifié` | Planifié | Gris |
| `en_transit` | En transit | Bleu |
| `reçu` | Reçu | Vert |
| `annulé` | Annulé | Rouge |

### Modes de transport

`40'` · `COMPLET` · `LCL` · `40HC` · `20'`

### Date de référence (`referenceArrivageManuel`)

La date de référence détermine le **mois d'appartenance** d'un arrivage et le tri. Priorité décroissante :

```
prev_dechargement_at → port_arrival_date → departure_date → null
```

---

## 3. Composants

### 3.1 `FlowBoard` — Orchestrateur

Point d'entrée de la feature. Reçoit `detail` (paramètre d'URL `/stock/arrivage/:detail?`, transmis par `StockTabs`/`Stock.tsx`) et en **dérive** l'état d'ouverture des sheets — pas de `useState` local :

```tsx
const creationOpen = detail === "new"
const editRow = detail && detail !== "new"
    ? rows?.find(r => r.id === detail) ?? null
    : null
```

Un `useEffect` de garde redirige vers `/stock/arrivage` si `detail` est un id inconnu une fois les `rows` chargées (deep-link vers un conteneur supprimé/inexistant). Ouvrir/fermer une sheet = `navigate()` (`/stock/arrivage/new`, `/stock/arrivage/{id}`, `/stock/arrivage`) — voir [`docs/ROUTING.md`](./ROUTING.md) pour le principe général.

Calcule aussi le **poids total** de tous les arrivages :

```tsx
const totalPoids = useMemo(
    () => rows?.reduce((acc, r) => acc + (r.total_weight_kg ?? 0), 0) ?? 0,
    [rows]
)
```

**Permissions contrôlées ici :**
- `stock.arrivage.create` → affichage du bouton "Nouvel arrivage"

---

### 3.2 `ArrivageLimitedTable` — Tableau

#### Tri & regroupement

Les arrivages sont triés par **date de référence décroissante** (plus récent en haut), puis regroupés en en-têtes de mois (`format(date, "MMMM yyyy", { locale: fr })`).

#### Pagination

- Constante : `ARRIVAGE_MONTHS_PER_PAGE = 3` (3 mois par page)
- La page initiale est automatiquement **positionnée sur la page contenant les prochains arrivages** (voir `defaultPage`).
- Les boutons de pagination affichent un **point ambre** (●) si la page contient au moins un des 5 prochains arrivages.

#### Les 5 prochains arrivages

```ts
const nextFiveIds = useMemo(() => {
    const now = new Date()
    return new Set(
        sorted
            .filter(r => r.prev_dechargement_at && new Date(r.prev_dechargement_at) >= now)
            .sort((a, b) => new Date(a.prev_dechargement_at).getTime() - ...)
            .slice(0, 5)
            .map(r => r.id)
    )
}, [sorted])
```

Ces lignes sont mises en avant avec un **fond ambre** et une **bordure gauche ambre**.

#### Alerte facture (`isArrivageInvoiceAlert`)

Déclenche un fond rouge + icône `AlertTriangle` dans la colonne Facture quand :
- Pas de `invoice_date`
- Statut ≠ `annulé`
- `daysFromDechargement(prev_dechargement_at) ≤ 7` (J-7 ou passé)

```ts
export function isArrivageInvoiceAlert(row): boolean {
    if (row.invoice_date) return false
    if (row.status === "annulé") return false
    const days = daysFromDechargement(row.prev_dechargement_at)
    return days !== null && days <= INVOICE_ALERT_DAYS  // INVOICE_ALERT_DAYS = 7
}
```

#### Colonnes du tableau

| Clé | Label | Largeur | Priorité visuelle |
|-----|-------|---------|------------------|
| `status` | Statut | 8% | normale |
| `fournisseur` | Fournisseur | 16% | normale |
| `facture` | Facture | 8% | normale |
| `depart` | Départ | 7% | normale |
| `havre` | Le Havre | 7% | normale |
| `mode` | Mode | 7% | normale |
| `conteneur` | N° Conteneur | 13% | normale |
| `dechargement` | Déchargement | 14% | **importante** (icône CalendarClock) |
| `poids` | Poids (kg) | 7% | normale |
| `qty` | Quantité | 6% | normale |
| `interne` | N° Interne | 9% | normale |
| `actions` | — | 4% | normale |

**Permission d'édition :** `stock.arrivage.update` → bouton crayon visible au hover.

#### `StatusBadge`

Affiche le badge coloré + un **point ambre** si `status_auto = true` (tooltip : "Statut positionné automatiquement — confirmation requise").

---

### 3.3 `ArrivageLimitedCreationSheet` — Création

Sheet latérale (droite). Validation minimale : `fournisseur_id` + `container_no` requis.

**Champs :**

| Section | Champ | Obligatoire |
|---------|-------|-------------|
| Identification | Fournisseur | ✅ |
| Identification | N° Conteneur | ✅ (mis en majuscule auto) |
| Identification | N° Conteneur interne | — |
| Identification | Date facture | — |
| Transport | Mode de transport | — |
| Transport | Date de départ | — |
| Poids & quantité | Poids (kg) | — |
| Poids & quantité | Quantité | — |

Le formulaire se réinitialise (`EMPTY_FORM`) à la fermeture (annulation ou succès).

Appelle `create()` du context avec les champs normalisés (`.trim().toUpperCase()` pour `container_no`, conversion `Number()` pour poids/qty).

---

### 3.4 `ArrivageLimitedEditSheet` — Édition

Sheet latérale enrichie. Contient **tous les champs de création + les champs supplémentaires** :

| Section | Champ | Notes |
|---------|-------|-------|
| Identification | N° Conteneur | Modifiable |
| Identification | N° Interne | — |
| Identification | Fournisseur | — |
| Prévision déchargement | Date & heure prévues | `datetime-local`, converti en UTC ISO à la sauvegarde |
| Facturation | Date facture | — |
| Statut | Statut | 4 valeurs : `planifié`, `en_transit`, `reçu`, `annulé` |
| Transport | Mode | — |
| Transport | Départ | — |
| Transport | Arrivée Le Havre | — |
| Transport | Poids + Quantité | — |
| Notes | Notes | Textarea libre |

**Logique `toLocalDatetimeInput`** : Convertit un timestamp UTC en format `YYYY-MM-DDTHH:mm` dans le fuseau local du navigateur pour l'affichage dans `<input type="datetime-local">`. À la sauvegarde, reconverti en ISO UTC via `new Date(value).toISOString()`.

**Alertes dans le formulaire :**

1. **Alerte rouge "Facture manquante"** : affichée quand `showInvoiceAlert = true`. Met en rouge le label + la bordure du champ `invoice_date` et du champ `prev_dechargement_at`. Affiche le jour J relatif (ex: "J-3").

2. **Alerte ambre "Statut automatique"** : affichée quand `form.status_auto = true`. Le bouton "OK" appelle `setForm(f => ({ ...f, status_auto: false }))`.

**Confirmation statut auto :** À la sauvegarde, `status_auto` est toujours mis à `false` (sauvegarder = confirmer le statut).

**Helpers d'affichage :**

```ts
// Affichage J-X / J+X
function jLabel(days: number): string {
    if (days === 0) return "J"
    return days > 0 ? `J-${days}` : `J+${Math.abs(days)}`
}

// Texte descriptif
function dechargementAlertText(days: number): string { ... }
```

---

### 3.5 `ExportArrivageButton` — Export Excel

#### Permissions

- Bouton entier masqué si `!hasPermission("stock.arrivage.export")`
- Chaque colonne Excel est filtrée par : `hasPermission("stock.arrivage.newsletter.<permKey>")`

> ℹ️ **Permission partagée avec la newsletter, pas une collision** : correction par rapport à une version précédente de cette doc. Ce permKey `stock.arrivage.newsletter.<permKey>` n'est **pas** propre à l'export : il est **volontairement réutilisé à l'identique** par la newsletter (`features/profile/hooks/data/useNewsletterSubscription.ts`, catalogue dans `features/profile/constants.ts` — §3.7) pour filtrer les colonnes qu'un abonné peut choisir de recevoir par e-mail. Les deux composants partagent exactement le même jeu de clés (`status`, `fournisseur_name`, `fournisseur_lieu`, `container_no`, `internal_ref`, etc.) — c'est un seul et même contrôle de sensibilité par colonne, appliqué aux deux canaux de diffusion (export manuel et newsletter). Le nom `newsletter.<permKey>` reste trompeur (il ne concerne pas que la newsletter), mais **le renommer sans précaution casserait le partage de permission entre les deux fonctionnalités** : voir [`docs/tickets/clarify-arrivage-newsletter-column-permkey.md`](./tickets/clarify-arrivage-newsletter-column-permkey.md) pour l'analyse d'impact avant tout renommage.

#### Colonnes exportées

| Header | permKey | Type | Emphasis |
|--------|---------|------|---------|
| Statut | `status` | text | normal |
| Fournisseur | `fournisseur_name` | text | normal |
| Date facture | `invoice_date` | date | **alert** (rouge) |
| Départ | `departure_date` | date | normal |
| Le Havre | `port_arrival_date` | date | normal |
| Mode | `transport_mode` | text | normal |
| N° Conteneur | `container_no` | text | normal |
| Déchargement | `prev_dechargement_at` | text | **important** (ambre) |
| Poids (kg) | `total_weight_kg` | number | normal |
| Quantité | `total_qty` | number | normal |
| N° Interne | `internal_ref` | text | normal |
| Lieu | `fournisseur_lieu` | text | normal |
| Notes | `notes` | text | normal |

#### Modes d'export

| Mode | Déclencheur | Comportement |
|------|-------------|--------------|
| Rapide | Bouton "Exporter" | Toutes les lignes |
| Par période | Icône calendrier → date range → "Télécharger" | Filtré par `referenceArrivageManuel(r)` dans la plage choisie |

#### Fichier généré

- Format : `.xlsx` (librairie `xlsx-js-style`)
- Nom : `arrivages_YYYY-MM-DD.xlsx` (rapide) ou `arrivages_DD-MM-YYYY_DD-MM-YYYY.xlsx` (période)
- Feuille : `"Arrivages"`

#### Structure du classeur (`buildWorkbook`)

1. **Ligne d'en-tête** (ligne 0) : fond coloré par emphasis (`111827` normal, `1E40AF` important, `991B1B` alert), texte blanc, police Calibri 10 bold.
2. **Bannière de mois** : une ligne fusionnée sur toute la largeur ouvrant chaque bloc, fond `374151`, texte blanc gras, libellé `"SEPTEMBRE 2026 · 7 arrivages"`.
3. **Lignes de données** : fond alternant blanc/gris (normal), blanc/bleu clair (important), blanc/rose (alert).
4. **Ligne de total mensuel** : fond gris-300, label "↳ Total Mois YYYY" en colonne 0, poids total en colonne `total_weight_kg`. Fusionne les cellules label + les cellules après le poids.
5. **Options classeur** : colonnes gelées (1ère ligne), autofiltre, largeurs de colonnes définies par `ColDef.width`.

> ⚠️ **La bannière doit rester au-dessus de son bloc.** Jusqu'en v1.5, le mois n'était annoncé que par la ligne de total placée *sous* ses lignes : en lisant de haut en bas, les lignes d'un mois apparaissaient avant tout libellé, puis le libellé du mois précédent — les utilisateurs rattachaient donc un bloc au mauvais mois. Les trois fonds (`111827` en-tête → `374151` bannière → `D1D5DB` total) sont volontairement distincts pour rester lisibles en noir et blanc.

La mise en page est dupliquée dans le service Go (`newsletter-console/internal/excel/generator.go`) : toute évolution ici doit être répercutée là-bas, et réciproquement. Le test `TestGenerateForSubscriberWritesMonthBannerBeforeRows` garde la position de la bannière côté Go.

---

### 3.6 `PackingListSheet` — Import et vérification de packing list ⚠️ Non déployé

> **Statut : front, schéma et service `packing-api` prêts sur les branches `features/stock-packing` (front) et `feature/learning-classifier` (`packing-api`).** Migrations `20260915100000_stock_packing_list.sql` (appliquée en base de dev), `20260917100000_stock_packing_list_document_shape.sql`, `20260917101000_stock_packing_label_dictionary.sql` et `20260918100000_stock_packing_learning.sql`. Cette version **remplace** l'approche de la branche `features/arrivages-packing` (tables `factures` / `items` / `packages`, permKey `stock.arrivage.packing.import`), qui n'est pas reprise. Le dépôt `packing-api` est conservé mais entièrement réécrit.

La packing list attache l'inventaire d'un conteneur (fichier Excel du fournisseur) à un arrivage **déjà existant**. Elle ne crée pas d'arrivage.

#### Le document réel

Relevé sur deux packings du fournisseur, `CONTENEUR GR153` et `GR154` :

```
CONTENEUR GR 153                                    ← titre, ligne 1
ITEM # │ DESCRIPTION   │ (*) │ KGS │ PCS │ QTY │ TOTAL PCS/KG   ← ligne 3
   1   │ POLO T-SHIRT  │     │     │ 200 │  20 │ 4000      ← régime « pcs »
  12   │ LADIES CORSET │     │  25 │ KGS │   3 │   75      ← régime « kgs »
                                    │ 548 │                ← ligne de totaux
TOTAL : 548 - PACKAGES (MIXED USED CLOTHING)               ← pied de page
```

**QTY est un nombre de COLIS** : la seule grandeur additive du document, et la seule que le fournisseur totalise lui-même. `KGS` ou `PCS` décrit le contenu d'UN colis selon le régime de la ligne. `TOTAL PCS/KG` mélange pièces et kilos dans une même colonne — il ne se somme jamais. Sur GR153, **93 lignes sur 97 ne portent aucun poids**.

| | GR153 | GR154 |
|---|---|---|
| lignes / libellés distincts | 97 / 88 | 139 / 122 |
| feuille | `Invoice` | `Sheet1` |
| ΣQTY vs total annoncé | **543 vs 548 ✗** | 553 vs 553 ✓ |
| lignes en régime KGS | 4 | 10 |

La colonne sans en-tête portant `(*)` est **ignorée** : décision du demandeur, ce marqueur n'a pas de sens métier. Elle reste dans `raw_row`.

#### Parcours

```
Tableau Flux ── icône au survol (2 états) ──┐
Fiche arrivage ── section « Packing list » ─┴─▶ PackingListSheet (remplace la fiche)
   1. dépôt du fichier .xlsx                 (stock.packing.create)
   2. packing-api : lecture, tableau de correspondance, modèle appris
                                             → brouillon « À vérifier »
   3. vérification en quatre strates         (stock.packing.update)
      · RECONNUS   — déjà validés sur un autre conteneur : rien à faire,
                     repliés, annoncés en bandeau
      · À CLASSER  — le seul vrai travail ; ↑/↓ naviguent, Entrée TRAITE le
                     libellé (confirme la proposition s'il y en a une, ouvre la
                     liste sinon), Espace ouvre toujours la liste, et la liste
                     elle-même se parcourt au clavier (↑/↓, Entrée, Échap) :
                     l'enchaînement est complet sans souris, ce qui compte
                     surtout au démarrage où presque aucun libellé n'a de
                     proposition ; corriger un libellé corrige toutes ses
                     lignes ; les chiffres 1-5 rejouent les dernières
                     catégories retenues (pastilles sur la carte focalisée) ;
                     Ctrl/⌘+Z défait la dernière décision ; cocher plusieurs
                     libellés les classe d'un coup (Maj-clic pour une plage) ;
                     la barre porte une recherche par libellé et un tri
                     « par risque » / « par libellé » ;
                     catégorie absente (« SHORT HAWAII ») → taper son nom
                     dans la recherche puis « Nouvelle catégorie » ou Entrée :
                     créée aussitôt (nom seul ; tag, prix, poids à compléter
                     dans Paramètres) et attribuée ; pas de doublon d'un
                     libellé existant (exige aussi stock.settings.create)
      · CLASSÉS AUTOMATIQUEMENT — par le modèle, sous garde calibrée :
                     dépliés, confiance affichée, corrigeables
      · CLASSÉS    — tranchés dans cette session
   4. validation (refusée par la base tant qu'une ligne n'a pas de catégorie)
      → un dialogue annonce d'abord ce que ce conteneur ENSEIGNE : combien de
        correspondances nouvelles, combien mises à jour, et que les lignes du
        modèle n'y entrent pas. Rien d'appris (tout venait du tableau) : pas de
        dialogue, on valide.
      → les libellés validés entrent dans le tableau de correspondance
```

#### Annuler une décision — ce que ça défait vraiment

`Ctrl/⌘+Z` (ou le bouton, qui NOMME le libellé) remet le dernier geste en l'état. La pile fait trois gestes, vit dans `usePackingList` — propriétaire des écritures — et se vide à toute relecture des lignes.

**Elle n'enregistre un geste que si toutes les lignes touchées étaient SANS catégorie.** Ce n'est pas une limite technique mais une limite d'honnêteté : le trigger `packing_label_feedback_record` supprime la ligne de `packing_label_feedback` quand `category_id` repasse à `NULL`, et ne fait **rien** quand on restaure une autre catégorie. Annuler la correction d'un libellé déjà classé laisserait donc l'exemple en base — l'écran dirait « annulé », la base dirait le contraire. Le cas n'ouvre simplement pas l'annulation ; il couvre 100 % du démarrage à froid, qui est ce que le geste sert à alléger.

#### Traiter une famille de libellés d'un coup

L'ordre par défaut (colis décroissants) est le bon pour **arbitrer le risque** et le pire pour **traiter une famille** : les six « … JACKET » d'un conteneur sont dispersés dans soixante-dix cartes. D'où la recherche par libellé (normalisée : « tshirt » trouve « T-SHIRT », « jkt » trouve « JACKET ») et le tri par libellé, qui ne mélange jamais les strates entre elles.

Mesuré sur les deux packings réelles : **121 libellés sur 121 de GR154 partagent un jeton avec un autre**, « jacket » en rassemble 39, « shirt » 35 ; sur GR153, « shirt » 29 et « jacket » 23. C'est ce qui justifie la sélection multiple (cases à cocher, Maj-clic pour une plage, confirmation au-delà de dix libellés).

Le geste de masse est un **ACCEPT, pas un ASSIGN** : il ne remplit que les lignes encore sans catégorie, et ne touche pas celles qu'un humain a déjà réattribuées. Côté service, `assignManyUnmatched` regroupe par catégorie : N libellés vers une même catégorie coûtent **une** écriture.

Un regroupement flou peut donc **ordonner** l'écran, jamais décider : `category_id` reste écrit par la seule correspondance exacte du tableau ou par un geste humain.

#### Deux contrôles à ne pas confondre

**L'intégrité du fichier** — le document se recoupe-t-il lui-même ? `Σ package_count = declared_package_count`, et par ligne `units_per_package × package_count = declared_total`. C'est ce contrôle qui **dispense l'utilisateur de relire 180 lignes** : s'il passe, l'arithmétique est saine et il ne reste qu'à arbitrer les catégories. Sur les deux packings réelles, il échoue une fois sur deux (GR153 : 543 ≠ 548, plus 3 lignes sans total).

**L'écart avec la saisie** — les totaux saisis sur l'arrivage **ne sont jamais écrasés** : la fiche et la barre de vérification affichent l'écart, et la colonne Quantité du tableau signale une packing validée qui diverge au-delà de `PACKING_GAP_TOLERANCE` (2 %). La « Quantité » d'un arrivage étant un nombre de **colis**, c'est à `total_packages` qu'elle se compare. Le poids n'est comparé que si la packing en porte vraiment : sur un document en pièces, `total_weight_kg` vaut 0 et ce zéro veut dire « non renseigné ».

`container_label` (le titre lu dans le fichier) est confronté au **n° de conteneur interne** de l'arrivage (`conteneur_no_raw`, « GR 153 ») : une packing juste mais **attachée au mauvais arrivage** est signalée avant validation. On cherche une **présence, pas une égalité** — le titre s'écrit « CONTENEUR GR 153 », « PACKING LIST GR153 », « GR-153 (DXB) » —, et à défaut d'inclusion littérale, la seule suite de chiffres suffit. Le n° ISO (`container_no`, « CSLU6080095 ») ne sert qu'en confirmation : il n'apparaît pratiquement jamais sur une packing list, donc son absence du titre ne signale rien. Sans n° interne saisi, la console ne se prononce pas au lieu d'alerter.

#### Réduire la charge sans rien relâcher

Un conteneur porte 90 à 140 libellés presque tous distincts : les regrouper à l'intérieur du fichier ne fait gagner que 9 % de décisions. Ce qui se répète, c'est le **vocabulaire du fournisseur d'un conteneur au suivant**. D'où `packing_label_category`, alimenté par la seule validation d'une packing list, et éditable dans Paramètres → Correspondances.

Mesure : dictionnaire appris sur GR153, puis import de GR154 → **47 des 121 libellés (55 lignes sur 139) reconnus sans aucune décision**. La couverture monte à chaque conteneur validé, parce que le vocabulaire est fini.

**Règle de rigueur, à ne pas assouplir.** `category_id` n'est pré-rempli que sur correspondance **exacte** du tableau (`resolution = 'dictionary'`). Tout rapprochement approximatif n'écrit que `suggested_category_id` + `match_confidence` et laisse `category_id` nul, donc la validation fermée. Un trigramme à recall utile (0,60) porterait la couverture à 71 % mais intervertit les marques à confiance 0,72-0,84 — `BRAND FEATHER JACKET` → NF FEATHER JACKET, `DENIM JACKET TOMMY` → LLW DENIM JACKET, `COTTON PANTS POLO` → LVS COTTON PANTS — sans qu'un relecteur le voie. Une proposition peut suggérer, jamais retenir.

Le libellé brut du fichier (`raw_label`) reste affiché à côté de la catégorie proposée et de la catégorie retenue : c'est ce qui rend l'erreur de correspondance visible.

#### Apprendre de chaque décision

Le tableau de correspondance ne reconnaît que des libellés **identiques**. Dès que le fournisseur varie (« POLO MEN SHIRT » puis « POLO LADIES SHIRT »), il ne sert plus. `packing-api` entraîne donc un modèle sur les **décisions humaines**, stockées en base :

- **Journal.** Chaque UPDATE `resolution = 'human'` du front (confirmer, réattribuer, corriger une ligne) est journalisé par trigger dans `packing_label_feedback`, **avec la proposition affichée à ce moment**. Une correction remplace la décision précédente. Rien à faire côté client.
- **Poids.** Une décision sur une packing validée pèse 1, sur une packing encore en revue 0,3 : elle peut encore changer.
- **Modèle.** Naive Bayes multinomial sur les mots de la clé normalisée, réentraîné en mémoire à chaque import (quelques millisecondes). Rien n'est persisté hors des décisions : la base est la seule source de vérité.
- **Garde.** Le modèle écrit `category_id` avec `resolution = 'model'` seulement si les trois conditions tiennent : (1) confiance ≥ un seuil **calibré** sur la précision réelle de ses propositions passées, 98 % sur au moins 50 propositions vérifiées (`AUTO_TARGET_PRECISION`, `AUTO_MIN_EVIDENCE`), sinon pas de seuil et donc **aucune auto** ; (2) écart ≥ 0,2 avec la deuxième catégorie ; (3) **aucun mot inconnu**. Une marque jamais vue bloque l'auto, ce qui répond aux inversions de marque mesurées plus haut.
- **Pas d'auto-renforcement.** Une ligne classée par le modèle et validée sans retouche n'entraîne pas le modèle et n'entre pas dans le tableau de correspondance. Elle est journalisée `decision = 'implicit'` et sert **uniquement à mesurer** sa précision. Sans cette mesure, seules ses erreurs (corrigées) seraient tracées et l'auto se couperait d'elle-même. Rouvrir la packing retire ces mesures.
- **Mesure de progrès.** `packing-api/scripts/replay.py` rejoue l'historique validé de la base, conteneur par conteneur. Sur des conteneurs simulés (vocabulaire fini, catégorie = marque × article), les lignes à trancher passent de 120 à 13 en huit conteneurs, avec 1 erreur sur 213 lignes classées seules.

Chaque import pose sa trace d'audit dans `packing_list.classifier_meta` : seuil utilisé, précision mesurée, nombre d'exemples, répartition des lignes.

L'état de l'apprentissage se lit **là où l'on classe** et non seulement dans Paramètres → Correspondances : `PackingLearningNote` pose sous la barre de progression ce qu'il manque au classement automatique pour s'activer, et, au premier conteneur d'un vocabulaire, dit pourquoi rien n'est reconnu. La phrase est produite par `utils/packingLearning.ts` et partagée avec le panneau des paramètres — deux rédactions des mêmes nombres finissent toujours par diverger. Service injoignable : rien ne s'affiche dans la vérification, l'indisponibilité n'y est pas réparable et ne bloque pas le travail.

#### Contrat du service `packing-api`

```
POST ${PUBLIC_PACKING_API_URL}/packing-lists
Authorization: Bearer <JWT Supabase de l'utilisateur>
multipart/form-data : file (.xlsx), arrivage_manuel_id
→ 201 { packing_list_id, status: "a_verifier" | "echec" }
→ 401 jeton · 403 sans MFA ou sans droit · 409 packing déjà présente
→ 413 trop gros · 422 fichier non reconnu               ({ error, detail })

GET ${PUBLIC_PACKING_API_URL}/model/stats → état de l'apprentissage
```

Le client n'affiche que `detail`. Le service écrit `packing_list` et `packing_list_ligne` **avec le JWT de l'utilisateur**, via PostgREST et la clé anon (jamais en service role), pour que la RLS, `imported_by` et l'auteur de chaque décision journalisée restent vrais. Le fichier est lu **avant** toute écriture : un fichier illisible répond 422 sans laisser de packing en échec sur l'arrivage. Détail des colonnes : docblock de `services/packingImportService.ts`. Configuration : `SUPABASE_URL` (`https://apidev.nokk-project.example` en dev, `https://api.nokk-project.example` en prod), `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`.

**La référence de parsing est `utils/packingDocument.ts`**, dont le test tourne sur les deux vrais fichiers (`src/features/stock/__fixtures__/packing/`) et fige lignes, régimes, totaux et anomalies. `packing-api/app/document/parser.py` en est un portage ligne à ligne et repasse le même corpus (`tests/test_document.py`). Sept pièges du format y sont documentés — en-tête non positionnel, cellules `ITEM #`/`DESCRIPTION` fusionnées à reporter (9 lignes de continuation sur GR153), littéral « KGS » dans la colonne PCS, numéro d'article dupliqué (`9` deux fois sur GR153), pied de page à ne pas prendre pour un article, plage `!ref` trop large.

`normalize_packing_label(text)` en base est l'**arbitre** du normaliseur (v2) : le front et `packing-api` (`app/normalizer.py`, transcription littérale du SQL) doivent produire la même clé, sinon le tableau de correspondance cesse silencieusement de reconnaître. D'où `normalizer_version` sur les lignes et sur le tableau.

`.xls` est refusé côté front (`PACKING_ACCEPTED_EXTENSIONS`) et côté service : c'est un autre format binaire, qu'`openpyxl` ne lit pas.

#### Données

| Objet | Rôle |
|---|---|
| `packing_list` | En-tête, une par arrivage (`UNIQUE`, `ON DELETE CASCADE`) ; statut `en_traitement` → `a_verifier` → `validee` (ou `echec`). Porte `container_label`, `source_sheet`, `declared_package_count` |
| `packing_list_ligne` | Libellé brut + clé normalisée + `normalizer_version`, `source_row`, les quatre nombres du document (`package_count`, `units_per_package`, `unit_kind`, `declared_total`), catégorie proposée / retenue, `suggestion_source`, `resolution` (`dictionary` · `model` · `human`) |
| `packing_label_category` | Tableau de correspondance libellé → catégorie, avec `hit_count` et `last_container_label` |
| `packing_label_feedback` | Journal des décisions : une par ligne, avec la proposition affichée (catégorie, source, confiance). `explicit` = choix humain, entraîne le modèle ; `implicit` = ligne du modèle validée sans retouche, mesure seulement. Écrit par trigger uniquement, lecture `stock.packing.view` |
| `v_packing_list_summary` | En-tête + totaux et compteurs calculés, jamais stockés : `total_packages`, `total_pieces`, `total_weight_kg`, `lines_unmatched`, `lines_from_dictionary`, `lines_from_model`, `rows_failing_math`, `package_count_gap`. Pièces et kilos retiennent `declared_total`, et à défaut `units_per_package × package_count` — le fournisseur laisse la colonne TOTAL vide sur 3 lignes en kilos sur 4 (GR153) à 9 sur 10 (GR154) |
| `validate_packing_list` / `reopen_packing_list` | RPC `SECURITY INVOKER` de cycle de vie. La validation enseigne le tableau de correspondance, hors lignes classées par le modèle |
| `normalize_packing_label` | Normaliseur de référence, `IMMUTABLE` |

Pas de colonnes de prix : extension ultérieure de `packing_list_ligne`.

---

### 3.7 `newsletter-console` — Newsletter par abonnement e-mail

Service Go séparé (dépôt `newsletter-console`), distinct de l'export Excel manuel (§3.5). Envoie périodiquement, par e-mail, un état à jour du tableau des arrivages aux personnes abonnées.

#### Permissions

- `stock.arrivage.newsletter.view` → ouvre l'onglet Intégrations du profil et y affiche la carte d'abonnement (`features/profile/routes/Profile.tsx`, `components/integrations/IntegrationsTab.tsx`) — **en prod**
- `stock.arrivage.newsletter.admin` → accès à la page d'administration des abonnés (Console) — **en prod**
- `stock.arrivage.newsletter.send` → autorise le renvoi manuel depuis la page admin (`ArrivageAdmin.tsx`) — **preprod uniquement**, migration `20260703120000_newsletter_send_permission.sql` non encore mergée en prod
- `stock.arrivage.newsletter.<permKey>` → contrôle, colonne par colonne, ce qu'un abonné peut choisir d'inclure dans son e-mail (mêmes clés que la liste des colonnes exportées, §3.5) — **en prod**. **Ce même permKey est aussi utilisé par `ExportArrivageButton.tsx` (§3.5)** : c'est une permission de sensibilité de colonne partagée entre les deux canaux, pas une permission propre à la newsletter.

#### Composants front (Console)

| Élément | Rôle |
|---------|------|
| `features/profile/components/integrations/NewsletterCard.tsx` (+ `hooks/data/useNewsletterSubscription.ts`, `services/newsletterService.ts`) | Abonnement/désabonnement, choix des colonnes reçues (`NEWSLETTER_COLUMNS` dans `features/profile/constants.ts`, mêmes clés que §3.5) |
| `features/arrivage-admin/routes/ArrivageAdmin.tsx` | Page admin : liste des abonnés + bouton de renvoi manuel (preprod uniquement) |

#### Composants back (`newsletter-console`, dépôt séparé)

| Élément | Rôle |
|---------|------|
| `internal/mailer` | `SendArrivageNewsletter(...)` — construit et envoie l'e-mail (sujet "Tableau des arrivages — \<date\>", pièce jointe Excel) |
| `internal/subscription` | `Subscribe(...)` (avec code d'invitation), `Unsubscribe(...)` |
| `cmd/server` | Routes `POST /subscribe`, `DELETE /unsubscribe`, `POST /pipeline/trigger` |
| `internal/webhook` + `internal/debounce` | Écoute les changements Supabase (création/modification/suppression d'un arrivage) et regroupe les envois rapprochés avant déclenchement |

> L'abonnement/désabonnement, le choix des colonnes et l'envoi automatique déclenché par webhook sont en production. Seul le bouton de renvoi manuel côté admin (`ArrivageAdmin.tsx`, permission `.send`) n'est pas encore disponible en prod.

---

### 3.8 `PrintArrivageButton` — Impression A4

Bouton « Imprimer » placé à gauche des boutons d'export dans la barre d'outils de `FlowBoard`. Il ouvre un dialog qui laisse choisir un format et une période, affiche l'aperçu, puis déclenche `window.print()`.

#### Permissions

Mêmes gardes que l'export (§3.5), sans nouveau permKey : le bouton est masqué sans `stock.arrivage.export`, et les colonnes du format détaillé sont filtrées par `stock.arrivage.newsletter.<permKey>`. Ce sont les mêmes données qui sortent de l'application.

#### Formats

| Format | Orientation | Contenu |
|--------|-------------|---------|
| Détaillé | A4 paysage | Réplique du classeur : toutes les colonnes autorisées, en-têtes colorés par emphase, zébrage, bannière de mois, ligne de sous-total. En-têtes de colonnes répétés à chaque page (`display: table-header-group`) |
| Simple | A4 paysage | Tableau compact à huit colonnes — Fournisseur, Date facture, Départ, Le Havre, N° Conteneur, Déchargement (`Lun 08/09/26 14:30`), Poids, Qté — **sans la colonne Statut**, groupé par mois avec bannière (compte + poids). Date facture et Déchargement portent les mêmes emphases que le classeur (rouge / bleu). Les arrivages en alerte facture portent un `⚠` dans la colonne Facture, un fond rosé et un filet rouge en marge, avec légende en pied de page |

La période est sélectionnée dans le dialog (même `Calendar` en mode plage que l'export, réduit à un mois sous 768 px via `useIsMobile`), **pré-remplie sur le mois en cours**, et filtrée par `filterArrivagesByRange` — la même fonction que l'export par période.

#### Mécanique d'impression

Aucune dépendance ajoutée : pas de jsPDF, pas de `react-to-print`. `ArrivagePrintDocument` est rendu **deux fois** à partir du même composant — une fois dans le dialog (aperçu, mis à l'échelle par `zoom`, avec des paliers à 1280 / 900 / 640 px pour que la page A4 paysage tienne dans la modale à toutes les tailles) et une fois dans un portal `.apd-root` enfant direct de `<body>`, masqué à l'écran. `print.css` réduit l'impression à ce seul portal :

```css
@media print {
    body > *:not(.apd-root) { display: none !important; }
    .apd-root { display: block !important; }
}
```

Deux conséquences à connaître avant de toucher à ce fichier :

- le portal Radix qui porte le dialog est lui aussi un enfant direct de `<body>` : il est donc masqué par la même règle, et l'aperçu n'est jamais imprimé en double ;
- Radix verrouille le scroll du `<body>` tant qu'une modale est ouverte, d'où le `body { overflow: visible !important; height: auto !important }` en `@media print`, sans lequel le document serait tronqué à la hauteur de la fenêtre.

`@page` ne peut être conditionné ni par classe ni par media query : la règle qui porte `size` est **injectée dans le portal** par `PrintArrivageDialog`. Les deux formats s'impriment en paysage :

```tsx
const pageRule = "@page { size: A4 landscape; margin: 8mm; }"
```

> Déclarer `size` **verrouille l'orientation et grise le sélecteur paysage/portrait** de la boîte d'impression du navigateur. C'est le comportement voulu ici. Retirer `size` rendrait le choix à l'utilisateur, mais le navigateur repartirait alors du portrait par défaut — les deux formats sont dimensionnés pour le paysage.

> ⚠️ Les pages nommées (`@page apdLandscape` + `page: apdLandscape` sur le document) ont été essayées en premier et **ne fonctionnent pas ici** : le navigateur ignorait l'orientation et imprimait les deux formats en paysage. Ne pas y revenir.

`.apd-doc` porte en plus un `padding: 4mm` en `@media print` : la boîte d'impression du navigateur permet de forcer « Marges : aucune », ce qui annule le `margin` de `@page` et collait le document au bord de la feuille. Ce padding fait partie du document, il survit à ce réglage.

La **densité est adaptative** : `pickDensity` (dans `ArrivagePrintDocument`) compte les lignes à placer — lignes de données plus les lignes de structure (bannière de mois, et sous-total pour le format détaillé) — et pose une classe `apd-doc--airy|comfy|normal|dense` sur le document. Chaque palier fixe la taille de police et le padding des cellules dans `print.css`. Sans cela, une période à cinq arrivages sortait en 9 pt sur un A4 paysage, occupant un coin de la feuille.

| Palier | Lignes | Simple (8 col.) | Détaillé (jusqu'à 13 col.) |
|--------|--------|-----------------|-----------------------------|
| `airy` | ≤ 16 | 12 pt | 9,5 pt |
| `comfy` | ≤ 26 | 10,5 pt | 8,5 pt |
| `normal` | ≤ 42 | 9 pt | 7,5 pt |
| `dense` | au-delà | 7,5 pt | 6,5 pt |

Deux échelles distinctes : le format détaillé sature la largeur bien avant le format simple. Les en-têtes de colonnes et les bannières sont dimensionnés en `em`, ils suivent donc le palier au lieu de le contredire.

Les aplats de couleur portent de l'information (alerte facture, colonne mise en avant) : `print-color-adjust: exact` empêche le navigateur de les supprimer. `break-after: avoid` sur les bannières évite qu'un libellé de mois se retrouve seul en bas de page, annonçant un bloc qui commence sur la suivante.

---

## 4. Logique métier clé

### Priorité de la date de référence

```
prev_dechargement_at > port_arrival_date > departure_date > null (→ "Sans date")
```

Utilisée pour : tri, groupement mois, filtre export par période.

### Alerte facture manquante

Seuil : `INVOICE_ALERT_DAYS = 7` jours avant le déchargement prévu.  
Conditions cumulatives :
- Pas de `invoice_date` renseignée
- Statut ≠ `annulé`
- `daysFromDechargement` ≤ 7 (ou déjà passé = valeur négative)

### Transitions automatiques de statut

Deux transitions sont pilotées par le temps, côté DB :

| Transition | Condition |
|-----------|-----------|
| `planifié` → `en_transit` | `departure_date < CURRENT_DATE` |
| `en_transit` → `reçu` | `prev_dechargement_at < NOW()` |

Deux mécanismes les appliquent (migration `20260707140000_arrivage_status_auto_cron.sql`) :

1. **Trigger `BEFORE INSERT OR UPDATE`** (`auto_set_arrivage_status`) : évalue les deux transitions **en chaîne** à chaque écriture — une ligne saisie avec des dates déjà passées atteint directement `reçu`.
2. **Scan pg_cron horaire** (`apply_arrivage_status_transitions()`, job `arrivage-status-auto`, minute 5) : applique les mêmes transitions aux lignes que personne n'édite. C'est lui qui corrige le bug historique « bloqué en_transit » : avant cette migration, seul le trigger existait, donc une ligne non éditée n'était jamais réévaluée.

La date fait foi y compris pour un statut saisi manuellement (`status_auto = false`) : pour maintenir un conteneur retardé en `en_transit`, mettre à jour `prev_dechargement_at`. Les bascules du scan déclenchent le webhook newsletter (debounce 20 min), comme toute écriture dans la table.

### Confirmation de statut automatique

Quand `status_auto = true`, le badge affiche un point ambre. Dans l'éditeur, une bannière ambre invite l'utilisateur à confirmer ou modifier. Toute sauvegarde met `status_auto` à `false`.

---

## 5. Permissions

Depuis la migration `20260707130000_arrivage_manuel_permissions.sql`, la RLS de `arrivage_manuel` applique ces permissions **côté DB, opération par opération** (SELECT→`.view`, INSERT→`.create`, UPDATE→`.update`, DELETE→`.delete`) — l'UI n'est plus la seule barrière.

| Permission | Effet |
|-----------|-------|
| `stock.arrivage.view` | Lecture du tableau (policy SELECT). Attribuée automatiquement aux rôles/services ayant `stock.view` lors de la migration ; sans elle, `FlowBoard` affiche un message d'accès refusé |
| `stock.arrivage.create` | Affiche le bouton "Nouvel arrivage" + policy INSERT |
| `stock.arrivage.update` | Affiche le bouton crayon dans le tableau + policy UPDATE |
| `stock.arrivage.delete` | Policy DELETE — attribuée à **aucun rôle** par défaut (pas de bouton UI, cf. ticket `arrivage-delete-dedicated-permission.md`) |
| `stock.arrivage.export` | Affiche les boutons d'export (§3.5) et d'impression (§3.8) |
| `stock.packing.view` | ⚠️ **Non déployé** — consulter la packing list d'un arrivage (§3.6). Backfill : détenteurs de `stock.arrivage.view` |
| `stock.packing.create` | ⚠️ **Non déployé** — importer une packing list. Backfill : détenteurs de `stock.arrivage.update` |
| `stock.packing.update` | ⚠️ **Non déployé** — vérifier, valider, rouvrir. Backfill : détenteurs de `stock.arrivage.update` |
| `stock.packing.delete` | ⚠️ **Non déployé** — supprimer ou remplacer une packing list. Attribuée à **personne** par défaut |
| `stock.arrivage.newsletter.view` | Affiche la carte d'abonnement newsletter dans le profil (§3.7) — en prod |
| `stock.arrivage.newsletter.admin` | Accès à la page d'administration des abonnés newsletter (§3.7) — en prod |
| `stock.arrivage.newsletter.send` | Autorise le renvoi manuel de la newsletter (§3.7) — ⚠️ **preprod uniquement**, pas encore en prod |
| `stock.arrivage.newsletter.<permKey>` | Contrôle, colonne par colonne, la visibilité d'un champ sensible — **partagé** entre l'export Excel (§3.5) et le choix des colonnes de la newsletter (§3.7). Le nom prête à confusion (il ne concerne pas que la newsletter) mais ne pas renommer sans analyse d'impact — voir [`docs/tickets/clarify-arrivage-newsletter-column-permkey.md`](./tickets/clarify-arrivage-newsletter-column-permkey.md) |

> ⚠️ **Écart résiduel — suppression** : `stock.arrivage.delete` existe et garde la policy `arrivage_manuel_delete` depuis `20260707130000_arrivage_manuel_permissions.sql`, mais elle n'est attribuée à **aucun rôle** et n'a **pas de bouton dans l'UI** : la suppression d'un arrivage n'est possible que par une attribution manuelle depuis `/administration`. En revanche, `arrivage_state_delete` (`supabase/migrations/20260421121000_arrivages_rls.sql:200`) reste conditionnée à `has_permission('stock.view')` — soit la même permission que la simple lecture, sans palier dédié. Détail : [`docs/tickets/arrivage-delete-dedicated-permission.md`](./tickets/arrivage-delete-dedicated-permission.md).

### 5.1 Référentiel & historique (onglets Paramètres / Historique)

Depuis `20260818120000_stock_settings_permissions.sql`, les tables `categories_gestion` et `fournisseur_gestion` — jusque-là sans aucune policy versionnée — sont gardées par permKey, opération par opération, avec la même exigence AAL2 que le reste du module. Les codes sont regroupés dans `STOCK_PERMISSIONS` (`src/features/stock/constants.ts`) ; l'UI ne lit plus aucun littéral.

| Permission | Effet |
|-----------|-------|
| `stock.settings.view` | Affiche l'onglet **Paramètres** (`STOCK_TABS` dans `src/features/stock/types/ui.types.ts`). Attribuée automatiquement aux rôles/services ayant `stock.arrivage.view` lors de la migration ; sans elle, `/stock/parametres` redirige vers `/stock/arrivage` |
| `stock.settings.create` | Bouton « Nouveau » des listes fournisseurs/catégories + policy INSERT sur les deux tables |
| `stock.settings.update` | Bouton crayon (édition inline) + policy UPDATE |
| `stock.settings.delete` | Bouton corbeille (avec confirmation chiffrée) + policy DELETE |
| `stock.history.view` | Affiche l'onglet **Historique** (journal d'activité, analyse fournisseurs, prix des catégories). Backfillée comme `stock.settings.view` |

Les trois permissions d'écriture ne sont attribuées à personne par la migration : elles se donnent au cas par cas depuis `/administration`, ce qui est précisément l'objectif — une fois accordées, l'utilisateur gère son référentiel sans intervention en base.

La policy SELECT des deux tables reste sur `stock.view` : les sélecteurs de catégorie et de fournisseur sont utilisés dans tout le module (sheets d'arrivage, balles, livraisons, export), la restreindre plus casserait ces écrans.

---

## 6. Constantes

```ts
ARRIVAGE_MONTHS_PER_PAGE = 3      // mois affichés par page
INVOICE_ALERT_DAYS       = 7      // jours seuil alerte facture
```

---

## 7. Flux de données

```
Supabase (table arrivage_manuel)
        ↓
StockProvider (Context)  ←→  useArrivageManuelContext()
        ↓                              ↑
FlowBoard                        rows / create() / update()
   ├── ArrivageLimitedTable      (lecture + onEdit callback)
   ├── ArrivageLimitedCreationSheet   (create)
   ├── ArrivageLimitedEditSheet       (update)
   └── ExportArrivageButton           (lecture + export client-side)
```

L'export est **100% client-side** : aucun appel serveur, la librairie `xlsx-js-style` génère le fichier en mémoire et déclenche le téléchargement navigateur.

---

## 8. Points d'attention / comportements non-évidents

- **Parsing des dates sans heure** (`YYYY-MM-DD`) : parsé en `new Date(d + "T00:00")` pour éviter le décalage UTC (minuit local vs minuit UTC → affichage J-1 possible sinon).
- **`prev_dechargement_at` en UTC** : stocké en ISO UTC dans Supabase. `toLocalDatetimeInput()` convertit en local pour l'input. La sauvegarde repart en UTC via `.toISOString()`.
- **Bouton crayon desktop only** : `opacity-0 group-hover:opacity-100` → invisible jusqu'au hover sur desktop, toujours visible sur mobile (`opacity-100 sm:opacity-0`).
- **Page initiale dynamique** : si aucun arrivage futur n'existe, la table affiche la page 0 (mois les plus récents).
- **Notes uniquement en édition** : le champ `notes` (textarea libre) n'est pas exposé à la création — il n'est accessible que via le formulaire d'édition pour ne pas alourdir la saisie initiale.
