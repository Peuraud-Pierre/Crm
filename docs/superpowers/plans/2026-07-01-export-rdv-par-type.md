# Export RDV par type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second export button on the CRM Analytics page that produces an Excel file with, per commercial, the RDV count broken down by type (achat / découverte / visio) with percentages and a trend vs the previous period.

**Architecture:** Mirror the existing `ExportStatsButton.tsx` pattern exactly (pinned central accounts, `exportGroups` ordering, separators, TOTAL row, daily-mode fallback), but source a new, simpler aggregation (`getRdvTypeExportData()`) added to `AnalyticsContext.tsx` that classifies each RDV event by type instead of only counting it.

**Tech Stack:** React + TypeScript, `xlsx-js-style` for the Excel generation, `@rstest/core` for unit tests.

## Global Constraints

- RDV attribution uses the exact same bucketing rules already used by `getStatsExportData()` in `AnalyticsContext.tsx` (creator-id bucket key with setter display name in collaborator mode; setter id in daily mode) — the new export's "Nbr de RDV" column must match the existing "Nbr de RDV pris" column bit-for-bit for the same period/filter.
- Type classification: `achat` = event type containing `"achat"`, `decouverte` = containing `"decouverte"`, `visio` = containing `"visio"` (cross-cutting, not mutually exclusive with achat/decouverte). Based on `normalizeEventType()` (`AnalyticsContext.tsx:109-113`).
- No second tab in the existing workbook — separate button, separate `.xlsx` file.
- No new Supabase migration, no change to `client_crm.closers`.
- No change to `ExportStatsButton.tsx` behavior.

---

### Task 1: Pure RDV-type classification helper (TDD)

**Files:**
- Modify: `src/features/crm/context/AnalyticsContext.tsx` (add helper near `normalizeEventType`, `AnalyticsContext.tsx:109-113`)
- Test: `src/features/crm/context/AnalyticsContext.test.ts` (new file)

**Interfaces:**
- Produces: `export const classifyRdvType: (nom: string | undefined | null) => { achat: boolean; decouverte: boolean; visio: boolean }` — used by Task 2.

- [ ] **Step 1: Write the failing test**

Create `src/features/crm/context/AnalyticsContext.test.ts`:

```ts
import { expect, test } from "@rstest/core"
import { classifyRdvType } from "./AnalyticsContext"

test("classifyRdvType flags achat for both physique and visio achat", () => {
    expect(classifyRdvType("rdv physique achat")).toEqual({
        achat: true,
        decouverte: false,
        visio: false,
    })
    expect(classifyRdvType("rdv visio achat")).toEqual({
        achat: true,
        decouverte: false,
        visio: true,
    })
})

test("classifyRdvType flags decouverte for both physique and visio decouverte", () => {
    expect(classifyRdvType("rdv physique decouverte")).toEqual({
        achat: false,
        decouverte: true,
        visio: false,
    })
    expect(classifyRdvType("rdv decouverte visio")).toEqual({
        achat: false,
        decouverte: true,
        visio: true,
    })
})

test("classifyRdvType returns all-false for unknown or missing type", () => {
    expect(classifyRdvType("appel")).toEqual({
        achat: false,
        decouverte: false,
        visio: false,
    })
    expect(classifyRdvType(null)).toEqual({
        achat: false,
        decouverte: false,
        visio: false,
    })
    expect(classifyRdvType(undefined)).toEqual({
        achat: false,
        decouverte: false,
        visio: false,
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx rstest run src/features/crm/context/AnalyticsContext.test.ts`
Expected: FAIL — `classifyRdvType` is not exported from `./AnalyticsContext` (or "no matching export").

- [ ] **Step 3: Add the helper**

In `src/features/crm/context/AnalyticsContext.tsx`, immediately after `normalizeEventType` (right after line 113, i.e. after the closing `}` of the `normalizeEventType` function), add:

```ts
export const classifyRdvType = (nom: string | undefined | null) => {
    const type = normalizeEventType(nom)
    return {
        achat: type.includes("achat"),
        decouverte: type.includes("decouverte"),
        visio: type.includes("visio"),
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx rstest run src/features/crm/context/AnalyticsContext.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/crm/context/AnalyticsContext.tsx src/features/crm/context/AnalyticsContext.test.ts
git commit -m "feat(crm): add classifyRdvType helper for achat/decouverte/visio breakdown"
```

---

### Task 2: `RdvTypeRow`/`RdvTypeExportData` types + `getRdvTypeExportData()`

**Files:**
- Modify: `src/features/crm/context/AnalyticsContext.tsx`

**Interfaces:**
- Consumes: `classifyRdvType` (Task 1), and the existing `getPeriodRange`, `getDayKey`, `getPeriodKey`, `getPreviousPeriodKey`, `getEventSetterId`, `getEventSetterName`, `getCommercialName`, `eventsStats`, `selectedPeriod`, `selectedFilter`, `selectedCommercial` already in scope in `AnalyticsContext.tsx` (all used identically by `getStatsExportData`, `AnalyticsContext.tsx:1189-1417`).
- Produces:
  - `export interface RdvTypeRow { userId: string; name: string; total: number; achat: number; decouverte: number; visio: number }`
  - `export interface RdvTypeExportData { period: PeriodType; filter: string | null; hasPrev: boolean; mode: "collaborators" | "daily"; perCollaborator: RdvTypeRow[]; perCollaboratorPrev: RdvTypeRow[] }`
  - `getRdvTypeExportData: () => RdvTypeExportData` exposed via `useAnalytics()`, for Task 3.

This task has no isolated unit test: `getStatsExportData` (the function it mirrors) has none either, because it's a `useCallback` deep inside a React context provider with many closed-over dependencies (not practical to unit test outside the component tree in this codebase's existing conventions). Correctness is verified in Task 4 via manual testing in the running app, comparing the new export's "Nbr de RDV" column against the existing export's "Nbr de RDV pris" column for the same period/filter.

- [ ] **Step 1: Add the two exported interfaces**

In `src/features/crm/context/AnalyticsContext.tsx`, right after the closing `}` of `StatsExportData` (after line 188), add:

```ts
export interface RdvTypeRow {
    userId: string
    name: string
    total: number
    achat: number
    decouverte: number
    visio: number
}
export interface RdvTypeExportData {
    period: PeriodType
    filter: string | null
    hasPrev: boolean
    /** Même sémantique que StatsExportData.mode (cf. getStatsExportData). */
    mode: "collaborators" | "daily"
    perCollaborator: RdvTypeRow[]
    perCollaboratorPrev: RdvTypeRow[]
}
```

- [ ] **Step 2: Add `getRdvTypeExportData` to the `AnalyticsContextType` interface**

In `src/features/crm/context/AnalyticsContext.tsx:368`, right after the line `getStatsExportData: () => StatsExportData`, add:

```ts
    getRdvTypeExportData: () => RdvTypeExportData
```

- [ ] **Step 3: Implement `getRdvTypeExportData`**

In `src/features/crm/context/AnalyticsContext.tsx`, right after the closing of `getStatsExportData`'s `useCallback` (after line 1417, i.e. right before the `return (` at line 1419), add:

```ts
    // Données d'export « RDV par type » : par collaborateur, total de RDV +
    // répartition achat/découverte/visio sur la période courante. Mêmes
    // règles d'attribution que getStatsExportData (RDV ventilés par
    // créateur en mode collaborateurs, par setter en mode journalier), pour
    // que le total de cet export corresponde exactement à la colonne
    // « Nbr de RDV pris » de l'export existant.
    const getRdvTypeExportData = useCallback((): RdvTypeExportData => {
        const empty = (userId: string, name: string): RdvTypeRow => ({
            userId,
            name,
            total: 0,
            achat: 0,
            decouverte: 0,
            visio: 0,
        })
        const bumpType = (row: RdvTypeRow, nom: string | undefined | null) => {
            row.total += 1
            const { achat, decouverte, visio } = classifyRdvType(nom)
            if (achat) row.achat += 1
            if (decouverte) row.decouverte += 1
            if (visio) row.visio += 1
        }

        // === MODE « UN SEUL COLLABORATEUR » : ventilation JOUR PAR JOUR ===
        if (selectedCommercial !== "all") {
            const cid = selectedCommercial
            const range = getPeriodRange(selectedPeriod, selectedFilter)
            const inRange = (d: Date) =>
                !range || (d >= range.start && d < range.end)
            const dayKeyIfValid = (dateStr?: string | null): string | null => {
                if (!dateStr) return null
                const d = new Date(dateStr)
                if (Number.isNaN(d.getTime()) || !inRange(d)) return null
                return getDayKey(d)
            }
            const labelOf = (key: string) => {
                const [y, m, dd] = key.split("-").map(Number)
                return new Date(y, m - 1, dd).toLocaleDateString("fr-FR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                })
            }
            const dayRows = new Map<string, RdvTypeRow>()
            const ensureDay = (key: string) => {
                let r = dayRows.get(key)
                if (!r) {
                    r = empty(key, labelOf(key))
                    dayRows.set(key, r)
                }
                return r
            }
            if (range) {
                for (
                    let t = new Date(range.start);
                    t < range.end;
                    t.setDate(t.getDate() + 1)
                )
                    ensureDay(getDayKey(t))
            }
            ;(eventsStats || []).forEach((evt) => {
                const e = evt as AnalyticsEvent
                if (getEventSetterId(e) !== cid) return
                const key = dayKeyIfValid(e.created_at)
                if (key) bumpType(ensureDay(key), e.nom)
            })
            const days = Array.from(dayRows.keys()).sort()
            const perDay = days.map((k) => dayRows.get(k)!)
            const perDayPrev: RdvTypeRow[] = days.map((k, i) =>
                i > 0
                    ? { ...dayRows.get(days[i - 1])!, userId: k }
                    : empty(k, "")
            )
            return {
                period: selectedPeriod,
                filter: selectedFilter,
                hasPrev: perDay.length > 1,
                mode: "daily",
                perCollaborator: perDay,
                perCollaboratorPrev: perDayPrev,
            }
        }

        // === MODE « PAR COLLABORATEUR » ===
        const aggregate = (matches: (d?: string | null) => boolean) => {
            const byCollab = new Map<string, RdvTypeRow>()
            const bucketByIdName = (id: string, name: string) => {
                let r = byCollab.get(id)
                if (!r) {
                    r = empty(id, name)
                    byCollab.set(id, r)
                }
                return r
            }
            ;(eventsStats || []).forEach((evt) => {
                const e = evt as AnalyticsEvent
                if (!matches(e.created_at)) return
                const creatorId = e.creator_id || e.created_by
                if (!creatorId) return
                const setterName = getEventSetterName(e)
                const displayName =
                    setterName !== "Non assigné"
                        ? setterName
                        : getCommercialName(e as unknown as CommercialItem)
                bumpType(bucketByIdName(creatorId, displayName), e.nom)
            })
            return byCollab
        }

        const matchKey = (fk: string) => (dateStr?: string | null) => {
            if (!dateStr) return false
            const d = new Date(dateStr)
            if (Number.isNaN(d.getTime())) return false
            return getPeriodKey(selectedPeriod, d) === fk
        }

        const curMatches = selectedFilter
            ? matchKey(selectedFilter)
            : (d?: string | null) => !!d
        const cur = aggregate(curMatches)

        const prevFilter = selectedFilter
            ? getPreviousPeriodKey(selectedFilter, selectedPeriod)
            : null
        const prev = prevFilter
            ? aggregate(matchKey(prevFilter))
            : new Map<string, RdvTypeRow>()

        const perCollaborator = Array.from(cur.values()).sort(
            (a, b) => b.total - a.total
        )
        const perCollaboratorPrev = Array.from(prev.values())

        return {
            period: selectedPeriod,
            filter: selectedFilter,
            hasPrev: !!prevFilter,
            mode: "collaborators",
            perCollaborator,
            perCollaboratorPrev,
        }
    }, [
        eventsStats,
        getCommercialName,
        getEventSetterName,
        getEventSetterId,
        selectedPeriod,
        selectedFilter,
        selectedCommercial,
    ])
```

- [ ] **Step 4: Expose it through the provider value**

In `src/features/crm/context/AnalyticsContext.tsx:1450`, right after the line `getStatsExportData,`, add:

```ts
                getRdvTypeExportData,
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json` (or the project's existing typecheck script if one exists — check `package.json` `"scripts"` for a `typecheck`/`tsc` entry first and prefer that)
Expected: no new type errors introduced by this change.

- [ ] **Step 6: Commit**

```bash
git add src/features/crm/context/AnalyticsContext.tsx
git commit -m "feat(crm): add getRdvTypeExportData for per-commercial RDV type breakdown"
```

---

### Task 3: `ExportRdvTypeButton.tsx` component

**Files:**
- Create: `src/features/crm/components/Analytics/ExportRdvTypeButton.tsx`

**Interfaces:**
- Consumes: `useAnalytics()` fields `getRdvTypeExportData`, `selectedPeriod`, `selectedFilter`, `selectedCommercial`, `crmUsers`, `exportGroups`, `exportFallbackNames` (all already exposed by Task 2 / pre-existing context); `RdvTypeRow` type (Task 2); `TARGET_IDS` from `./Widget/EventsPalier`.
- Produces: `export function ExportRdvTypeButton()` — a `<Button>` consumed by Task 4 in `Header.tsx`.

No automated test for this task: it is a click handler that builds and downloads an `.xlsx` file via `xlsx-js-style`, the same untested pattern as the existing `ExportStatsButton.tsx`. Verified manually in Task 4.

- [ ] **Step 1: Create the file**

Create `src/features/crm/components/Analytics/ExportRdvTypeButton.tsx`:

```tsx
import { FileBarChart2 } from "lucide-react"
import XLSX from "xlsx-js-style"
import { Button } from "@/shared/ui/button"
import { useAnalytics } from "../../context/AnalyticsContext"
import type { RdvTypeRow } from "../../context/AnalyticsContext"
import { TARGET_IDS } from "./Widget/EventsPalier"

const round1 = (n: number) => Math.round(n * 10) / 10

const HEADER_STYLE = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
    fill: { fgColor: { rgb: "111827" } },
    alignment: { horizontal: "center", vertical: "center" },
}
const TOTAL_STYLE = {
    font: { bold: true, sz: 10, color: { rgb: "111827" } },
    fill: { fgColor: { rgb: "D1D5DB" } },
}
const SEP_COLORS = { black: "111827", red: "DC2626" } as const
const TREND = {
    up: {
        fill: { fgColor: { rgb: "C6EFCE" } },
        font: { bold: true, color: { rgb: "137333" } },
        alignment: { horizontal: "center" },
    },
    down: {
        fill: { fgColor: { rgb: "FFC7CE" } },
        font: { bold: true, color: { rgb: "A50E0E" } },
        alignment: { horizontal: "center" },
    },
    eq: {
        fill: { fgColor: { rgb: "D9D9D9" } },
        font: { bold: true, color: { rgb: "5F6368" } },
        alignment: { horizontal: "center" },
    },
}

function styleRow(
    ws: XLSX.WorkSheet,
    r: number,
    nbCols: number,
    style: object
) {
    for (let c = 0; c < nbCols; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })]
        if (cell) cell.s = style
    }
}

// Indices de colonnes fixes (cf. formules Excel plus bas).
const C_TOTAL = 1
const C_DELTA = 2
const C_ACHAT = 3
const C_ACHAT_PCT = 4
const C_DECOUVERTE = 5
const C_DECOUVERTE_PCT = 6
const C_VISIO = 7
const C_VISIO_PCT = 8
const NB_COLS = 9

const HEADER = [
    "Collaborateur",
    "Nbr de RDV",
    "Δ",
    "Achat",
    "Achat (%)",
    "Découverte",
    "Découverte (%)",
    "Visio",
    "Visio (%)",
]

const COL_WIDTHS = [24, 14, 11, 12, 12, 14, 14, 12, 12]

export function ExportRdvTypeButton() {
    const {
        getRdvTypeExportData,
        selectedPeriod,
        selectedFilter,
        selectedCommercial,
        crmUsers,
        exportGroups,
        exportFallbackNames,
    } = useAnalytics()

    const handleExport = () => {
        const { perCollaborator, perCollaboratorPrev, hasPrev, mode } =
            getRdvTypeExportData()
        const daily = mode === "daily"
        const wb = XLSX.utils.book_new()

        const byId = new Map(perCollaborator.map((r) => [r.userId, r]))
        const prevById = new Map(perCollaboratorPrev.map((r) => [r.userId, r]))
        const nameOf = (id: string) =>
            byId.get(id)?.name ||
            crmUsers.find((u) => u.id === id)?.name ||
            exportFallbackNames[id] ||
            id
        const nameOfPinned = (id: string) =>
            exportFallbackNames[id] ||
            crmUsers.find((u) => u.id === id)?.name ||
            byId.get(id)?.name ||
            id
        const zero = (id: string, name = nameOf(id)): RdvTypeRow => ({
            userId: id,
            name,
            total: 0,
            achat: 0,
            decouverte: 0,
            visio: 0,
        })
        const rowFor = (id: string, name = nameOf(id)): RdvTypeRow => {
            const b = byId.get(id)
            return b ? { ...b, name } : zero(id, name)
        }
        const prevRowFor = (id: string): RdvTypeRow =>
            prevById.get(id) ?? zero(id)

        const trendOf = (
            curN: number,
            prevN: number
        ): { text: string; style: object | null } => {
            if (!hasPrev || Number.isNaN(curN) || Number.isNaN(prevN))
                return { text: "", style: null }
            const up = curN > prevN
            const down = curN < prevN
            const arrow = up ? "▲" : down ? "▼" : "="
            let label: string
            if (curN === prevN) label = "0%"
            else if (prevN === 0) label = "nouv."
            else {
                const pct = round1(((curN - prevN) / prevN) * 100)
                label = `${pct > 0 ? "+" : ""}${pct}%`
            }
            return {
                text: `${arrow} ${label}`,
                style: up ? TREND.up : down ? TREND.down : TREND.eq,
            }
        }

        const aoa: (string | number)[][] = [
            ["Statistiques CRM — RDV par type"],
            [
                "Période",
                `${selectedPeriod}${selectedFilter ? ` — ${selectedFilter}` : " — toutes données"}`,
            ],
            [],
            daily ? ["Jour", ...HEADER.slice(1)] : HEADER,
        ]

        const styled: { r: number; c: number; style: object }[] = []

        const pushRow = (cur: RdvTypeRow, prev: RdvTypeRow) => {
            const r = aoa.length
            const { text, style } = trendOf(cur.total, prev.total)
            aoa.push([
                cur.name,
                cur.total,
                text,
                cur.achat,
                0,
                cur.decouverte,
                0,
                cur.visio,
                0,
            ])
            if (style) styled.push({ r, c: C_DELTA, style })
        }

        type Entry =
            | { type: "row"; cur: RdvTypeRow; prev: RdvTypeRow }
            | { type: "sep"; color: string }
        const ordered: Entry[] = []
        const addRow = (id: string, name = nameOf(id)) => {
            ordered.push({
                type: "row",
                cur: rowFor(id, name),
                prev: prevRowFor(id),
            })
        }

        if (daily) {
            perCollaborator.forEach((cur) => {
                const prev = prevById.get(cur.userId) ?? zero(cur.userId, "")
                ordered.push({ type: "row", cur, prev })
            })
        } else {
            const pinnedIds = Array.from(TARGET_IDS)
            pinnedIds.forEach((id) => addRow(id, nameOfPinned(id)))

            if (exportGroups.length > 0) {
                exportGroups.forEach((g) => {
                    const before = ordered.length
                    g.ids.forEach((id) => {
                        if (!TARGET_IDS.has(id)) addRow(id)
                    })
                    if (g.sepAfter && ordered.length > before)
                        ordered.push({
                            type: "sep",
                            color: SEP_COLORS[g.sepAfter],
                        })
                })
            } else {
                const seen = new Set(pinnedIds)
                perCollaborator.forEach((r) => {
                    if (!r.userId || seen.has(r.userId)) return
                    seen.add(r.userId)
                    addRow(r.userId)
                })
            }
        }

        const rowEntries = ordered.filter(
            (e): e is Extract<Entry, { type: "row" }> => e.type === "row"
        )
        const sumSide = (side: "cur" | "prev"): RdvTypeRow =>
            rowEntries.reduce(
                (acc, e) => ({
                    userId: "TOTAL",
                    name: "TOTAL",
                    total: acc.total + e[side].total,
                    achat: acc.achat + e[side].achat,
                    decouverte: acc.decouverte + e[side].decouverte,
                    visio: acc.visio + e[side].visio,
                }),
                zero("TOTAL", "TOTAL")
            )

        const totalRowIdx = aoa.length
        pushRow(sumSide("cur"), sumSide("prev"))

        const sepRows: { r: number; color: string }[] = []
        const dataRowIdxs: number[] = []
        ordered.forEach((e) => {
            if (e.type === "sep") {
                aoa.push(Array.from({ length: NB_COLS }, () => ""))
                sepRows.push({ r: aoa.length - 1, color: e.color })
            } else {
                dataRowIdxs.push(aoa.length)
                pushRow(e.cur, e.prev)
            }
        })

        const ws = XLSX.utils.aoa_to_sheet(aoa)
        ws["!cols"] = COL_WIDTHS.map((wch) => ({ wch }))
        if (ws["A1"]) ws["A1"].s = { font: { bold: true, sz: 13 } }
        styleRow(ws, 3, NB_COLS, HEADER_STYLE)
        styleRow(ws, totalRowIdx, NB_COLS, TOTAL_STYLE)

        const rowsMeta: { hpt: number }[] = []
        sepRows.forEach(({ r, color }) => {
            styleRow(ws, r, NB_COLS, { fill: { fgColor: { rgb: color } } })
            rowsMeta[r] = { hpt: 6 }
        })
        ws["!rows"] = rowsMeta

        styled.forEach(({ r, c, style }) => {
            const cell = ws[XLSX.utils.encode_cell({ r, c })]
            if (cell) cell.s = style
        })

        const setFormula = (r0: number, c0: number, f: string) => {
            const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
            const prevCell = ws[addr]
            ws[addr] = { t: "n", f, s: prevCell?.s, z: prevCell?.z }
        }
        const applyPercents = (r0: number) => {
            const R = r0 + 1
            const B = XLSX.utils.encode_col(C_TOTAL)
            const D = XLSX.utils.encode_col(C_ACHAT)
            const F = XLSX.utils.encode_col(C_DECOUVERTE)
            const H = XLSX.utils.encode_col(C_VISIO)
            setFormula(
                r0,
                C_ACHAT_PCT,
                `IF(${B}${R}=0,0,ROUND(${D}${R}/${B}${R}*100,1))`
            )
            setFormula(
                r0,
                C_DECOUVERTE_PCT,
                `IF(${B}${R}=0,0,ROUND(${F}${R}/${B}${R}*100,1))`
            )
            setFormula(
                r0,
                C_VISIO_PCT,
                `IF(${B}${R}=0,0,ROUND(${H}${R}/${B}${R}*100,1))`
            )
        }
        if (dataRowIdxs.length > 0) {
            const first = Math.min(...dataRowIdxs) + 1
            const last = Math.max(...dataRowIdxs) + 1
            ;[C_TOTAL, C_ACHAT, C_DECOUVERTE, C_VISIO].forEach((c) => {
                const col = XLSX.utils.encode_col(c)
                setFormula(totalRowIdx, c, `SUM(${col}${first}:${col}${last})`)
            })
        }
        applyPercents(totalRowIdx)
        dataRowIdxs.forEach((r0) => applyPercents(r0))

        const percentCols = [C_ACHAT_PCT, C_DECOUVERTE_PCT, C_VISIO_PCT]
        ;[totalRowIdx, ...dataRowIdxs].forEach((r0) => {
            percentCols.forEach((c) => {
                const cell = ws[XLSX.utils.encode_cell({ r: r0, c })]
                if (cell) cell.z = '0.0"%"'
            })
        })

        ws["!freeze"] = { xSplit: 0, ySplit: totalRowIdx }
        XLSX.utils.book_append_sheet(wb, ws, "RDV par type")

        const today = new Date().toISOString().slice(0, 10)
        const tag = selectedFilter || selectedPeriod
        const who = daily
            ? (crmUsers.find((u) => u.id === selectedCommercial)?.name || "")
                  .replace(/\s+/g, "_")
            : ""
        XLSX.writeFile(
            wb,
            `stats_crm_rdv_types_${who ? `${who}_` : ""}${tag}_${today}.xlsx`
        )
    }

    return (
        <Button
            variant="outline"
            size="sm"
            className="w-full lg:w-auto h-9 gap-2 rounded-xl border-dashed"
            onClick={handleExport}
            title="Exporter la répartition des RDV par type (achat / découverte / visio)"
        >
            <FileBarChart2 className="h-4 w-4 shrink-0" /> RDV par type
        </Button>
    )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no type errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/features/crm/components/Analytics/ExportRdvTypeButton.tsx
git commit -m "feat(crm): add ExportRdvTypeButton component"
```

---

### Task 4: Wire the button into the Analytics header + manual verification

**Files:**
- Modify: `src/features/crm/components/Analytics/Header.tsx:20,197`

**Interfaces:**
- Consumes: `ExportRdvTypeButton` (Task 3).

- [ ] **Step 1: Import the new button**

In `src/features/crm/components/Analytics/Header.tsx:20`, right after the line `import { ExportStatsButton } from "./ExportStatsButton"`, add:

```ts
import { ExportRdvTypeButton } from "./ExportRdvTypeButton"
```

- [ ] **Step 2: Render it next to the existing export button**

In `src/features/crm/components/Analytics/Header.tsx:197`, replace:

```tsx
                {canSelectCommercial && <ExportStatsButton />}
```

with:

```tsx
                {canSelectCommercial && (
                    <>
                        <ExportStatsButton />
                        <ExportRdvTypeButton />
                    </>
                )}
```

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: no errors.

- [ ] **Step 4: Manual verification in the running app**

Run: `npm run dev`, open the CRM Analytics tab in the browser as a user with `canSelectCommercial = true` (Super Admin/Manager).

Checklist:
- Both "Exporter" and "RDV par type" buttons are visible side by side in the header.
- Click "RDV par type" with no commercial selected (`selectedCommercial === "all"`): a file `stats_crm_rdv_types_<filtre>_<date>.xlsx` downloads. Open it and confirm:
  - The "Nbr de RDV" column, row by row, matches the "Nbr de RDV pris" column of a file exported at the same time via the existing "Exporter" button (same period/filter selected in the UI for both).
  - Achat % + Découverte % = 100% (or 0/0 → 0%) on every data row and on TOTAL.
  - Visio % is between 0 and 100 independently of the achat/découverte split.
  - TOTAL row values equal the sum of the displayed rows above the black separator bar plus below it (same grouping as the existing export).
- Select a single commercial (triggers daily mode) and click "RDV par type": confirm one row per day of the period, with a Δ trend column comparing to the previous day.
- Run the existing "Exporter" button once more and confirm its output is unchanged (no regression).

- [ ] **Step 5: Commit** (only if Step 4 required fixes; otherwise nothing to commit)

```bash
git add -A
git commit -m "fix(crm): address issues found in manual verification of RDV type export"
```
(Skip this commit if no changes were needed.)
