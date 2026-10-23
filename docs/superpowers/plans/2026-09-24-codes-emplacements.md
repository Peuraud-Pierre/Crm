# Codes QR des emplacements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'onglet « Flux » du stock handpick par un onglet « Codes » pour imprimer une étiquette QR par emplacement et la lire au téléphone pour voir son contenu.

**Architecture:** Aucune donnée nouvelle : le QR encode l'URL `<origin>/stock-handpick/codes/<emplacement-id>`. Des fonctions pures (`utils/emplacementCode.ts`, `utils/emplacementGroups.ts`, `utils/codeLabelSheet.ts`) portent toute la logique testable ; les composants `components/codes/*` les assemblent avec les données déjà chargées par `usePlanHandpick`. L'onglet Plan accepte un `detail` `emp-<id>` pour faire briller un emplacement.

**Tech Stack:** React 19 + TypeScript, react-router, Tailwind (tokens `@theme`), rstest + Testing Library, `qrcode` (génération), `html5-qrcode` (lecture) — déjà installés.

**Spec:** `docs/superpowers/specs/2026-09-24-codes-emplacements-design.md`

## Global Constraints

- Feature : `src/features/stock_handpick` uniquement ; alias `@/*` → `src/*`.
- Aucune migration, aucune table, aucune nouvelle dépendance npm.
- Aucun `supabase.from(...)` hors `services/` (CLAUDE.md) — ce plan n'en ajoute aucun.
- Pas de valeurs Tailwind arbitraires (`w-[123px]`…) ; tokens de thème uniquement.
- Fichiers < 400 lignes (Architecture_Feature.pdf §15).
- Onglet `codesTab`, segment d'URL `codes`, permission `P.planView`, **à la place de `fluxTab`** (même position, entre Plan et Historique). Flux est seulement retiré de la navigation : ses fichiers (`components/flux/*`, services, types, tests), ses tables et sa permission restent en place. `/stock-handpick/flux…` retombe alors sur l'onglet par défaut via le garde de `TabbedModuleRoute`.
- URL du QR : `<origin>/stock-handpick/codes/<emplacement-id>` ; préfixe plan : `emp-`.
- Séparateur de chemin affiché : `EMPLACEMENT_PATH_SEPARATOR` (`" · "`, `constants.ts`).
- Commandes : tests `npx rstest run <chemin>`, types `npx tsc --noEmit -p .`, lint `npx eslint <chemin>` — toutes lancées depuis la racine du dépôt. Gates ratchet : ne pas augmenter le nombre d'erreurs existantes.
- Texte d'interface en français.
- Commits : `git add` des seuls fichiers de la tâche (l'arbre de travail contient d'autres changements non commités de l'utilisateur, dont `components/plan/PlanDetailPanel.tsx` — modifié par le passage R2/R3 en palettes). Chaque message de commit se termine par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Écart assumé avec la spec :** l'impression passe par une fenêtre dédiée (`window.open` + `print()`) au lieu de variantes `print:` sur la page : l'app-shell (sidebar, onglets) n'est pas masquable proprement depuis un onglet. La spec est mise à jour à la tâche 7. La saisie manuelle accepte aussi un chemin tapé (`B R2 E3 H1`), plus utile qu'un uuid.

## Review Focus

1. QR imprimé depuis un autre environnement (préprod, localhost) puis scanné en prod : l'id doit être extrait quel que soit l'origin → test dans la tâche 1.
2. URL lue avec slash final, query string ou fragment (`…/codes/<id>/?x=1`) : l'id doit être extrait → test dans la tâche 1.
3. Le lecteur caméra rappelle le callback ~10×/s sur le même code : une seule navigation, pas de rafale de toasts → garde `handledRef` + `lastRejectedRef` dans la tâche 5.
4. Libellés contenant `<`, `&`, `"` injectés dans la fenêtre d'impression : ils doivent être échappés → test dans la tâche 4.
5. Emplacement désactivé (R4/E5, R2/E1/H1) : jamais proposé à l'impression, mais affiché « Emplacement retiré » s'il est scanné → tests dans les tâches 2 et 3.

---

## File Structure

| Fichier | Rôle |
|---|---|
| Create `src/features/stock_handpick/utils/emplacementCode.ts` | URL ↔ id, préfixe plan `emp-`, recherche par chemin tapé |
| Create `src/features/stock_handpick/utils/emplacementCode.test.ts` | tests |
| Create `src/features/stock_handpick/utils/emplacementGroups.ts` | emplacements actifs groupés par rack pour la sélection |
| Create `src/features/stock_handpick/utils/emplacementGroups.test.ts` | tests |
| Create `src/features/stock_handpick/utils/codeLabelSheet.ts` | HTML de la planche d'impression (pur) + ouverture de la fenêtre |
| Create `src/features/stock_handpick/utils/codeLabelSheet.test.ts` | tests |
| Create `src/features/stock_handpick/components/plan/BalleChip.tsx` | puce balle, extraite de `PlanDetailPanel` pour être partagée |
| Modify `src/features/stock_handpick/components/plan/PlanDetailPanel.tsx` | importe `BalleChip` |
| Create `src/features/stock_handpick/components/codes/EmplacementScanResult.tsx` | panneau de résultat d'un scan |
| Create `src/features/stock_handpick/components/codes/EmplacementScanResult.test.tsx` | tests |
| Create `src/features/stock_handpick/hooks/ui/useQrDataUrls.ts` | data URLs QR, générées une fois par texte |
| Create `src/features/stock_handpick/components/codes/CodeSelectionList.tsx` | liste groupée à cocher |
| Create `src/features/stock_handpick/components/codes/CodeLabelSheet.tsx` | aperçu des étiquettes + bouton imprimer |
| Create `src/features/stock_handpick/components/codes/CodeScanner.tsx` | dialog caméra + saisie manuelle |
| Create `src/features/stock_handpick/components/codes/CodesTab.tsx` | onglet : assemble le tout |
| Modify `src/features/stock_handpick/types/ui.types.ts` | `codesTab` remplace `fluxTab` dans `HandpickTab` et `STOCK_HANDPICK_TABS` |
| Modify `src/features/stock_handpick/components/Tabs.tsx` | `TAB_META.codesTab` remplace `TAB_META.fluxTab` |
| Modify `src/app/routes/router.tsx` | commentaire d'URL : `flux/new` → `codes/<id>` |
| Modify `src/features/stock_handpick/hooks/ui/usePlanBalleFocus.ts` | cible emplacement pour `emp-<id>` |
| Modify `src/features/stock_handpick/components/plan/PlanTab.tsx` | commentaire d'en-tête (adresse `plan/emp-<id>`) |

---

### Task 1: Codage URL ↔ emplacement

**Files:**
- Create: `src/features/stock_handpick/utils/emplacementCode.ts`
- Test: `src/features/stock_handpick/utils/emplacementCode.test.ts`

**Interfaces:**
- Consumes: `HANDPICK_ROUTE_BASE` (`"/stock-handpick"`, `types/ui.types.ts`).
- Produces:
  - `emplacementCodeUrl(origin: string, id: string): string`
  - `parseEmplacementCode(text: string): string | null`
  - `PLAN_EMPLACEMENT_PREFIX: "emp-"`
  - `planDetailOfEmplacement(id: string): string`
  - `emplacementOfPlanDetail(detail: string | undefined): string | null`
  - `findEmplacementByPath(text: string, paths: ReadonlyMap<string, readonly string[]>): string | null` — `paths` : id → segments.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "@rstest/core"
import {
    emplacementCodeUrl,
    emplacementOfPlanDetail,
    findEmplacementByPath,
    parseEmplacementCode,
    planDetailOfEmplacement,
} from "./emplacementCode"

/**
 * Étiquettes QR : le code porte l'URL de l'emplacement dans l'app, pour que
 * l'appareil photo natif l'ouvre directement ; le lecteur intégré en extrait
 * l'id.
 */

const ID = "3f2b8c1e-9a4d-4e21-b7c5-0d6e8f9a1b2c"

test("l'URL d'un code pointe vers l'onglet Codes", () => {
    expect(emplacementCodeUrl("https://app.example.fr", ID)).toBe(
        `https://app.example.fr/stock-handpick/codes/${ID}`,
    )
    // Slash final de l'origin toléré.
    expect(emplacementCodeUrl("https://app.example.fr/", ID)).toBe(
        `https://app.example.fr/stock-handpick/codes/${ID}`,
    )
})

test("l'id est retrouvé quel que soit l'environnement qui a imprimé le code", () => {
    expect(parseEmplacementCode(`https://app.example.fr/stock-handpick/codes/${ID}`)).toBe(ID)
    expect(parseEmplacementCode(`http://localhost:3000/stock-handpick/codes/${ID}`)).toBe(ID)
    expect(parseEmplacementCode(`https://preprod.example.fr/stock-handpick/codes/${ID.toUpperCase()}`)).toBe(ID)
})

test("slash final, query string et fragment ne gênent pas", () => {
    expect(parseEmplacementCode(`https://a.fr/stock-handpick/codes/${ID}/`)).toBe(ID)
    expect(parseEmplacementCode(`https://a.fr/stock-handpick/codes/${ID}?src=qr#top`)).toBe(ID)
    expect(parseEmplacementCode(`  https://a.fr/stock-handpick/codes/${ID}\n`)).toBe(ID)
})

test("un uuid nu est accepté (saisie manuelle)", () => {
    expect(parseEmplacementCode(ID)).toBe(ID)
})

test("tout autre texte est refusé", () => {
    expect(parseEmplacementCode("")).toBeNull()
    expect(parseEmplacementCode("bonjour")).toBeNull()
    expect(parseEmplacementCode("https://a.fr/stock-handpick/inventaire/" + ID)).toBeNull()
    expect(parseEmplacementCode("https://a.fr/stock-handpick/codes/pas-un-uuid")).toBeNull()
    expect(parseEmplacementCode("3760123456789")).toBeNull()
})

test("le détail du plan distingue un emplacement d'une balle", () => {
    expect(planDetailOfEmplacement(ID)).toBe(`emp-${ID}`)
    expect(emplacementOfPlanDetail(`emp-${ID}`)).toBe(ID)
    expect(emplacementOfPlanDetail(ID)).toBeNull()
    expect(emplacementOfPlanDetail(undefined)).toBeNull()
    expect(emplacementOfPlanDetail("emp-")).toBeNull()
})

test("un chemin tapé retrouve son emplacement, séparateurs et casse libres", () => {
    const paths = new Map<string, readonly string[]>([
        ["h1", ["B", "R2", "E3", "H1"]],
        ["sol", ["A", "SOL"]],
    ])
    expect(findEmplacementByPath("B · R2 · E3 · H1", paths)).toBe("h1")
    expect(findEmplacementByPath("b r2 e3 h1", paths)).toBe("h1")
    expect(findEmplacementByPath("B/R2/E3/H1", paths)).toBe("h1")
    expect(findEmplacementByPath("a-sol", paths)).toBe("sol")
    expect(findEmplacementByPath("B R2 E3", paths)).toBeNull()
    expect(findEmplacementByPath("", paths)).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx rstest run src/features/stock_handpick/utils/emplacementCode.test.ts`
Expected: FAIL — module `./emplacementCode` introuvable.

- [ ] **Step 3: Write minimal implementation**

```ts
import { HANDPICK_ROUTE_BASE } from "@/features/stock_handpick/types/ui.types"

/**
 * Étiquettes QR des emplacements.
 *
 * Le QR porte l'URL de l'emplacement dans l'app
 * (`<origin>/stock-handpick/codes/<id>`) : l'appareil photo natif du
 * téléphone l'ouvre directement, et le lecteur intégré en extrait l'id.
 * L'id, et non le chemin, parce qu'il survit à un renommage.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const CODE_PATH = `${HANDPICK_ROUTE_BASE}/codes/`
// Origin libre : un code imprimé depuis la préprod reste lisible en prod.
const URL_RE = new RegExp(`${CODE_PATH}(${UUID})/?(?:[?#].*)?$`, "i")
const BARE_RE = new RegExp(`^${UUID}$`, "i")

export function emplacementCodeUrl(origin: string, id: string): string {
    return `${origin.replace(/\/+$/, "")}${CODE_PATH}${id}`
}

/** Id d'emplacement lu dans un QR (URL de code) ou tapé (uuid nu), sinon `null`. */
export function parseEmplacementCode(text: string): string | null {
    const value = text.trim()
    if (BARE_RE.test(value)) return value.toLowerCase()
    const match = URL_RE.exec(value)
    return match ? match[1].toLowerCase() : null
}

/**
 * `detail` de l'onglet Plan : un id seul désigne une balle (« Voir dans le
 * plan 3D » de sa fiche), `emp-<id>` un emplacement.
 */
export const PLAN_EMPLACEMENT_PREFIX = "emp-"

export const planDetailOfEmplacement = (id: string) => `${PLAN_EMPLACEMENT_PREFIX}${id}`

export function emplacementOfPlanDetail(detail: string | undefined): string | null {
    if (!detail?.startsWith(PLAN_EMPLACEMENT_PREFIX)) return null
    return detail.slice(PLAN_EMPLACEMENT_PREFIX.length) || null
}

const tokens = (text: string) => text.toUpperCase().split(/[^0-9A-Z]+/).filter(Boolean)

/**
 * Saisie manuelle d'un chemin (`B R2 E3 H1`, `b/r2/e3/h1`, `A · SOL`) :
 * l'emplacement dont les segments correspondent exactement, sinon `null`.
 */
export function findEmplacementByPath(
    text: string,
    paths: ReadonlyMap<string, readonly string[]>,
): string | null {
    const wanted = tokens(text).join("/")
    if (!wanted) return null
    for (const [id, segments] of paths) {
        if (segments.map((s) => s.toUpperCase()).join("/") === wanted) return id
    }
    return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx rstest run src/features/stock_handpick/utils/emplacementCode.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/stock_handpick/utils/emplacementCode.ts src/features/stock_handpick/utils/emplacementCode.test.ts
git commit -m "feat(stock_handpick): codage URL des étiquettes d'emplacement"
```

---

### Task 2: Emplacements groupés pour la sélection

**Files:**
- Create: `src/features/stock_handpick/utils/emplacementGroups.ts`
- Test: `src/features/stock_handpick/utils/emplacementGroups.test.ts`

**Interfaces:**
- Consumes: `buildEmplacementPaths(zones, emplacements): Map<string, EmplacementPath>` (`utils/planHelpers.ts`, `EmplacementPath = { emplacement_id, segments: string[], full_code: string }`), `EMPLACEMENT_PATH_SEPARATOR` (`constants.ts`), `PLAN_ZONES` (`utils/planLayout.ts`).
- Produces:
  - `interface CodeItem { id: string; path: string; segments: string[]; zoneLabel: string }`
  - `interface CodeGroup { key: string; label: string; items: CodeItem[] }`
  - `groupEmplacementsForCodes(zones: ZoneNode[], emplacements: Emplacement[]): CodeGroup[]`

Règle de groupe : un groupe par rack — les segments sauf les deux derniers (`B/R2/E3/H1` → `B · R2`) ; un emplacement à deux segments (`A/SOL`) forme le groupe de sa zone (`A`). Inactifs exclus. Tri numérique des groupes et des items.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "@rstest/core"
import type { Emplacement, ZoneNode } from "@/features/stock_handpick/types/location.types"
import { groupEmplacementsForCodes } from "./emplacementGroups"

/** Liste de sélection de l'onglet Codes : un groupe par rack, actifs seulement. */

const base = {
    label: null, pos_x: null, pos_y: null, width: null, height: null,
    is_active: true, created_at: "", updated_at: "", created_by: null,
}
const zone = (id: string, code: string, parent_id: string | null): ZoneNode => ({
    ...base, id, code, parent_id, kind: parent_id ? "etagere" : "zone",
    rotation: 0, color: null, sort_order: 0,
})
const emp = (id: string, zone_id: string, code: string, is_active = true): Emplacement => ({
    ...base, id, zone_id, code, is_active, capacity: null, notes: null,
})

const zones = [
    zone("b", "B", null), zone("a", "A", null),
    zone("r10", "R10", "b"), zone("r2", "R2", "b"),
    zone("r2e3", "E3", "r2"), zone("r2e1", "E1", "r2"), zone("r10e1", "E1", "r10"),
]
const emplacements = [
    emp("sol", "a", "SOL"),
    emp("r2e3h1", "r2e3", "H1"), emp("r2e3h0", "r2e3", "H0"),
    emp("r2e1h0", "r2e1", "H0"), emp("r2e1h1", "r2e1", "H1", false),
    emp("r10e1h0", "r10e1", "H0"),
]

test("un groupe par rack, tri numérique, zones sans rack à part", () => {
    const groups = groupEmplacementsForCodes(zones, emplacements)
    expect(groups.map((g) => g.label)).toEqual(["A", "B · R2", "B · R10"])
    expect(groups[1].items.map((i) => i.path)).toEqual([
        "B · R2 · E1 · H0", "B · R2 · E3 · H0", "B · R2 · E3 · H1",
    ])
})

test("les emplacements désactivés ne sont pas proposés", () => {
    const ids = groupEmplacementsForCodes(zones, emplacements).flatMap((g) => g.items.map((i) => i.id))
    expect(ids).not.toContain("r2e1h1")
})

test("chaque item porte le libellé de sa zone", () => {
    const [a, r2] = groupEmplacementsForCodes(zones, emplacements)
    expect(a.items[0]).toEqual({ id: "sol", path: "A · SOL", segments: ["A", "SOL"], zoneLabel: "Annexe" })
    expect(r2.items[0].zoneLabel).toBe("Bags")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx rstest run src/features/stock_handpick/utils/emplacementGroups.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write minimal implementation**

```ts
import { EMPLACEMENT_PATH_SEPARATOR } from "@/features/stock_handpick/constants"
import type { Emplacement, ZoneNode } from "@/features/stock_handpick/types/location.types"
import { buildEmplacementPaths } from "./planHelpers"
import { PLAN_ZONES, type PlanZoneCode } from "./planLayout"

/**
 * Emplacements proposés à l'impression d'étiquettes, groupés par rack
 * (`B · R2`) pour pouvoir cocher un rack entier. Un emplacement désactivé
 * (travée retirée, hauteur d'une palette au sol) n'est jamais proposé.
 */

export interface CodeItem {
    id: string
    /** Chemin affiché : « B · R2 · E3 · H1 ». */
    path: string
    segments: string[]
    /** Nom de la zone racine : « Bags », « Annexe »… */
    zoneLabel: string
}

export interface CodeGroup {
    key: string
    label: string
    items: CodeItem[]
}

const byNumericLabel = (a: string, b: string) => a.localeCompare(b, "fr", { numeric: true })

export function groupEmplacementsForCodes(zones: ZoneNode[], emplacements: Emplacement[]): CodeGroup[] {
    const paths = buildEmplacementPaths(zones, emplacements)
    const groups = new Map<string, CodeGroup>()

    for (const emplacement of emplacements) {
        if (!emplacement.is_active) continue
        const path = paths.get(emplacement.id)
        if (!path) continue
        const { segments } = path
        // Les deux derniers segments sont la travée et la hauteur ; une zone
        // sans rack (A · SOL) n'a que sa racine.
        const groupSegments = segments.length > 2 ? segments.slice(0, -2) : segments.slice(0, 1)
        const key = groupSegments.join("/").toUpperCase()
        const group = groups.get(key) ?? {
            key,
            label: groupSegments.join(EMPLACEMENT_PATH_SEPARATOR),
            items: [],
        }
        const root = segments[0]?.toUpperCase() as PlanZoneCode
        group.items.push({
            id: emplacement.id,
            path: path.full_code,
            segments,
            zoneLabel: PLAN_ZONES[root]?.label ?? segments[0] ?? "",
        })
        groups.set(key, group)
    }

    const sorted = [...groups.values()].sort((a, b) => byNumericLabel(a.label, b.label))
    for (const group of sorted) group.items.sort((a, b) => byNumericLabel(a.path, b.path))
    return sorted
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx rstest run src/features/stock_handpick/utils/emplacementGroups.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/stock_handpick/utils/emplacementGroups.ts src/features/stock_handpick/utils/emplacementGroups.test.ts
git commit -m "feat(stock_handpick): emplacements groupés par rack pour les étiquettes"
```

---

### Task 3: Panneau de résultat d'un scan

**Files:**
- Create: `src/features/stock_handpick/components/plan/BalleChip.tsx`
- Modify: `src/features/stock_handpick/components/plan/PlanDetailPanel.tsx` (supprimer la fonction locale `BalleChip` en bas de fichier et `numberFormatter`, `QUANTITY_UNIT_LABELS` s'ils ne servent plus ; importer `BalleChip`)
- Create: `src/features/stock_handpick/components/codes/EmplacementScanResult.tsx`
- Test: `src/features/stock_handpick/components/codes/EmplacementScanResult.test.tsx`

**Interfaces:**
- Consumes: `BalleHandpick` (`types/balle.types.ts`), `Emplacement` (`types/location.types.ts`).
- Produces:
  - `BalleChip({ balle, onOpen }: { balle: BalleHandpick; onOpen: (id: string) => void })` (export nommé)
  - `EmplacementScanResult(props: EmplacementScanResultProps)` avec
    ```ts
    interface EmplacementScanResultProps {
        /** Emplacement résolu, ou `undefined` si l'id ne correspond à rien. */
        emplacement: Emplacement | undefined
        path: string | null
        balles: BalleHandpick[]
        onClose: () => void
        onOpenBalle: (id: string) => void
        onShowInPlan: (id: string) => void
    }
    ```

- [ ] **Step 1: Extract `BalleChip`**

Create `components/plan/BalleChip.tsx` with the exact body currently at the bottom of `PlanDetailPanel.tsx` (the `BalleChip` function and the `numberFormatter` it uses), exported:

```tsx
import { cn } from "@/shared/lib/utils"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import { QUANTITY_UNIT_LABELS, UUID_DISPLAY_LENGTH } from "@/features/stock_handpick/constants"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })

/** Puce d'une balle rangée : cliquer ouvre sa fiche. Partagée par le plan et l'onglet Codes. */
export function BalleChip({ balle, onOpen }: { balle: BalleHandpick; onOpen: (id: string) => void }) {
    const unit =
        balle.packing_mode === "pieces" ? QUANTITY_UNIT_LABELS.pieces : QUANTITY_UNIT_LABELS.kg
    return (
        <button
            type="button"
            onClick={() => onOpen(balle.id)}
            className="flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-left text-xs transition-colors duration-base hover:border-primary hover:bg-primary/5"
        >
            <span className={cn("shrink-0", HANDPICK_THEME.card.identity)}>
                {balle.id.slice(0, UUID_DISPLAY_LENGTH)}
            </span>
            <span className="truncate font-medium text-foreground">
                {balle.raw_name ?? balle.category?.name ?? "Sans libellé"}
            </span>
            {balle.packing !== null && (
                <span className="shrink-0 tabular-nums text-muted-foreground">
                    {numberFormatter.format(balle.packing)} {unit}
                </span>
            )}
        </button>
    )
}
```

In `PlanDetailPanel.tsx`: delete the local `BalleChip` function and `numberFormatter`, add `import { BalleChip } from "./BalleChip"`, and drop `QUANTITY_UNIT_LABELS` from the constants import if unused.

- [ ] **Step 2: Run the existing plan tests (refactor safety)**

Run: `npx rstest run src/features/stock_handpick/components/plan`
Expected: PASS (unchanged count).

- [ ] **Step 3: Write the failing test**

```tsx
import { expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import type { Emplacement } from "@/features/stock_handpick/types/location.types"
import { EmplacementScanResult } from "./EmplacementScanResult"

/** Ce qu'affiche l'onglet Codes après le scan d'une étiquette. */

const emplacement = (is_active = true): Emplacement => ({
    id: "e1", zone_id: "z", code: "H1", label: null, capacity: null, notes: null, is_active,
    pos_x: null, pos_y: null, width: null, height: null, created_at: "", updated_at: "", created_by: null,
})
const balle = (id: string) =>
    ({ id, emplacement_id: "e1", raw_name: `Balle ${id}`, packing: 10, packing_mode: "kilos" }) as BalleHandpick

const handlers = () => ({ onClose: rstest.fn(), onOpenBalle: rstest.fn(), onShowInPlan: rstest.fn() })

test("affiche le chemin et les balles, chaque balle ouvre sa fiche", () => {
    const h = handlers()
    render(<EmplacementScanResult emplacement={emplacement()} path="B · R2 · E3 · H1" balles={[balle("aaaaaaaa-1")]} {...h} />)

    expect(screen.getByRole("heading", { name: "B · R2 · E3 · H1" })).toBeInTheDocument()
    screen.getByRole("button", { name: /Balle aaaaaaaa-1/ }).click()
    expect(h.onOpenBalle).toHaveBeenCalledWith("aaaaaaaa-1")
})

test("un emplacement vide le dit, et « Voir dans le plan » transmet son id", () => {
    const h = handlers()
    render(<EmplacementScanResult emplacement={emplacement()} path="A · SOL" balles={[]} {...h} />)

    expect(screen.getByText("Aucune balle à cet emplacement.")).toBeInTheDocument()
    screen.getByRole("button", { name: "Voir dans le plan" }).click()
    expect(h.onShowInPlan).toHaveBeenCalledWith("e1")
})

test("un emplacement désactivé est signalé comme retiré", () => {
    render(<EmplacementScanResult emplacement={emplacement(false)} path="B · R4 · E5 · H0" balles={[]} {...handlers()} />)

    expect(screen.getByText("Emplacement retiré")).toBeInTheDocument()
})

test("un id inconnu affiche « Code non reconnu », sans bouton plan", () => {
    render(<EmplacementScanResult emplacement={undefined} path={null} balles={[]} {...handlers()} />)

    expect(screen.getByRole("heading", { name: "Code non reconnu" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Voir dans le plan" })).toBeNull()
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx rstest run src/features/stock_handpick/components/codes/EmplacementScanResult.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 5: Write minimal implementation**

```tsx
import { MapPin, ScanLine, X } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import type { Emplacement } from "@/features/stock_handpick/types/location.types"
import { BalleChip } from "@/features/stock_handpick/components/plan/BalleChip"

interface EmplacementScanResultProps {
    /** Emplacement résolu, ou `undefined` si l'id ne correspond à rien. */
    emplacement: Emplacement | undefined
    path: string | null
    balles: BalleHandpick[]
    onClose: () => void
    onOpenBalle: (id: string) => void
    onShowInPlan: (id: string) => void
}

/** Résultat du scan d'une étiquette : l'emplacement et ce qu'il contient. */
export function EmplacementScanResult({
    emplacement,
    path,
    balles,
    onClose,
    onOpenBalle,
    onShowInPlan,
}: EmplacementScanResultProps) {
    const title = emplacement ? path ?? emplacement.code : "Code non reconnu"

    return (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm animate-in fade-in-0 slide-in-from-bottom-1 duration-base">
            <div className="flex items-center gap-2">
                <ScanLine size={16} className="text-muted-foreground" aria-hidden />
                <h3 className="font-mono text-base font-bold text-foreground">{title}</h3>
                {emplacement && !emplacement.is_active && <Badge variant="secondary">Emplacement retiré</Badge>}
                <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={onClose} aria-label="Fermer le résultat">
                    <X size={14} />
                </Button>
            </div>

            {!emplacement ? (
                <p className={cn("text-xs", HANDPICK_THEME.card.emptyValue)}>
                    Cette étiquette ne correspond à aucun emplacement du stock handpick.
                </p>
            ) : (
                <>
                    {balles.length === 0 ? (
                        <p className={cn("text-xs", HANDPICK_THEME.card.emptyValue)}>Aucune balle à cet emplacement.</p>
                    ) : (
                        <div className="flex flex-wrap gap-1.5">
                            {balles.map((balle) => (
                                <BalleChip key={balle.id} balle={balle} onOpen={onOpenBalle} />
                            ))}
                        </div>
                    )}
                    <Button variant="outline" size="sm" onClick={() => onShowInPlan(emplacement.id)}>
                        <MapPin size={14} aria-hidden />
                        Voir dans le plan
                    </Button>
                </>
            )}
        </section>
    )
}
```

Check `Badge` exposes a `secondary` variant (`src/shared/ui/atoms/badge.tsx`); if not, use `outline`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx rstest run src/features/stock_handpick/components/codes src/features/stock_handpick/components/plan`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/stock_handpick/components/plan/BalleChip.tsx src/features/stock_handpick/components/plan/PlanDetailPanel.tsx src/features/stock_handpick/components/codes/EmplacementScanResult.tsx src/features/stock_handpick/components/codes/EmplacementScanResult.test.tsx
git commit -m "feat(stock_handpick): panneau de résultat du scan d'un emplacement"
```

---

### Task 4: Génération et impression des étiquettes

**Files:**
- Create: `src/features/stock_handpick/utils/codeLabelSheet.ts`
- Test: `src/features/stock_handpick/utils/codeLabelSheet.test.ts`
- Create: `src/features/stock_handpick/hooks/ui/useQrDataUrls.ts`
- Create: `src/features/stock_handpick/components/codes/CodeSelectionList.tsx`
- Create: `src/features/stock_handpick/components/codes/CodeLabelSheet.tsx`

**Interfaces:**
- Consumes: `CodeGroup`, `CodeItem` (tâche 2), `emplacementCodeUrl` (tâche 1).
- Produces:
  - `interface PrintLabel { path: string; zoneLabel: string; qr: string | null }` (`qr` = data URL)
  - `buildLabelSheetHtml(labels: PrintLabel[]): string`
  - `printLabelSheet(labels: PrintLabel[]): boolean` — `false` si la fenêtre est bloquée
  - `useQrDataUrls(texts: readonly string[]): Map<string, string | null>` — `null` = génération échouée ; clé absente = en cours
  - `CodeSelectionList({ groups, selected, onChange }: { groups: CodeGroup[]; selected: ReadonlySet<string>; onChange: (next: Set<string>) => void })`
  - `CodeLabelSheet({ items }: { items: CodeItem[] })`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "@rstest/core"
import { buildLabelSheetHtml } from "./codeLabelSheet"

/** Planche d'étiquettes ouverte dans une fenêtre d'impression dédiée. */

test("une étiquette par emplacement, avec son QR et son chemin", () => {
    const html = buildLabelSheetHtml([
        { path: "B · R2 · E3 · H1", zoneLabel: "Bags", qr: "data:image/png;base64,AAA" },
        { path: "A · SOL", zoneLabel: "Annexe", qr: "data:image/png;base64,BBB" },
    ])
    expect(html.match(/class="label"/g)).toHaveLength(2)
    expect(html).toContain('src="data:image/png;base64,AAA"')
    expect(html).toContain("B · R2 · E3 · H1")
    expect(html).toContain("Annexe")
    expect(html).toContain("window.print()")
})

test("un QR manquant laisse le chemin seul", () => {
    const html = buildLabelSheetHtml([{ path: "A · SOL", zoneLabel: "Annexe", qr: null }])
    expect(html).not.toContain("<img")
    expect(html).toContain("A · SOL")
})

test("les libellés sont échappés", () => {
    const html = buildLabelSheetHtml([{ path: '<b>&"x"', zoneLabel: "<script>", qr: null }])
    expect(html).toContain("&lt;b&gt;&amp;&quot;x&quot;")
    expect(html).not.toContain("<script>alert")
    expect(html).toContain("&lt;script&gt;")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx rstest run src/features/stock_handpick/utils/codeLabelSheet.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write `utils/codeLabelSheet.ts`**

```ts
/**
 * Impression des étiquettes : une fenêtre dédiée, parce que l'app-shell
 * (sidebar, onglets) n'est pas masquable proprement depuis un onglet. La
 * planche est du HTML autonome ; ses dimensions sont en millimètres, unité
 * d'impression — hors Tailwind, qui ne s'applique pas dans cette fenêtre.
 */

export interface PrintLabel {
    path: string
    zoneLabel: string
    /** Data URL du QR, ou `null` si sa génération a échoué. */
    qr: string | null
}

const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const STYLE = `
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; color: #111; }
  .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
  .label { border: 0.3mm dashed #999; border-radius: 2mm; padding: 3mm; text-align: center; break-inside: avoid; }
  .label img { width: 40mm; height: 40mm; }
  .path { font: 700 5mm ui-monospace, monospace; margin-top: 1mm; }
  .zone { font-size: 3mm; color: #555; }
`

export function buildLabelSheetHtml(labels: PrintLabel[]): string {
    const items = labels
        .map((label) => {
            const img = label.qr ? `<img src="${escapeHtml(label.qr)}" alt="" />` : ""
            return `<div class="label">${img}<div class="path">${escapeHtml(label.path)}</div><div class="zone">${escapeHtml(label.zoneLabel)}</div></div>`
        })
        .join("")
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Étiquettes emplacements</title><style>${STYLE}</style></head><body><div class="sheet">${items}</div><script>window.onload = () => { window.print() }</script></body></html>`
}

/** Ouvre la planche et lance l'impression. `false` si le navigateur a bloqué la fenêtre. */
export function printLabelSheet(labels: PrintLabel[]): boolean {
    const win = window.open("", "_blank")
    if (!win) return false
    win.document.write(buildLabelSheetHtml(labels))
    win.document.close()
    return true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx rstest run src/features/stock_handpick/utils/codeLabelSheet.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `hooks/ui/useQrDataUrls.ts`**

```ts
import { useEffect, useState } from "react"
import QRCode from "qrcode"

/**
 * Data URLs QR des textes donnés, générées une seule fois par texte et
 * gardées tant que l'onglet vit. Clé absente : en cours ; `null` : échec.
 */
export function useQrDataUrls(texts: readonly string[]): Map<string, string | null> {
    const [urls, setUrls] = useState<Map<string, string | null>>(() => new Map())

    useEffect(() => {
        const missing = texts.filter((text) => !urls.has(text))
        if (missing.length === 0) return
        let cancelled = false
        void Promise.all(
            missing.map((text) =>
                QRCode.toDataURL(text, { margin: 1, width: 320, errorCorrectionLevel: "M" })
                    .then((url): [string, string | null] => [text, url])
                    .catch((error: unknown): [string, string | null] => {
                        console.error(error)
                        return [text, null]
                    }),
            ),
        ).then((entries) => {
            if (cancelled) return
            setUrls((prev) => new Map([...prev, ...entries]))
        })
        return () => {
            cancelled = true
        }
    }, [texts, urls])

    return urls
}
```

- [ ] **Step 6: Write `components/codes/CodeSelectionList.tsx`**

```tsx
import { Checkbox } from "@/shared/ui/atoms/checkbox"
import type { CodeGroup } from "@/features/stock_handpick/utils/emplacementGroups"

interface CodeSelectionListProps {
    groups: CodeGroup[]
    selected: ReadonlySet<string>
    onChange: (next: Set<string>) => void
}

/** Emplacements à étiqueter, groupés par rack ; cocher un groupe coche tout le rack. */
export function CodeSelectionList({ groups, selected, onChange }: CodeSelectionListProps) {
    const toggle = (ids: string[], on: boolean) => {
        const next = new Set(selected)
        for (const id of ids) {
            if (on) next.add(id)
            else next.delete(id)
        }
        onChange(next)
    }

    return (
        <div className="space-y-3">
            {groups.map((group) => {
                const ids = group.items.map((item) => item.id)
                const count = ids.filter((id) => selected.has(id)).length
                const state = count === 0 ? false : count === ids.length ? true : "indeterminate"
                return (
                    <fieldset key={group.key} className="rounded-xl border border-border p-3">
                        <legend className="flex items-center gap-2 px-1">
                            <Checkbox
                                checked={state}
                                onCheckedChange={(value) => toggle(ids, value === true)}
                                aria-label={`Tout le groupe ${group.label}`}
                            />
                            <span className="font-mono text-sm font-bold text-foreground">{group.label}</span>
                            <span className="text-xs text-muted-foreground">{count}/{ids.length}</span>
                        </legend>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                            {group.items.map((item) => (
                                <label key={item.id} className="flex items-center gap-1.5 font-mono text-xs text-foreground">
                                    <Checkbox
                                        checked={selected.has(item.id)}
                                        onCheckedChange={(value) => toggle([item.id], value === true)}
                                    />
                                    {item.path}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                )
            })}
        </div>
    )
}
```

- [ ] **Step 7: Write `components/codes/CodeLabelSheet.tsx`**

```tsx
import { useMemo } from "react"
import { Printer } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/shared/ui/atoms/button"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { useQrDataUrls } from "@/features/stock_handpick/hooks/ui/useQrDataUrls"
import { emplacementCodeUrl } from "@/features/stock_handpick/utils/emplacementCode"
import { printLabelSheet } from "@/features/stock_handpick/utils/codeLabelSheet"
import type { CodeItem } from "@/features/stock_handpick/utils/emplacementGroups"

/** Aperçu des étiquettes sélectionnées et impression de la planche. */
export function CodeLabelSheet({ items }: { items: CodeItem[] }) {
    const texts = useMemo(
        () => items.map((item) => emplacementCodeUrl(window.location.origin, item.id)),
        [items],
    )
    const qrs = useQrDataUrls(texts)
    const ready = texts.every((text) => qrs.has(text))

    const print = () => {
        const labels = items.map((item, i) => ({ path: item.path, zoneLabel: item.zoneLabel, qr: qrs.get(texts[i]) ?? null }))
        if (labels.some((label) => label.qr === null)) toast.error("Certains QR n'ont pas pu être générés : leur étiquette n'aura que le chemin.")
        if (!printLabelSheet(labels)) toast.error("Fenêtre d'impression bloquée : autorisez les pop-ups pour ce site.")
    }

    return (
        <div className="space-y-3">
            <Button onClick={print} disabled={!ready || items.length === 0}>
                <Printer size={16} aria-hidden />
                Imprimer ({items.length})
            </Button>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((item, i) => {
                    const qr = qrs.get(texts[i])
                    return (
                        <figure key={item.id} className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-background p-3">
                            {qr === undefined ? (
                                <Skeleton className="aspect-square w-full" />
                            ) : qr ? (
                                <img src={qr} alt={`QR ${item.path}`} className="aspect-square w-full" />
                            ) : null}
                            <figcaption className="text-center">
                                <span className="block font-mono text-sm font-bold text-foreground">{item.path}</span>
                                <span className="block text-xs text-muted-foreground">{item.zoneLabel}</span>
                            </figcaption>
                        </figure>
                    )
                })}
            </div>
        </div>
    )
}
```

- [ ] **Step 8: Type-check and lint**

Run: `npx tsc --noEmit -p . 2>&1 | grep stock_handpick ; npx eslint src/features/stock_handpick`
Expected: no output from tsc for `stock_handpick`, ESLint clean.

- [ ] **Step 9: Commit**

```bash
git add src/features/stock_handpick/utils/codeLabelSheet.ts src/features/stock_handpick/utils/codeLabelSheet.test.ts src/features/stock_handpick/hooks/ui/useQrDataUrls.ts src/features/stock_handpick/components/codes/CodeSelectionList.tsx src/features/stock_handpick/components/codes/CodeLabelSheet.tsx
git commit -m "feat(stock_handpick): génération et impression des étiquettes QR"
```

---

### Task 5: Lecteur de codes

**Files:**
- Create: `src/features/stock_handpick/components/codes/CodeScanner.tsx`

**Interfaces:**
- Consumes: `parseEmplacementCode` (tâche 1).
- Produces: `CodeScanner({ open, onOpenChange, onScan, onManual }: { open: boolean; onOpenChange: (open: boolean) => void; onScan: (id: string) => void; onManual: (text: string) => boolean })` — `onManual` renvoie `false` si le texte ne désigne rien.

Pas de test unitaire (API caméra du navigateur) : vérification manuelle en tâche 7.

- [ ] **Step 1: Write the component**

```tsx
import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { toast } from "sonner"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { parseEmplacementCode } from "@/features/stock_handpick/utils/emplacementCode"

interface CodeScannerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onScan: (id: string) => void
    /** Saisie manuelle (chemin ou code) ; `false` si elle ne désigne rien. */
    onManual: (text: string) => boolean
}

/**
 * Lecture d'une étiquette à la caméra arrière. S'arrête au premier code
 * valide ; un code étranger est signalé une seule fois, le lecteur continue.
 * La caméra exige HTTPS (ou localhost) : sinon, la saisie manuelle reste.
 */
export function CodeScanner({ open, onOpenChange, onScan, onManual }: CodeScannerProps) {
    const regionId = `code-scanner-${useId().replace(/:/g, "")}`
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [manual, setManual] = useState("")
    // Le lecteur rappelle le callback ~10×/s : une seule prise en compte.
    const handledRef = useRef(false)
    const lastRejectedRef = useRef<string | null>(null)
    const onScanRef = useRef(onScan)
    onScanRef.current = onScan

    useEffect(() => {
        if (!open) return
        handledRef.current = false
        lastRejectedRef.current = null
        setCameraError(null)
        const scanner = new Html5Qrcode(regionId)
        let started = false
        scanner
            .start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 240, height: 240 } },
                (text) => {
                    if (handledRef.current) return
                    const id = parseEmplacementCode(text)
                    if (id) {
                        handledRef.current = true
                        onScanRef.current(id)
                        return
                    }
                    if (lastRejectedRef.current !== text) {
                        lastRejectedRef.current = text
                        toast.error("Code non reconnu : ce n'est pas une étiquette d'emplacement.")
                    }
                },
                () => {
                    // Pas de code dans l'image : normal entre deux lectures.
                },
            )
            .then(() => {
                started = true
            })
            .catch((error: unknown) => {
                console.error(error)
                setCameraError(
                    window.isSecureContext
                        ? "Caméra indisponible ou refusée. Autorisez l'accès à la caméra, ou saisissez le code."
                        : "La caméra exige une connexion HTTPS. Saisissez le code de l'emplacement.",
                )
            })
        return () => {
            if (started) void scanner.stop().then(() => scanner.clear()).catch(console.error)
        }
    }, [open, regionId])

    const submitManual = (event: FormEvent) => {
        event.preventDefault()
        if (!manual.trim()) return
        if (onManual(manual)) setManual("")
        else toast.error("Aucun emplacement ne correspond à ce code.")
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Scanner une étiquette</DialogTitle>
                    <DialogDescription>Visez le QR code de l'emplacement.</DialogDescription>
                </DialogHeader>
                <div id={regionId} className="aspect-square w-full overflow-hidden rounded-xl bg-muted" />
                {cameraError && <p className="text-sm text-destructive">{cameraError}</p>}
                <form onSubmit={submitManual} className="flex gap-2">
                    <Input
                        value={manual}
                        onChange={(event) => setManual(event.target.value)}
                        placeholder="Ou tapez le chemin : B R2 E3 H1"
                        aria-label="Code de l'emplacement"
                    />
                    <Button type="submit" variant="outline">Ouvrir</Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}
```

Note : `Html5Qrcode(regionId)` exige que l'élément existe au moment du `useEffect` ; Radix monte `DialogContent` avant les effets enfants, mais l'effet est dans ce composant (parent du contenu). Si le premier essai lève « element not found », décaler le démarrage d'une frame : entourer le corps de l'effet d'un `const frame = requestAnimationFrame(() => { … })` et ajouter `cancelAnimationFrame(frame)` au cleanup.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit -p . 2>&1 | grep stock_handpick ; npx eslint src/features/stock_handpick/components/codes`
Expected: rien pour tsc, ESLint clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/stock_handpick/components/codes/CodeScanner.tsx
git commit -m "feat(stock_handpick): lecteur caméra des étiquettes d'emplacement"
```

---

### Task 6: Onglet Codes (à la place de Flux) et cible emplacement du plan

**Files:**
- Create: `src/features/stock_handpick/components/codes/CodesTab.tsx`
- Modify: `src/features/stock_handpick/types/ui.types.ts` (union `HandpickTab`, `STOCK_HANDPICK_TABS`)
- Modify: `src/features/stock_handpick/components/Tabs.tsx` (`TAB_META`, imports)
- Modify: `src/app/routes/router.tsx` (commentaire seulement)
- Modify: `src/features/stock_handpick/hooks/ui/usePlanBalleFocus.ts`
- Modify: `src/features/stock_handpick/components/plan/PlanTab.tsx` (commentaire d'en-tête seulement)

**Interfaces:**
- Consumes: tâches 1–5 ; `usePlanHandpick(refreshKey)` → `{ ballesByEmplacement: Map<string, BalleHandpick[]>, emplacements, zones, pathFor, loading }` ; `useBalleHandpickContext()` → `{ balles, emplacementSegments }` ; `HANDPICK_ROUTE_BASE`.
- Produces: onglet `codesTab` (URL `/stock-handpick/codes/:id?`) ; `/stock-handpick/plan/emp-<id>` fait briller l'emplacement.

- [ ] **Step 1: Replace the Flux tab with the Codes tab**

In `types/ui.types.ts`, `fluxTab` disappears from the union and `codesTab` takes its place:

```ts
export type HandpickTab =
    | "dashboardTab" | "inventaireTab" | "planTab" | "codesTab" | "historiqueTab" | "settingsTab"
```

and in `STOCK_HANDPICK_TABS`, replace the `fluxTab` line with:

```ts
    // Remplace l'onglet Flux, retiré de la navigation (son code reste dans
    // components/flux, non monté).
    { id: "codesTab",      section: "codes",      permission: P.planView },
```

In `components/Tabs.tsx`: replace `ArrowLeftRightIcon` by `QrCodeIcon` in the `lucide-react` import, replace `import FluxTab from "./flux/FluxTab"` by `import CodesTab from "./codes/CodesTab"`, and replace the whole `fluxTab: { … }` entry of `TAB_META` with:

```tsx
    codesTab: {
        label: "Codes",
        icon: <QrCodeIcon size={20} />,
        tooltip: "Étiquettes QR des emplacements : imprimer et scanner",
        content: (detail) => <CodesTab detail={detail} />,
    },
```

- [ ] **Step 2: Write `components/codes/CodesTab.tsx`**

```tsx
import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { ScanLine } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import { HANDPICK_ROUTE_BASE } from "@/features/stock_handpick/types/ui.types"
import { useBalleHandpickContext } from "@/features/stock_handpick/hooks/context/StockHandpickProvider"
import { usePlanHandpick } from "@/features/stock_handpick/hooks/data/usePlanHandpick"
import { buildEmplacementPaths } from "@/features/stock_handpick/utils/planHelpers"
import { groupEmplacementsForCodes } from "@/features/stock_handpick/utils/emplacementGroups"
import {
    findEmplacementByPath,
    parseEmplacementCode,
    planDetailOfEmplacement,
} from "@/features/stock_handpick/utils/emplacementCode"
import { CodeScanner } from "./CodeScanner"
import { CodeSelectionList } from "./CodeSelectionList"
import { CodeLabelSheet } from "./CodeLabelSheet"
import { EmplacementScanResult } from "./EmplacementScanResult"

/**
 * Onglet Codes : imprimer une étiquette QR par emplacement, et lire une
 * étiquette pour voir ce que contient l'emplacement.
 *
 * `codes/<id>` (URL portée par le QR) ouvre le résultat : l'appareil photo
 * natif du téléphone y mène directement. La sélection à imprimer est un état
 * d'affichage, hors de l'URL (docs/ROUTING.md).
 */
export default function CodesTab({ detail }: { detail?: string }) {
    const navigate = useNavigate()
    const { balles } = useBalleHandpickContext()
    const { zones, emplacements, ballesByEmplacement, pathFor, loading } = usePlanHandpick(balles)
    const [selected, setSelected] = useState<Set<string>>(() => new Set())
    const [scanning, setScanning] = useState(false)

    const groups = useMemo(() => groupEmplacementsForCodes(zones, emplacements), [zones, emplacements])
    const selectedItems = useMemo(
        () => groups.flatMap((group) => group.items.filter((item) => selected.has(item.id))),
        [groups, selected],
    )
    const segmentsById = useMemo(() => {
        const map = new Map<string, readonly string[]>()
        for (const [id, path] of buildEmplacementPaths(zones, emplacements)) map.set(id, path.segments)
        return map
    }, [zones, emplacements])

    const open = (id: string) => {
        setScanning(false)
        navigate(`${HANDPICK_ROUTE_BASE}/codes/${id}`)
    }
    const openManual = (text: string) => {
        const id = parseEmplacementCode(text) ?? findEmplacementByPath(text, segmentsById)
        if (!id) return false
        open(id)
        return true
    }

    if (loading) {
        return (
            <div className={HANDPICK_THEME.board.container}>
                <Skeleton aria-hidden className="h-96 w-full rounded-2xl" />
            </div>
        )
    }

    const scanned = detail ? emplacements.find((e) => e.id === detail.toLowerCase()) : undefined

    return (
        <div className={HANDPICK_THEME.board.container}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className={HANDPICK_THEME.section.groupTitle}>Codes des emplacements</h2>
                    <p className="text-xs text-muted-foreground">
                        Imprimez les étiquettes QR des emplacements, puis scannez-les pour voir leur contenu.
                    </p>
                </div>
                <Button onClick={() => setScanning(true)}>
                    <ScanLine size={16} aria-hidden />
                    Scanner
                </Button>
            </div>

            {detail && (
                <EmplacementScanResult
                    emplacement={scanned}
                    path={scanned ? pathFor(scanned.id) : null}
                    balles={scanned ? ballesByEmplacement.get(scanned.id) ?? [] : []}
                    onClose={() => navigate(`${HANDPICK_ROUTE_BASE}/codes`)}
                    onOpenBalle={(id) => navigate(`${HANDPICK_ROUTE_BASE}/inventaire/${id}`)}
                    onShowInPlan={(id) => navigate(`${HANDPICK_ROUTE_BASE}/plan/${planDetailOfEmplacement(id)}`)}
                />
            )}

            <section className="space-y-3">
                <h3 className={HANDPICK_THEME.section.groupTitle}>Générer des étiquettes</h3>
                <CodeSelectionList groups={groups} selected={selected} onChange={setSelected} />
                {selectedItems.length > 0 && <CodeLabelSheet items={selectedItems} />}
            </section>

            <CodeScanner open={scanning} onOpenChange={setScanning} onScan={open} onManual={openManual} />
        </div>
    )
}
```

In `src/app/routes/router.tsx`, in the comment above `path: "/stock-handpick/:section?/:detail?"`, replace the line `//   /stock-handpick/flux/new         → sheet de création d'un mouvement` with `//   /stock-handpick/codes/<id>       → résultat du scan d'une étiquette d'emplacement`.

Check that `HANDPICK_THEME.section.groupTitle` exists (`theme.ts`, used by `PlanTab.tsx`) — it does.

- [ ] **Step 3: Plan target for `emp-<id>` in `hooks/ui/usePlanBalleFocus.ts`**

Replace the hook body so that an `emp-` detail targets the emplacement and skips the balle fetch:

```ts
import { EMPLACEMENT_PATH_SEPARATOR, UUID_DISPLAY_LENGTH } from "@/features/stock_handpick/constants"
import { emplacementOfPlanDetail } from "@/features/stock_handpick/utils/emplacementCode"
// …imports existants inchangés…

/**
 * Cible à faire briller dans le plan, d'après le segment `detail` de l'URL :
 * `/stock-handpick/plan/<id>` vise une balle (lue en base : elle peut être
 * hors du palier chargé de l'inventaire), `/stock-handpick/plan/emp-<id>`
 * un emplacement (« Voir dans le plan » de l'onglet Codes).
 */
export function usePlanBalleFocus(detail: string | undefined): PlanBalleFocus {
    const { fetchById, emplacementSegments } = useBalleHandpickContext()
    const emplacementId = emplacementOfPlanDetail(detail)
    const balleId = emplacementId ? undefined : detail
    const [balle, setBalle] = useState<{ id: string; row: BalleHandpick | null } | null>(null)

    useEffect(() => {
        if (!balleId) return
        let cancelled = false
        void fetchById(balleId).then((row) => {
            if (!cancelled) setBalle({ id: balleId, row })
        })
        return () => {
            cancelled = true
        }
    }, [balleId, fetchById])

    const current = balle && balle.id === balleId ? balle.row : null
    const emplacementPath = emplacementId ? emplacementSegments(emplacementId) : null

    const focus = useMemo(() => {
        if (emplacementId) return focusFromSegments(emplacementPath)
        return current ? focusFromSegments(emplacementSegments(current.emplacement_id)) : null
    }, [emplacementId, emplacementPath, current, emplacementSegments])

    if (emplacementId) {
        return {
            focus,
            label: emplacementPath?.join(EMPLACEMENT_PATH_SEPARATOR) ?? "Emplacement",
            resolved: emplacementPath !== null,
        }
    }

    const resolved = Boolean(balleId) && balle?.id === balleId
    const label = current
        ? current.raw_name ?? `Balle ${current.id.slice(0, UUID_DISPLAY_LENGTH)}`
        : "Balle"
    return { focus, label, resolved }
}
```

Note : `emplacementSegments` renvoie un nouveau tableau à chaque appel ; si le linter `react-hooks/exhaustive-deps` ou un rendu en boucle apparaît, calculer `emplacementPath` dans le `useMemo` au lieu de le mettre en dépendance.

In `PlanTab.tsx`, update the last sentence of the header comment to: « Seules exceptions, adressables et partageables : `plan/<id>` fait briller une balle dans la vue 3D (« Voir dans le plan 3D » de sa fiche), `plan/emp-<id>` un emplacement (« Voir dans le plan » de l'onglet Codes). »

- [ ] **Step 4: Run all checks**

Run: `npx rstest run src/features/stock_handpick && npx tsc --noEmit -p . 2>&1 | grep stock_handpick ; npx eslint src/features/stock_handpick`
Expected: tous les tests PASS, rien pour tsc, ESLint clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/routes/router.tsx src/features/stock_handpick/components/codes/CodesTab.tsx src/features/stock_handpick/types/ui.types.ts src/features/stock_handpick/components/Tabs.tsx src/features/stock_handpick/hooks/ui/usePlanBalleFocus.ts src/features/stock_handpick/components/plan/PlanTab.tsx
git commit -m "feat(stock_handpick): onglet Codes à la place de Flux"
```

---

### Task 7: Vérification dans l'app et mise à jour de la spec

**Files:**
- Modify: `docs/superpowers/specs/2026-09-24-codes-emplacements-design.md`

- [ ] **Step 1: Update the spec to match the two deviations**

In the « Décisions » table, replace the « Impression » row value with: « Fenêtre dédiée (`window.open` + `print()`), planche A4 3 colonnes en mm. L'app-shell n'est pas masquable proprement par des variantes `print:` depuis un onglet. ». In `CodeScanner.tsx`'s description, replace « Champ de saisie manuelle en secours » with « Saisie manuelle en secours : URL, uuid, ou chemin tapé (`B R2 E3 H1`) ». In « Composants », replace the `emplacementGroups` bullet with « un groupe par rack (`B · R2`), zones sans rack groupées par zone (`A`) ».

- [ ] **Step 2: Manual check in the running app**

Run the app (`npm run dev`), then:
1. `/stock-handpick/codes` : l'onglet « Codes » apparaît après « Plan », et « Flux » n'est plus dans la barre ; `/stock-handpick/flux` retombe sur l'Inventaire ; les groupes `A`, `B · R1`…`B · R5`, `D` sont listés ; R4/E4, R2/E1/H1 absents.
2. Cocher `B · R2` → aperçu avec QR ; « Imprimer » ouvre la fenêtre d'impression, trois étiquettes par ligne.
3. Scanner une étiquette imprimée avec l'appareil photo natif d'un téléphone (app servie en HTTPS) → ouvre `/stock-handpick/codes/<id>` avec le bon chemin et ses balles.
4. Bouton « Scanner » dans l'app → le résultat s'ouvre au premier code ; un QR étranger affiche un seul toast.
5. Saisie `b r2 e3 h1` → ouvre l'emplacement.
6. « Voir dans le plan » → vue 3D, travée surlignée.
7. `/stock-handpick/codes/00000000-0000-0000-0000-000000000000` → « Code non reconnu ».

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-24-codes-emplacements-design.md
git commit -m "docs(stock_handpick): spec codes QR alignée sur l'implémentation"
```
