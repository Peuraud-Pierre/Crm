import { useMemo } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { useLiveRef } from "@/shared/hooks/useLiveRef"

/**
 * Tri, groupement par mois et pagination d'un tableau d'expéditions.
 *
 * Extrait du tableau des arrivages du stock principal, qui était le seul à
 * savoir le faire. Les deux modules de stock affichent désormais le même
 * tableau — arrivages d'un côté, arrivages et départs de l'autre — et cet
 * algorithme est ce qui lui donne sa forme : les mois s'enchaînent du plus
 * récent au plus ancien, mais la page ouverte est celle des prochaines
 * expéditions, pas celle du futur le plus lointain.
 *
 * Le module ne fournit qu'une projection de ses lignes (`toItem`) plutôt
 * qu'une brochette d'accesseurs : c'est ce qui garde la signature lisible et
 * empêche d'oublier une date au passage.
 */

export interface MonthPageItem {
    id: string
    /**
     * Date qui situe la ligne dans le temps : elle décide du tri et du mois de
     * rattachement. `null` regroupe la ligne sous « Sans date ».
     */
    referenceAt: string | null
    /**
     * Date d'échéance à venir, s'il y en a une. Seules les lignes qui en ont
     * une dans le futur entrent dans les « prochaines » mises en avant.
     */
    upcomingAt: string | null
    /** Grandeur cumulée en pied de chaque mois. */
    weight: number
}

export interface MonthGroup<T> {
    /** Libellé du mois en minuscules — la capitale vient d'un `capitalize` CSS. */
    month: string
    rows: T[]
    totalWeight: number
}

export interface MonthPages<T> {
    allGroups: MonthGroup<T>[]
    /** Groupes de la page affichée. */
    pageGroups: MonthGroup<T>[]
    currentPage: number
    totalPages: number
    /** Ids des prochaines échéances, mis en avant dans le tableau. */
    upcomingIds: Set<string>
    /** Pages contenant au moins une de ces échéances. */
    flaggedPages: Set<number>
}

interface MonthPagesOptions {
    /** Page choisie par l'utilisateur ; `null` = laisser l'algorithme décider. */
    page: number | null
    monthsPerPage: number
    /** Nombre d'échéances à venir mises en avant. */
    upcomingCount?: number
}

export function useMonthPages<T>(
    rows: readonly T[] | undefined,
    toItem: (row: T) => MonthPageItem,
    { page, monthsPerPage, upcomingCount = 5 }: MonthPagesOptions,
): MonthPages<T> {
    // La projection est réécrite à chaque rendu par les appelants (elle se
    // referme sur leurs constantes de module) : la suivre en dépendance
    // relancerait tri, groupement et pagination à chaque frappe dans un filtre.
    // Le ref en donne toujours la version fraîche sans la faire entrer dans les
    // dépendances — voir `useLiveRef`.
    const toItemRef = useLiveRef(toItem)
    const project = (row: T) => toItemRef.current(row)

    const sorted = useMemo(() => {
        if (!rows) return []
        return [...rows].sort(
            (a, b) => timeOf(project(b).referenceAt) - timeOf(project(a).referenceAt),
        )
    }, [rows])

    const upcomingIds = useMemo(() => {
        const now = Date.now()
        return new Set(
            sorted
                .map(project)
                .filter((item) => item.upcomingAt && new Date(item.upcomingAt).getTime() >= now)
                .sort((a, b) => timeOf(a.upcomingAt) - timeOf(b.upcomingAt))
                .slice(0, upcomingCount)
                .map((item) => item.id),
        )
    }, [sorted, upcomingCount])

    const allGroups = useMemo(() => {
        const map = new Map<string, MonthGroup<T>>()
        for (const row of sorted) {
            const item = project(row)
            const month = item.referenceAt
                ? format(new Date(item.referenceAt), "MMMM yyyy", { locale: fr })
                : "Sans date"
            const group = map.get(month) ?? { month, rows: [], totalWeight: 0 }
            group.rows.push(row)
            group.totalWeight += item.weight
            map.set(month, group)
        }
        return [...map.values()]
    }, [sorted])

    const totalPages = Math.max(1, Math.ceil(allGroups.length / monthsPerPage))

    // Le tri est décroissant, donc les échéances les plus PROCHES sont en fin
    // de liste : ouvrir sur la première page montrerait le futur lointain.
    const defaultPage = useMemo(() => {
        for (let i = 0; i < allGroups.length; i++) {
            if (allGroups[i].rows.some((row) => upcomingIds.has(project(row).id))) {
                return Math.floor(i / monthsPerPage)
            }
        }
        return 0
    }, [allGroups, upcomingIds, monthsPerPage])

    const currentPage = Math.min(page ?? defaultPage, totalPages - 1)

    const flaggedPages = useMemo(() => {
        const set = new Set<number>()
        allGroups.forEach((group, i) => {
            if (group.rows.some((row) => upcomingIds.has(project(row).id))) {
                set.add(Math.floor(i / monthsPerPage))
            }
        })
        return set
    }, [allGroups, upcomingIds, monthsPerPage])

    const pageGroups = allGroups.slice(
        currentPage * monthsPerPage,
        (currentPage + 1) * monthsPerPage,
    )

    return { allGroups, pageGroups, currentPage, totalPages, upcomingIds, flaggedPages }
}

/**
 * Les dates seules (`YYYY-MM-DD`) sont lues à minuit LOCAL et non UTC, pour
 * coïncider avec leur affichage. Une comparaison lexicographique casserait dès
 * qu'on mélange dates seules et horodatages complets — ce qui arrive dès qu'un
 * déchargement prévu est saisi.
 */
function timeOf(value: string | null): number {
    if (!value) return 0
    return new Date(value.length === 10 ? `${value}T00:00` : value).getTime()
}
