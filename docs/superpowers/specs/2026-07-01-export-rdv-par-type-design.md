# Export RDV par type (achat / découverte / visio) — design

## Contexte

`ExportStatsButton.tsx` exporte déjà, par collaborateur, un total de RDV pris (`r.rdv`), sans distinction du type de RDV. Le besoin : un second export, indépendant, qui donne par commercial le nombre de RDV « affectés à lui » avec répartition par type (achat / découverte / visio) et pourcentage sur le total, plus la tendance vs période précédente.

## Décisions actées pendant le brainstorming

- **Notion de RDV « affecté »** : il n'existe pas de champ `assigned_to` distinct sur les events. Le champ `client_crm.closers` a été envisagé mais écarté : il est écrasé par un trigger `AFTER INSERT` à chaque nouveau RDV pris sur un client (`supabase/migrations/20260619120000_assign_closer_on_event.sql`), donc il ne reflète que le dernier commercial en date sur ce client — pas fiable pour un filtre par période passée. On utilise donc le même champ que l'export existant : `Event_calendar.customer` (le « setter », résolu via `getEventSetterId` dans `AnalyticsContext.tsx`).
- **Filtre effectif** : c'est `selectedPeriod` + `selectedFilter` (bucket de période courant), exactement comme dans `getStatsExportData()`.
- **Classification des types** : les 4 valeurs connues de `Event_calendar.nom` (via `normalizeEventType`, `KNOWN_EVENT_TYPES` dans `stats.ts`/`AnalyticsContext.tsx`) sont `"rdv physique achat"`, `"rdv visio achat"`, `"rdv physique decouverte"`, `"rdv decouverte visio"`. Répartition :
  - `achat` = types contenant `"achat"`
  - `decouverte` = types contenant `"decouverte"`
  - `visio` = types contenant `"visio"` (axe transversal, recoupe achat et découverte — pas une 3e partition)
  - `achat % + decouverte % = 100%` du total ; `visio %` est indépendant.
- **Structure de l'export** : même organisation visuelle que l'export existant — comptes centraux épinglés (`TARGET_IDS`), groupes/barres de séparation (`exportGroups`), ligne TOTAL, bascule en mode « jours » si `selectedCommercial` est fixé (comme `mode === "daily"` dans `ExportStatsButton.tsx`).
- **Fichier** : bouton et fichier Excel séparés de l'export actuel (pas un second onglet du même classeur).

## Composants à ajouter/modifier

### 1. `AnalyticsContext.tsx` — nouvelle fonction `getRdvTypeExportData()`

Même structure que `getStatsExportData()` (même parcours `eventsStats`/`filteredEvents`, même `matchKey` courant/précédent, même `getEventSetterId`), mais au lieu d'incrémenter un compteur `rdv` unique, classe chaque event avec `normalizeEventType(nom)` et incrémente `achat`/`decouverte`/`visio` selon les substrings ci-dessus, en plus du `total`.

Types :
```ts
interface RdvTypeRow {
    userId: string
    name: string
    total: number
    achat: number
    decouverte: number
    visio: number
}
interface RdvTypeExportData {
    period: string
    filter: string | null
    hasPrev: boolean
    mode: "collaborators" | "daily"
    perCollaborator: RdvTypeRow[]
    perCollaboratorPrev: RdvTypeRow[]
}
```

Exposée via le contexte `useAnalytics()` au même titre que `getStatsExportData`.

### 2. Nouveau fichier `src/features/crm/components/Analytics/ExportRdvTypeButton.tsx`

Second `<Button>` rendu dans `src/features/crm/components/Analytics/Header.tsx:197`, juste à côté de `<ExportStatsButton />` (même condition d'affichage `canSelectCommercial`). Réutilise :
- `TARGET_IDS` (import depuis `Widget/EventsPalier`) pour l'épinglage des comptes centraux.
- `exportGroups` / `exportFallbackNames` / `crmUsers` du contexte Analytics, comme `ExportStatsButton`.
- Les styles `HEADER_STYLE`, `TOTAL_STYLE`, `TREND`, `SEP_COLORS` (dupliqués localement ou extraits en constantes partagées si ça reste simple — à trancher à l'implémentation selon la taille du duplicat).

Colonnes du tableau Excel :

| Collaborateur | Nbr RDV | Δ | Achat | Achat % | Découverte | Découverte % | Visio | Visio % |
|---|---|---|---|---|---|---|---|---|

- Δ = tendance vs période précédente sur le total (flèche ▲/▼/= + %, même logique `trendOf`).
- Les colonnes `%` sont des **formules Excel** (`ROUND(count/total*100, 1)`) pour que la ligne TOTAL se recalcule correctement à partir des SUM.
- Ligne TOTAL = `SUM` des lignes affichées (comme l'export actuel), colonnes `%` recalculées par formule sur cette même ligne.
- Mode journalier (si `selectedCommercial` fixé) : une ligne par jour pour ce commercial, sans barres de séparation, comme le mode `daily` de l'export actuel.

### 3. Nom de fichier généré
`stats_crm_rdv_types_[commercial_]{filtre}_{date}.xlsx` (préfixe commercial uniquement en mode journalier, comme l'export actuel).

## Hors périmètre
- Pas de second onglet dans le fichier existant.
- Pas de nouvelle notion d'affectation en base (pas de migration).
- Pas de changement de comportement de l'export actuel.
