import { format } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import { fr } from "date-fns/locale"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import { referenceArrivageManuel } from "@/features/stock/types/arrivage-manuel.types"

/**
 * Le métier est au Havre : l'heure de référence du tableau est celle de Paris,
 * pas celle du navigateur du lecteur. C'est aussi ce que force le générateur de
 * la newsletter (`parisTZ`, newsletter-console/internal/excel/generator.go) —
 * sans quoi un même arrivage s'afficherait à deux heures différentes selon que
 * la personne exporte elle-même ou reçoit l'e-mail.
 */
export const ARRIVAGE_TZ = "Europe/Paris"

/** Date-seule (`YYYY-MM-DD`) → une date n'a pas de fuseau, on la laisse telle quelle. */
function isDateOnly(d: string): boolean {
    return d.length === 10
}

// ─── Formatage ────────────────────────────────────────────────────────────────

export function fmtDate(d: string | null | undefined): string {
    if (!d) return ""
    try {
        // date-only strings (YYYY-MM-DD) must be parsed as local midnight, not UTC
        const date = d.length === 10 ? new Date(d + "T00:00") : new Date(d)
        return format(date, "dd/MM/yy")
    } catch { return d }
}

export function fmtDatetime(d: string | null | undefined): string {
    if (!d) return ""
    try {
        const jour = formatInTimeZone(new Date(d), ARRIVAGE_TZ, "EEEE", { locale: fr })
        const reste = formatInTimeZone(new Date(d), ARRIVAGE_TZ, "dd/MM/yy · HH:mm")
        // Le générateur Go capitalise le jour ("Lundi 09/06/26 · 14:30").
        return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} ${reste}`
    } catch { return d }
}

/**
 * Jour calendaire parisien d'une valeur, en `YYYY-MM-DD`. Comparer deux clés de
 * ce format revient à comparer deux journées — sans arithmétique de décalage, et
 * sans dépendre du fuseau du navigateur.
 */
export function parisDayKey(d: string): string {
    if (isDateOnly(d)) return d
    try {
        return formatInTimeZone(new Date(d), ARRIVAGE_TZ, "yyyy-MM-dd")
    } catch { return d.slice(0, 10) }
}

// ─── Date de référence ────────────────────────────────────────────────────────

/**
 * Timestamp de la date de référence d'une ligne (déchargement → Le Havre →
 * départ, avec `created_at` en dernier recours). Retourne 0 si aucune date.
 *
 * Les dates seules (`YYYY-MM-DD`) sont lues à **minuit local**, comme `fmtDate` :
 * `new Date("2026-09-01")` vaut minuit UTC, ce qui range la ligne dans le mois
 * précédent en fuseau négatif alors que le tri, lui, raisonne en local. Bucket et
 * tri divergeaient sur les 1ers du mois — d'où ce point d'entrée unique.
 */
export function referenceTimestamp(row: ArrivageManuelRow): number {
    const ref = anchorDate(row)
    if (!ref) return 0
    const t = new Date(isDateOnly(ref) ? ref + "T00:00" : ref).getTime()
    return Number.isNaN(t) ? 0 : t
}

/**
 * Date sous laquelle une ligne est classée : sa date de référence (déchargement
 * → Le Havre → départ), ou à défaut sa date de création.
 *
 * Un arrivage sans aucune date planifiée doit rester visible parmi les autres,
 * intercalé à sa date de création — c'est ce que fait le tableau à l'écran.
 * L'export les regroupait dans un bloc « Sans date » épinglé en bas du fichier,
 * où plus personne ne les voyait.
 */
export function anchorDate(row: ArrivageManuelRow): string | null {
    return referenceArrivageManuel(row) ?? row.created_at ?? null
}

/** Comparateur canonique du tableau des arrivages : plus récent d'abord. */
export function compareByReferenceDesc(a: ArrivageManuelRow, b: ArrivageManuelRow): number {
    return referenceTimestamp(b) - referenceTimestamp(a)
}

/**
 * Un arrivage est « passé » quand sa date de référence est antérieure au début
 * de la journée courante — un arrivage prévu aujourd'hui reste donc à venir.
 * `now` est injectable pour que les tests ne dépendent pas de la date réelle.
 */
export function isArrivagePast(row: ArrivageManuelRow, now: Date = new Date()): boolean {
    // Sans aucune date planifiée, l'arrivage est indéterminé — pas « passé ».
    // (`referenceTimestamp` retombe sur `created_at`, qui ne dit rien de l'arrivée.)
    const ref = referenceArrivageManuel(row)
    if (!ref) return false
    return parisDayKey(ref) < parisDayKey(now.toISOString())
}

/**
 * Arrivage « en route » : une date de déchargement est fixée et elle n'est pas
 * encore passée. C'est le signal le plus fort du tableau — le créneau de
 * déchargement est réservé, l'arrivage arrive vraiment.
 */
export function isArrivageScheduled(row: ArrivageManuelRow, now: Date = new Date()): boolean {
    if (!row.prev_dechargement_at) return false
    return parisDayKey(row.prev_dechargement_at) >= parisDayKey(now.toISOString())
}

// ─── Groupement par mois ──────────────────────────────────────────────────────

const SANS_DATE_LABEL = "Sans date"

export interface MonthGroup {
    /** "Juin 2026" | "Sans date" */
    label:       string
    rows:        ArrivageManuelRow[]
    totalWeight: number
    /**
     * Lignes du bloc portant une vraie date d'arrivage. Une ligne classée sur sa
     * seule date de création n'en fait pas partie : son échéance est inconnue,
     * elle n'est ni à venir ni passée.
     */
    datedCount: number
    /** Parmi les lignes datées, celles dont le déchargement n'est pas passé. */
    upcomingCount: number
}

/**
 * Regroupe les lignes par mois (ordre décroissant — plus récent en premier). La
 * clé de mois vient de `anchorDate`, donc de la date de création pour une ligne
 * sans date d'arrivage : elle reste ainsi intercalée parmi les autres, comme
 * dans le tableau à l'écran, au lieu d'être reléguée en fin de fichier.
 *
 * Les lignes de chaque bloc sont triées par date d'ancrage décroissante : sans
 * ça elles restaient dans l'ordre de la requête (`created_at DESC`) et modifier
 * une date de déchargement changeait le mois d'une ligne sans jamais changer sa
 * position dans le bloc.
 *
 * Le bloc "Sans date" ne subsiste que par sécurité : `created_at` est toujours
 * renseigné, donc en pratique aucune ligne n'y tombe.
 */
export function groupByMonth(rows: ArrivageManuelRow[], now: Date = new Date()): MonthGroup[] {
    const map = new Map<string, { rows: ArrivageManuelRow[]; ts: number; totalWeight: number }>()

    for (const row of rows) {
        const ref = anchorDate(row)
        let key: string
        let ts: number

        if (!ref) {
            key = SANS_DATE_LABEL
            ts = 0
        } else {
            // Le mois est celui du calendrier parisien, comme l'heure affichée.
            const [y, m] = parisDayKey(ref).split("-").map(Number)
            const d = new Date(y, m - 1, 1)
            const raw = format(d, "MMMM yyyy", { locale: fr })
            key = raw.charAt(0).toUpperCase() + raw.slice(1)
            ts = d.getTime()
        }

        const g = map.get(key) ?? { rows: [], ts, totalWeight: 0 }
        g.rows.push(row)
        g.totalWeight += row.total_weight_kg ?? 0
        map.set(key, g)
    }

    return Array.from(map.entries())
        .sort(([, a], [, b]) => b.ts - a.ts)
        .map(([label, { rows: groupRows, totalWeight }]) => {
            const sorted = [...groupRows].sort(compareByReferenceDesc)
            const dated  = sorted.filter(r => referenceArrivageManuel(r) !== null)
            return {
                label,
                rows: sorted,
                totalWeight,
                datedCount:    dated.length,
                upcomingCount: dated.filter(r => !isArrivagePast(r, now)).length,
            }
        })
}

/**
 * Libellé d'ouverture d'un bloc de mois : "SEPTEMBRE 2026 · 7 arrivages · 3 à venir".
 * Écrit AVANT les lignes du groupe — un libellé posé sous ses lignes se lit
 * comme l'en-tête du bloc suivant. Le suffixe donne l'info la plus attendue à
 * l'ouverture du fichier : ce qui arrive encore.
 */
export function monthBannerLabel(group: MonthGroup): string {
    const n = group.rows.length
    const base = `${group.label.toUpperCase()} · ${n} arrivage${n > 1 ? "s" : ""}`
    // Sans une seule ligne datée, le bloc n'a pas d'échéance à annoncer : il est
    // classé sur des dates de création, qui ne disent rien de l'arrivée.
    if (group.label === SANS_DATE_LABEL || group.datedCount === 0) return base
    if (group.upcomingCount === 0) return `${base} · passé${n > 1 ? "s" : ""}`
    return `${base} · ${group.upcomingCount} à venir`
}

// ─── Filtre par période ───────────────────────────────────────────────────────

/**
 * Filtre sur la date d'ancrage, bornes incluses (from à 00:00, to à 23:59).
 *
 * Une ligne sans date d'arrivage est filtrée sur sa date de création, le même
 * ancrage que le groupement : l'exclure la ferait disparaître d'un export sur
 * période alors qu'elle figure dans l'export complet.
 */
export function filterArrivagesByRange(
    rows: ArrivageManuelRow[],
    from: Date,
    to: Date
): ArrivageManuelRow[] {
    const start = new Date(from)
    const end   = new Date(to)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

    return rows.filter(r => {
        const ts = referenceTimestamp(r)
        if (ts === 0) return false
        return ts >= start.getTime() && ts <= end.getTime()
    })
}
