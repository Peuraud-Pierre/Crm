# Stock — Documentation technique

## Vue d'ensemble

La feature **Stock** est le module de gestion d'inventaire de La Console. Elle couvre quatre domaines métier :

| Domaine | Description |
|---|---|
| **Balles** | Unités physiques de stock, traçées via un identifiant BIN |
| **Livraisons** | Groupes de balles réceptionnées ensemble, traçés via un DIN |
| **Flow (Arrivages / Départs)** | Containers entrants/sortants alimentés par import Excel |
| **Historique** | Journal d'activité + historique des prix par catégorie |

---

## Architecture

```
routes/Stock.tsx           → Point d'entrée, enveloppe StockProvider
      ↓
StockProvider              → Compose tous les contexts dans le bon ordre
      ↓
stockTabs.tsx              → Navigation onglets (Dashboard / Stock / Flow / Historique / Paramètres)
      ↓
Composants d'onglet        → dashboardTab / stockBoard / flowBoard / historyBoard / settingsBoard
      ↓
Contexts (useBalle, useDelivery, useArrivage…) → Supabase (real-time + RPC)
```

### Flux de données

```
Supabase (DB + real-time)
      ↓
Hooks bas niveau (use_balle, use_delivery, use_shipment…)
      ↓ serverItems
Contexts (BalleContext, DeliveryContext…)
  ├─ useOptimisticCrud  → mutations optimistes avec rollback
  ├─ filtrage local     → useMemo sur serverItems
  └─ état UI            → sheet open/close, sélection active
      ↓
Composants de board / card / sheet / form
```

---

## Fichiers — carte complète

### Types

| Fichier | Rôle |
|---|---|
| `types/type_referential.ts` | `Fournisseur`, `BalleCategory`, `CategoryDistribution` |
| `types/type_balle.ts` | `Balle`, `BalleFormInput`, `BalleFiltersState`, enums (`BalleStatus`, `BalleLocation`, `BalleType`) |
| `types/type_delivery.ts` | `Delivery`, `DeliveryFormInput`, `DeliveryFiltersState` |
| `types/type_shipment.ts` | `ArrivageRow`, `ArrivageItem`, `ArrivagePackage`, `ArrivageStateInput`, `ArrivageFiltersState` + helpers d'incohérences |
| `types/type_history.ts` | `ActivityLog`, `CategoryPriceHistory` |
| `types/type_ui.ts` | `StockTab`, `stockViewMode`, `flowViewMode`, `SettingsNavItem` |
| `types/type_stock.ts` | Barrel — ré-exporte tous les types ci-dessus |

### Hooks & Contexts

| Fichier | Rôle |
|---|---|
| `@/shared/hooks/useOptimisticCrud` | Hook générique CRUD optimiste avec rollback — **déplacé dans `shared/` le 2026-09-07** : il ne connaît aucun domaine, et `stock_handpick` ne pouvait pas l'importer depuis une autre feature |
| `hooks/context/stockProvider.tsx` | Compositeur de tous les providers + barrel de re-exports |
| `hooks/context/stockUIContext.tsx` | État UI global (onglet actif, viewMode, searchInput) |
| `hooks/context/referentialContext.tsx` | Fournisseurs + Catégories avec mutations optimistes |
| `hooks/context/balleContext.tsx` | Balles + filtres + état sheet/form |
| `hooks/context/deliveryContext.tsx` | Livraisons + filtres + état sheet/form |
| `hooks/context/shipmentContext.tsx` | Arrivages/Départs + packing list + détection d'incohérences |
| `hooks/context/settingsContext.tsx` | Métadonnées statuts/locations/types + préférences UI |
| `hooks/context/historyContext.tsx` | Journal d'activité + historique des prix |
| `hooks/Stock/use_balle.tsx` | Fetch balles Supabase + real-time subscription |
| `hooks/Stock/use_delivery.ts` | Fetch livraisons Supabase + real-time subscription |
| `hooks/Stock/use_categorie.ts` | CRUD catégories (bas niveau) |
| `hooks/Stock/use_fournisseur.tsx` | CRUD fournisseurs (bas niveau) |
| `hooks/Stock/use_distribution.ts` | Distribution de catégories dans une livraison |
| `hooks/Stock/shipment/use_shipment.ts` | Fetch arrivages (container state management) |
| `hooks/Stock/shipment/use_packing.ts` | Packing list items + packages |
| `hooks/Stock/shipment/supabase_arrivage.ts` | Cast client Supabase non-typé pour les tables arrivage |

### Composants

| Fichier | Rôle |
|---|---|
| `routes/Stock.tsx` | Route principale, monte `StockProvider` |
| `components/stockTabs.tsx` | Navigation onglets top-level |
| `components/dashboard/dashboardTab.tsx` | Dashboard : KPIs, recherche balles, arrivages, activité |
| `components/stockboard/stockBoard.tsx` | Onglet Stock : bascule Balles / Livraisons |
| `components/flow/flowBoard.tsx` | Onglet Flow : bascule Arrivages / Départs |
| `components/history/historyBoard.tsx` | Onglet Historique : journal + graphique prix |
| `components/settings/settingsBoard.tsx` | Onglet Paramètres : nav latérale + contenu |

### Utilitaires

| Fichier | Rôle |
|---|---|
| `helper_stock.ts` | Génération DIN/BIN, calculs de poids |
| `stock_constants.ts` | Limites de pagination, regex BIC |
| `stock_theme.ts` | Objet Tailwind centralisé (couleurs, typo, composants) |

---

## Domaine typologique

### Référentiel (`type_referential.ts`)

```ts
interface Fournisseur {
    id:                 string
    name:               string
    siege_localisation: string
    tag:                string    // 3 chars — utilisé dans DIN/BIN
    created_at:         string
}

interface BalleCategory {
    id:          string
    name:        string
    tag:         string           // 4 chars — utilisé dans BIN
    unit_price:  number           // prix unitaire THB (snapshot figé à la création de balle)
    unit_weight: number           // poids unitaire kg (conversion pièces → kg)
}

interface CategoryDistribution {
    category_id: string
    count:       number
}
```

### Balle (`type_balle.ts`)

```ts
type BalleStatus   = "stocked" | "used" | "exported" | "transfered" | "imported" | "delivered" | "shipped"
type BalleLocation = "warehouse" | "out" | "import_bay" | "export_bay" | "tri_gros" | "tri_retail" | "handpick"
type BalleType     = "push" | "bags" | "balle" | "palette" | "other"
type PackingMode   = "kilos" | "pieces"

interface Balle {
    id:              string
    bin:             string          // identifiant traçabilité (voir DIN/BIN ci-dessous)
    delivery_id?:    string
    packing:         number          // poids ou nb de pièces selon PackingMode
    import_date:     string
    fournisseur_id:  string
    category_id:     string
    raw_name?:       string          // description brute packing list
    provenance?:     string
    is_original:     boolean         // balle originale vs issue d'un split
    parent_balle_id?: string
    status?:         BalleStatus
    location?:       BalleLocation
    type?:           BalleType
    purchase_price?: number          // prix figé au moment de la création
    treatment_cost?: number          // coût de traitement post-import (à venir)
    fournisseur?:    Pick<Fournisseur, "name" | "siege_localisation"> | null
    category?:       Pick<BalleCategory, "name"> & { poids_unitaire: number } | null
    historique?:     Historique[]
}
```

**Filtres disponibles :**

```ts
interface BalleFiltersState {
    status:         "all" | BalleStatus
    type:           "all" | BalleType
    location:       "all" | BalleLocation
    category_id:    "all" | string
    fournisseur_id: "all" | string
    dateFrom:       string   // ISO date
    dateTo:         string   // ISO date
}
```

### Livraison (`type_delivery.ts`)

```ts
interface Delivery {
    id:             string
    din:            string           // identifiant traçabilité (voir DIN/BIN)
    fournisseur_id?: string
    delivery_date?: string
    delivery_type?: BalleType
    balles_count?:  number
    poids_moyen?:   number
    packing?:       string
    created_by:     string
    created_at:     string
    fournisseur?:   Pick<Fournisseur, "name" | "siege_localisation"> | null
}
```

**Filtres disponibles :**

```ts
interface DeliveryFiltersState {
    fournisseur_id: "all" | string
    type:           "all" | BalleType
    dateFrom:       string
    dateTo:         string
    ballsCountMin:  string
    ballsCountMax:  string
}
```

### Arrivage (`type_shipment.ts`)

```ts
type ArrivageStatus = "planifié" | "en_transit" | "déchargé" | "reçu" | "annulé"
type ArrivageKind   = "arrivage" | "depart"

interface ArrivageRow {
    id:                   string   // alias container_no pour useOptimisticCrud
    container_no:         string   // clé naturelle (BIC ISO 6346)

    // Données facture (upload Excel arrivage-api)
    invoice_no?:          string | null
    invoice_date?:        string | null
    invoice_total?:       number | null
    total_invoice_usd?:   number | null
    convert_rate_thb_usd?: number | null

    // Données transport (backfill Excel)
    origin_country?:      string | null
    transport_mode?:      string | null
    mode_raw?:            string | null   // valeur brute avant normalisation
    conteneur_no_raw?:    string | null   // N° brut avant normalisation BIC
    departure_date?:      string | null
    port_arrival_date?:   string | null
    prev_dechargement_date?: string | null
    total_weight_kg?:     number | null
    total_qty?:           number | null

    // État opérationnel (arrivage_state — seul domaine éditable depuis le front)
    status:          ArrivageStatus
    kind?:           ArrivageKind | null
    fournisseur_id?: string | null
    docked_at?:      string | null
    received_date?:  string | null
    notes?:          string | null
    livraison_id?:   string | null

    fournisseur?: Fournisseur
    livraison?:   Delivery
    items?:       ArrivageItem[]
}
```

> **Règle importante :** Le front ne crée/édite **que** la table `arrivage_state` (état opérationnel). Les données facture et transport sont injectées exclusivement par l'API d'import Excel (`arrivage-api`).

**Filtres disponibles :**

```ts
interface ArrivageFiltersState {
    fournisseur_id:     "all" | string
    status:             "all" | ArrivageStatus
    dateFrom:           string
    dateTo:             string
    withoutFournisseur: boolean   // containers reçus sans fournisseur assigné
}
```

### Historique (`type_history.ts`)

```ts
type ActivityEntityType = "balle" | "delivery" | "category" | "fournisseur"
type ActivityAction     = "create" | "update" | "delete"

interface ActivityLog {
    id:           string
    created_at:   string
    user_id:      string | null
    entity_type:  ActivityEntityType
    entity_id:    string | null
    entity_label: string | null
    action:       ActivityAction
    description:  string | null
    changes:      Record<string, unknown> | null  // diff avant/après
}

interface CategoryPriceHistory {
    id:            string
    created_at:    string
    category_id:   string
    category_name: string | null
    old_price:     number | null
    new_price:     number
}
```

> Les `ActivityLog` sont alimentés par des **triggers Supabase** sur les tables `balles_gestion`, `deliveries_gestion`, `categories_gestion`, `fournisseur_gestion`. Le front ne les écrit jamais directement.

---

## Système de context

### Ordre des providers

```tsx
// stockProvider.tsx
<StockUIProvider>           // état UI global
  <ReferentialProvider>     // données stables partagées
    <BalleProvider>
      <DeliveryProvider>
        <SettingsProvider>
          <ArrivageProvider>
            <HistoryProvider>
              {children}
            </HistoryProvider>
          </ArrivageProvider>
        </SettingsProvider>
      </DeliveryProvider>
    </BalleProvider>
  </ReferentialProvider>
</StockUIProvider>
```

**Principe :** les trois providers métier (Balle, Delivery, Arrivage) sont **frères** — un re-render dans l'un ne propage pas aux autres.

### Imports des contexts

Tous les hooks de context sont re-exportés depuis `stockProvider.tsx` :

```ts
import {
    useStockUIContext,
    useReferentialContext,
    useBalleContext,
    useDeliveryContext,
    useArrivageContext,
    useSettingsContext,
    useHistoryContext,
} from "@/features/stock/hooks/context/stockProvider"
```

### Responsabilités de chaque context

| Context | Données exposées | Mutations exposées |
|---|---|---|
| `StockUIContext` | `activeTab`, `stockViewMode`, `flowViewMode`, `searchInput` | `setActiveTab`, `setStockViewMode`, `setFlowViewMode`, `setSearchInput` |
| `ReferentialContext` | `fournisseurs`, `categories` | `createFournisseur`, `updateFournisseur`, `deleteFournisseur`, `createCategory`, `updateCategory`, `deleteCategory` |
| `BalleContext` | `balles`, `filteredBalles`, `filters`, `selectedBalle`, `isSheetOpen` | `setFilters`, `createBalle`, `updateBalle`, `deleteBalle`, `openSheet`, `closeSheet` |
| `DeliveryContext` | `deliveries`, `filteredDeliveries`, `filters`, `selectedDelivery`, `isSheetOpen` | `setFilters`, `createDelivery`, `updateDelivery`, `deleteDelivery`, `openSheet`, `closeSheet` |
| `ArrivageContext` | `arrivages`, `filteredArrivages`, `filters`, `packingList`, `inconsistencies` | `setFilters`, `upsertArrivageState`, `openPackingList`, `closePackingList` |
| `SettingsContext` | `statusOptions`, `locationOptions`, `typeOptions` | (lecture seule — métadonnées statiques) |
| `HistoryContext` | `activityLogs`, `categoryPriceHistory` | (lecture seule — alimenté par triggers) |

---

## `useOptimisticCrud` — hook générique

Tous les contexts métier utilisent ce hook pour les mutations Create / Update / Delete.

```ts
function useOptimisticCrud<T extends { id: string }, TCreate = T>(
    serverItems: T[] | undefined,
    api: CrudApi<T, TCreate>,
    onError?: (action: string) => void
): { items: T[]; create: ...; update: ...; remove: ... }
```

**Comportement :**

- `update` et `remove` appliquent le changement **immédiatement** dans le state local (optimistic), puis appellent Supabase.
- En cas d'erreur Supabase : rollback vers le state précédent + `api.refetch()`.
- Un `useRef` stabilise la snapshot "previous" sans créer de dépendances cycliques dans les `useCallback`.
- `create` ne fait pas d'optimisme : attend la réponse Supabase pour obtenir l'`id` généré.

---

## Génération DIN / BIN (`helper_stock.ts`)

### DIN (Delivery Identification Number)

Identifiant unique d'une livraison.

```
DIN = TYPE(4) - TAG_FOURNISSEUR(3) - LOC(3) - DATE(DDMMYYYY)
```

| Segment | Source | Exemple |
|---|---|---|
| `TYPE` | Déduit du `poids_moyen` via `getBalleTypeFromWeight()` | `BALL` |
| `TAG_FOURNISSEUR` | `fournisseur.tag` | `EUR` |
| `LOC` | 3 premières lettres de `fournisseur.siege_localisation` | `BAN` (Bangkok) |
| `DATE` | `delivery_date` formatée en DDMMYYYY | `15042025` |

**Règle de type par poids moyen :**

| Poids moyen (kg) | Type |
|---|---|
| 5 – 49 | `bags` |
| 50 – 300 | `balle` |
| > 300 | `push` |
| Autre | `other` |

### BIN (Balle Identification Number)

Identifiant unique d'une balle, dérivé du DIN.

```
BIN = DIN - INDEX(3 chiffres paddés) - TAG_CATEGORIE(4)
```

Exemple : `BALL-EUR-BAN-15042025-001-PULL`

```ts
generateBIN(din, "1", "PULL") // → "BALL-EUR-BAN-15042025-001-PULL"
```

---

## Détection d'incohérences arrivage (`type_shipment.ts`)

Le dashboard affiche une **file de travail** des containers problématiques. La fonction `detectInconsistencies(row)` retourne un tableau de codes :

| Code | Condition déclenchante |
|---|---|
| `missing_fournisseur` | `row.fournisseur_id` est vide |
| `missing_operational_status` | `status === "planifié"` ET aucun champ d'état saisi (docked_at, received_date, notes) |
| `inconsistent_dates` | `departure_date > port_arrival_date` OU `port_arrival_date > received_date` |
| `missing_container_no` | `transport_mode` renseigné mais `container_no` absent ou non-BIC |
| `invalid_bic` | `container_no` présent mais ne passe pas `BIC_RE` |

**Regex BIC (ISO 6346) :**

```ts
// stock_constants.ts
export const BIC_RE = /^[A-Z]{3,4}[0-9]{6,7}$/
```

**Utilitaires :**

```ts
// Retourne la date de référence pour tri/affichage (par priorité)
referenceDate(row)  // port_arrival_date ?? departure_date ?? docked_at ?? received_date

// Retourne les arrivages dont la date de référence est la plus proche (aujourd'hui ou future)
getNearestArrivages(rows)

// Nombre de jours entre aujourd'hui et une date ISO
diffDaysFromToday(isoDate)

// Retourne { row, issues }[] triés par nombre d'incohérences décroissant
rowsWithInconsistencies(rows)
```

---

## Types UI (`type_ui.ts`)

```ts
type StockTab = "stockDashboardTab" | "stockTab" | "stockFlowTab" | "historyTab" | "settingsTab"

type stockViewMode    = "balles" | "livraisons"   // onglet Stock
type stockDisplayStyle = "table" | "grid"

type flowViewMode     = "import" | "export"        // onglet Flow
type flowDisplayStyle = "table" | "calendar"

type SettingsNavItem  = "general" | "fournisseurs" | "categories"
```

---

## Constantes (`stock_constants.ts`)

| Constante | Valeur | Usage |
|---|---|---|
| `STOCK_PAGE_SIZE` | 10 | Pagination recherche balles dashboard |
| `BALLE_INITIAL_LIMIT` | 40 | Chargement initial du balleBoard |
| `BALLE_LOAD_MORE_INCREMENT` | 40 | "Charger plus" dans balleBoard |
| `DELIVERY_ITEMS_PER_PAGE` | 5 | Liste de balles dans deliverySheet |
| `SHIPMENT_DEFAULT_PAGE_SIZE` | 25 | Tableau arrivages |
| `SHIPMENT_PAGE_SIZES` | [10, 25, 50, 100] | Sélecteur de taille de page arrivages |
| `ACTIVITY_MAX_ITEMS` | 10 | Feed d'activité latéral (sidebar dashboard) |
| `ACTIVITY_LOG_LIMIT` | 200 | Fetch limit + slice real-time historique |
| `HISTORY_PAGE_SIZE` | 25 | Pagination journal d'activité |
| `CALENDAR_MAX_PER_DAY` | 2 | Max arrivages affichés par jour (vue calendrier) |
| `UUID_DISPLAY_LENGTH` | 8 | Nb de chars d'UUID tronqué affiché en UI |
| `BIC_RE` | `/^[A-Z]{3,4}[0-9]{6,7}$/` | Validation format container BIC ISO 6346 |

---

## Onglets — description fonctionnelle

### Dashboard (`dashboardTab.tsx`)

- **KPIs :** balles en stock, livraisons du mois, containers en transit
- **Recherche balles :** filtre temps réel sur BIN / catégorie / fournisseur, paginé (`STOCK_PAGE_SIZE`)
- **Section arrivages :** containers les plus proches, file d'incohérences opérateur
- **Activité récente :** feed des derniers `ActivityLog` (limité à `ACTIVITY_MAX_ITEMS`)

### Stock (`stockBoard.tsx`)

Bascule entre deux modes via `stockViewMode` :

**Mode `balles` :**
- Affichage cards (`balleBoard.tsx`) ou table selon `stockDisplayStyle`
- Chargement progressif : 40 premières balles + bouton "Charger plus" (+40)
- Filtres complets : statut, type, localisation, catégorie, fournisseur, dates
- Création via `balleCreationSheet.tsx` : champ packing en kg ou pièces, BIN auto-généré

**Mode `livraisons` :**
- Affichage cards (`deliveryBoard.tsx`)
- Filtres : fournisseur, type, dates, nb de balles (min/max)
- Création via `DeliveryCreationSheet.tsx` : DIN auto-généré, distribution de catégories
- Chaque livraison affiche la liste de ses balles (5 par page)

### Flow (`flowBoard.tsx`)

Bascule entre deux modes via `flowViewMode` :

**Mode `import` (arrivages) :**
- Vue table ou calendrier (`flowDisplayStyle`)
- Filtres : fournisseur, statut, dates, toggle "sans fournisseur"
- Toggle "afficher les valeurs brutes" pour voir les données Excel non normalisées
- Création/édition d'état opérationnel via `shipmentCreationSheet.tsx`
- Packing list détaillée via `packingListSheet.tsx`

**Mode `export` (départs) :**
- Même données, filtrées sur `kind === "depart"`

### Historique (`historyBoard.tsx`)

- **Journal d'activité :** toutes les actions create/update/delete sur balles, livraisons, catégories, fournisseurs (triggers Supabase)
- **Graphique prix :** évolution du `unit_price` par catégorie dans le temps (`priceChartPanel.tsx`)
- Pagination du journal : `HISTORY_PAGE_SIZE` (25 entrées par page)

### Salle de tri et commandes boutiques — features à part

Depuis le 2026-10-02, ces deux pages (`/salle-de-tri`, `/commandes`) sont des features autonomes : `src/features/salle-de-tri/` (doc `docs/salle-de-tri.md`) et `src/features/commandes/` (doc `docs/commandes.md`). Elles consomment l'API publique du stock (`@/features/stock` : `ReferentialProvider`, `useReferentialContext`, `GESTION_THEME`, `EntityTimeline`, erreurs CRUD) ; leurs entrées de journal (`fiche_tri`, `trieur`, `commande`…) restent lues par l'Historique du stock (`types/history.types.ts`, `utils/activityHelpers.tsx`).

### Paramètres (`settingsBoard.tsx`)

Navigation latérale avec 3 sections :

| Section | Contenu |
|---|---|
| `general` | Personnalisation couleurs de statut (WIP) |
| `fournisseurs` | CRUD fournisseurs : liste paginée, ajout sheet, édition inline |
| `categories` | CRUD catégories : liste paginée, ajout sheet, édition inline |

Pagination : `SETTINGS_PAGE_SIZE` (8 items par page).

---

## Composants UI réutilisables

### `PopoverSelect`

Sélecteur avec recherche intégrée. Deux variantes : `"input"` (champ texte) ou `"button"` (déclencheur bouton).

```tsx
<PopoverSelect
    options={fournisseurs.map(f => ({ value: f.id, label: f.name }))}
    value={selected}
    onChange={setSelected}
    placeholder="Choisir un fournisseur"
    variant="button"
/>
```

### `TabButton`

Bouton de navigation d'onglets stylisé, gère l'état actif.

### `InfoToolTips`

Tooltip d'information avec gestion du touch mobile (pression longue).

---

## Recettes

### Ajouter un filtre sur le BalleBoard

1. Ajouter le champ dans `BalleFiltersState` (`type_balle.ts`) + mettre à jour `DEFAULT_BALLE_FILTERS`
2. Ajouter le filtre dans le `useMemo` de `BalleContext` qui calcule `filteredBalles`
3. Ajouter le contrôle UI dans `BalleFiltersPanel.tsx`

### Ajouter un nouveau statut de balle

1. Ajouter la valeur dans `BalleStatus` (`type_balle.ts`)
2. Ajouter le label / la couleur dans `stock_theme.ts`
3. Mettre à jour `settingsContext.tsx` si les statuts y sont listés statiquement

### Ajouter un champ dans `ArrivageRow`

Le champ doit d'abord exister dans la view Supabase `v_arrivages`.

1. Ajouter le champ dans `ArrivageRow` (`type_shipment.ts`)
2. Le select Supabase dans `use_shipment.ts` utilise `*` : le champ remonte automatiquement
3. Ajouter l'affichage dans `shipmentTableView.tsx` ou `packingListSheet.tsx`

### Ajouter une nouvelle section dans Paramètres

1. Ajouter la valeur dans `SettingsNavItem` (`type_ui.ts`)
2. Créer le composant de menu dans `components/settings/menus/`
3. Ajouter le lien de navigation dans `settingsBoard.tsx`
4. Ajouter le `case` dans le switch de rendu du contenu

### Ajouter une nouvelle incohérence détectée

1. Ajouter le code dans `ArrivageInconsistency` (`type_shipment.ts`)
2. Ajouter le label dans `INCONSISTENCY_LABELS`
3. Ajouter la condition dans `detectInconsistencies()`
4. Ajouter un test dans `types/type_shipment.test.ts`

### Créer une nouvelle livraison depuis un arrivage

Le champ `container_no` de la livraison est disponible via `DeliveryFormInput.container_no`. Le composant `DeliveryCreationSheet` accepte un `container_no` pré-rempli pour lier livraison et arrivage. Le contexte `ArrivageContext` expose ensuite `livraison` dans le join de chaque `ArrivageRow`.

---

## Supabase — tables impliquées

| Table / Vue | Rôle | Édition front |
|---|---|---|
| `balles_gestion` | Balles | Oui (CRUD complet) |
| `deliveries_gestion` | Livraisons | Oui (CRUD complet) |
| `categories_gestion` | Catégories | Oui (CRUD complet) |
| `fournisseur_gestion` | Fournisseurs | Oui (CRUD complet) |
| `arrivage_state` | État opérationnel des containers | Oui (UPSERT sur `container_no`) |
| `v_arrivages` | Vue joinant factures + transport + état | Non — lecture seule |
| `items` | Lignes de facture | Non — import Excel uniquement |
| `packages` | Packages d'une ligne de facture | Non — import Excel uniquement |
| `activity_log` | Journal d'actions | Non — triggers Supabase uniquement |
| `category_price_history` | Historique prix catégories | Non — triggers Supabase uniquement |
| `trieurs`, `tri_sorties` | Référentiel de la salle de tri | Oui (page Salle de tri → Trieurs et types) |
| `fiches_tri`, `fiches_tri_lignes`, `v_fiches_tri` | Feuilles de tri | Écriture par la RPC `save_fiche_tri` ; suppression directe |
| `boutiques`, `pastilles_prix`, `articles` | Catalogue de la salle de commande | Oui (page Commandes boutiques → Catalogue) |
| `commandes_boutique`, `commande_lignes` | Commandes boutiques | Oui ; statut `en_cours` / `soldee` dérivé |
| `livraisons_boutique`, `palettes`, `cartons` | Livraisons partielles et leur contenu | Oui avant expédition ; statuts par RPC |
| `v_commandes_boutique`, `v_commande_avancement`, `v_livraisons_boutique`, `v_cartons` | Totaux, avancement, codes | Non — lecture seule |

---

## Checklist lors de l'ajout d'un nouveau domaine métier

- [ ] Interface `Entity`, `EntityFormInput`, `EntityFiltersState` dans `types/`
- [ ] `DEFAULT_ENTITY_FILTERS` exporté pour reset propre
- [ ] Hook bas niveau `use_entity.ts` (fetch Supabase, real-time si nécessaire)
- [ ] Context `entityContext.tsx` exposant données + mutations + filtres + état sheet
- [ ] Provider ajouté dans `stockProvider.tsx` au bon niveau (après ses dépendances)
- [ ] Re-export du hook dans `stockProvider.tsx`
- [ ] Constantes de pagination dans `stock_constants.ts`
- [ ] Thème (couleurs, labels) dans `stock_theme.ts` si l'entité a des statuts colorés
- [ ] Onglet ou sous-section dans `stockTabs.tsx` / `StockTab`
- [ ] Permissions Supabase vérifiées (RLS)
