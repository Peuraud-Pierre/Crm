import { format } from "date-fns"
import { fr } from "date-fns/locale"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import {
    HEADER_FILLS,
    resolveCellFill,
    type ColDef,
} from "@/features/stock/utils/arrivageExportColumns"
import { groupByMonth, monthBannerLabel, type MonthGroup } from "@/features/stock/utils/arrivageGrouping"
import { rowStateOf } from "@/features/stock/utils/buildArrivageWorkbook"
import "./print.css"

export type PrintVariant = "detailed" | "simple"

interface ArrivagePrintDocumentProps {
    variant: PrintVariant
    rows:    ArrivageManuelRow[]
    /** Colonnes autorisées par les permissions — format détaillé uniquement. */
    cols:    ColDef[]
    from:    Date
    to:      Date
}

const hex = (rgb: string) => `#${rgb}`

function fmtKg(n: number): string {
    return `${Math.round(n).toLocaleString("fr-FR")} kg`
}

function parseDate(d: string | null | undefined): Date | null {
    if (!d) return null
    try {
        // date-only strings (YYYY-MM-DD) must be parsed as local midnight, not UTC
        return d.length === 10 ? new Date(d + "T00:00") : new Date(d)
    } catch { return null }
}

/** "08/09/26" — colonnes de dates du format simple. */
function fmtShortDate(d: string | null | undefined): string {
    const date = parseDate(d)
    return date ? format(date, "dd/MM/yy") : "—"
}

/** "Lun 08/09/26 14:30" — déchargement prévu, avec le jour de la semaine. */
function fmtShortDatetime(d: string | null | undefined): string {
    const date = parseDate(d)
    if (!date) return "—"
    // `EEE` en français rend "lun." — on retire le point et on capitalise.
    const jour = format(date, "EEE", { locale: fr }).replace(".", "")
    return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} ${format(date, "dd/MM/yy HH:mm")}`
}

function fmtInt(n: number | null | undefined): string {
    return n == null ? "—" : Math.round(n).toLocaleString("fr-FR")
}

/**
 * Densité typographique du document, choisie d'après le nombre de lignes à
 * placer. Sans elle, une période à cinq arrivages sortait en 9 pt sur un A4
 * paysage — le tableau occupait un coin de la feuille. Chaque palier vise à
 * remplir la hauteur utile (~160 mm entre l'en-tête et le pied de page).
 *
 * Le comptage inclut les lignes de structure : une bannière de mois et, pour le
 * format détaillé, une ligne de sous-total par groupe.
 */
type Density = "airy" | "comfy" | "normal" | "dense"

function pickDensity(groups: MonthGroup[], variant: PrintVariant): Density {
    const structural = variant === "detailed" ? 2 : 1
    const lines = groups.reduce((sum, g) => sum + g.rows.length + structural, 0)

    if (lines <= 16) return "airy"
    if (lines <= 26) return "comfy"
    if (lines <= 42) return "normal"
    return "dense"
}

/**
 * Document imprimable des arrivages, dans ses deux formats.
 *
 * Un seul composant sert la prévisualisation et la sortie papier : ce que
 * l'utilisateur valide dans le dialog est littéralement ce qui est imprimé.
 */
export default function ArrivagePrintDocument({
    variant, rows, cols, from, to,
}: ArrivagePrintDocumentProps) {
    // Une seule lecture de l'horloge pour tout le document : sans ça, deux lignes
    // pouvaient être classées de part et d'autre d'une frontière qui bouge.
    const now         = new Date()
    const groups      = groupByMonth(rows, now)
    const totalWeight = rows.reduce((sum, r) => sum + (r.total_weight_kg ?? 0), 0)
    const states      = rows.map(r => rowStateOf(r, now))

    const alertCount     = states.filter(st => st === "alert").length
    const pastCount      = states.filter(st => st === "past").length
    const scheduledCount = states.filter(st => st === "scheduled").length
    const density     = pickDensity(groups, variant)

    return (
        <div className={`apd-doc apd-doc--${density}`}>
            <header className="apd-doc-header">
                <div>
                    <h1 className="apd-title">Arrivages</h1>
                    <p className="apd-subtitle">
                        {format(from, "d MMMM yyyy", { locale: fr })} → {format(to, "d MMMM yyyy", { locale: fr })}
                    </p>
                </div>
                <div className="apd-meta">
                    Édité le {format(new Date(), "dd/MM/yyyy", { locale: fr })}
                </div>
            </header>

            {rows.length === 0 ? (
                <p className="apd-empty">Aucun arrivage sur cette période.</p>
            ) : variant === "detailed" ? (
                <DetailedTable groups={groups} cols={cols} now={now} />
            ) : (
                <SimpleTable groups={groups} now={now} />
            )}

            <footer className="apd-footer">
                <span className="apd-footer-total">
                    Total {rows.length} arrivage{rows.length > 1 ? "s" : ""} · {fmtKg(totalWeight)}
                </span>
                <span className="apd-legend">
                    {alertCount > 0 && <>⚠ facture manquante · déchargement sous 7 jours ({alertCount}){" · "}</>}
                    lignes en jaune, date en rouge souligné = en route ({scheduledCount}) · lignes grisées = passé ({pastCount})
                </span>
            </footer>
        </div>
    )
}

// ─── Format détaillé — réplique du classeur Excel ─────────────────────────────

function DetailedTable({ groups, cols, now }: { groups: MonthGroup[]; cols: ColDef[]; now: Date }) {
    const weightColIdx = cols.findIndex(c => c.permKey === "total_weight_kg")
    const totalWidth   = cols.reduce((sum, c) => sum + c.width, 0)

    return (
        <table className="apd-table apd-table--detailed">
            <colgroup>
                {cols.map(col => (
                    <col key={col.permKey} style={{ width: `${(col.width / totalWidth) * 100}%` }} />
                ))}
            </colgroup>
            <thead>
                <tr>
                    {cols.map(col => (
                        <th key={col.permKey} style={{ backgroundColor: hex(HEADER_FILLS[col.emphasis]) }}>
                            {col.header}
                        </th>
                    ))}
                </tr>
            </thead>
            {groups.map(group => (
                <tbody key={group.label}>
                    {/* Bannière AVANT les lignes du mois — même règle que le classeur. */}
                    <tr className="apd-banner-row">
                        <td colSpan={cols.length}>
                            <div className="apd-banner">
                                {monthBannerLabel(group)}
                                <span className="apd-banner-weight">{fmtKg(group.totalWeight)}</span>
                            </div>
                        </td>
                    </tr>

                    {group.rows.map((row, i) => {
                        const state = rowStateOf(row, now)
                        const past  = state === "past"
                        const alt   = i % 2 === 1
                        return (
                            <tr key={row.id} className={past ? "apd-row--past" : undefined}>
                                {cols.map(col => {
                                    const raw   = col.get(row)
                                    const isNum = col.type === "number" && raw !== ""
                                    // Même résolution de fond que le classeur : l'état de la
                                    // ligne l'emporte sur l'emphase de colonne.
                                    const fill = resolveCellFill(state, col.emphasis, alt)
                                    const isDech = col.permKey === "prev_dechargement_at"
                                    return (
                                        <td
                                            key={col.permKey}
                                            className={[
                                                isNum ? "apd-num" : "",
                                                isDech && past ? "apd-past-date" : "",
                                                isDech && state === "scheduled" ? "apd-scheduled-date" : "",
                                            ].filter(Boolean).join(" ") || undefined}
                                            style={{ backgroundColor: hex(fill) }}
                                        >
                                            {isNum ? Number(raw).toLocaleString("fr-FR") : raw}
                                        </td>
                                    )
                                })}
                            </tr>
                        )
                    })}

                    <tr className="apd-total">
                        {cols.map((col, c) => (
                            <td key={col.permKey} className={c === weightColIdx ? "apd-num" : undefined}>
                                {c === 0
                                    ? `↳ Total ${group.label}`
                                    : c === weightColIdx
                                        ? fmtKg(group.totalWeight)
                                        : ""}
                            </td>
                        ))}
                    </tr>
                </tbody>
            ))}
        </table>
    )
}

// ─── Format simple — tableau compact, portrait ────────────────────────────────

/**
 * Huit colonnes, sans le statut. Les deux colonnes de dates que le métier
 * surveille portent la même emphase que dans le classeur Excel : Date facture en
 * rouge, Déchargement en bleu.
 */
const SIMPLE_COLUMNS: { key: string; label: string; width: string; emphasis?: "alert" | "important" }[] = [
    { key: "fournisseur",  label: "Fournisseur",  width: "22%" },
    { key: "facture",      label: "Date facture", width: "11%", emphasis: "alert" },
    { key: "depart",       label: "Départ",       width: "9%" },
    { key: "havre",        label: "Le Havre",     width: "9%" },
    { key: "conteneur",    label: "N° Conteneur", width: "15%" },
    { key: "dechargement", label: "Déchargement", width: "18%", emphasis: "important" },
    { key: "poids",        label: "Poids (kg)",   width: "10%" },
    { key: "qty",          label: "Qté",          width: "6%" },
]

/** Classe de colonne portant la couleur — mêmes emphases que le classeur Excel. */
const colClass = (col: (typeof SIMPLE_COLUMNS)[number]) =>
    col.emphasis ? `apd-col-${col.emphasis}` : undefined

function SimpleTable({ groups, now }: { groups: MonthGroup[]; now: Date }) {
    return (
        <table className="apd-table apd-table--simple">
            <colgroup>
                {SIMPLE_COLUMNS.map(col => (
                    <col key={col.key} style={{ width: col.width }} />
                ))}
            </colgroup>
            <thead>
                <tr>
                    {SIMPLE_COLUMNS.map(col => (
                        <th key={col.key} className={colClass(col)}>{col.label}</th>
                    ))}
                </tr>
            </thead>
            {groups.map(group => (
                <tbody key={group.label}>
                    <tr className="apd-banner-row">
                        <td colSpan={SIMPLE_COLUMNS.length}>
                            <div className="apd-banner">
                                {monthBannerLabel(group)}
                                <span className="apd-banner-weight">{fmtKg(group.totalWeight)}</span>
                            </div>
                        </td>
                    </tr>

                    {group.rows.map((row, i) => {
                        const state = rowStateOf(row, now)
                        const alert = state === "alert"
                        const past  = state === "past"
                        return (
                            <tr
                                key={row.id}
                                className={[
                                    i % 2 === 1 ? "apd-alt" : "",
                                    alert ? "apd-row--alert" : "",
                                    past ? "apd-row--past" : "",
                                    state === "scheduled" ? "apd-row--scheduled" : "",
                                ].filter(Boolean).join(" ")}
                            >
                                <td>{row.fournisseur?.name ?? "—"}</td>
                                <td className="apd-col-alert">
                                    {row.invoice_date
                                        ? fmtShortDate(row.invoice_date)
                                        : <span className="apd-alert-mark">{alert ? "⚠" : "—"}</span>}
                                </td>
                                <td>{fmtShortDate(row.departure_date)}</td>
                                <td>{fmtShortDate(row.port_arrival_date)}</td>
                                <td>{row.container_no ?? row.conteneur_no_raw ?? "—"}</td>
                                <td className={[
                                    "apd-col-important",
                                    past ? "apd-past-date" : "",
                                    state === "scheduled" ? "apd-scheduled-date" : "",
                                ].filter(Boolean).join(" ")}>
                                    {fmtShortDatetime(row.prev_dechargement_at)}
                                </td>
                                <td className="apd-num">{fmtInt(row.total_weight_kg)}</td>
                                <td className="apd-num">{fmtInt(row.total_qty)}</td>
                            </tr>
                        )
                    })}
                </tbody>
            ))}
        </table>
    )
}
