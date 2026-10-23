import {
    createContext,
    use,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
    useCallback,
} from "react"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { fetchExportCollaborators } from "@/features/crm/services/analyticsExportService"
import type { PeriodType, WidgetId } from "@/features/crm/types"
import type { Event_creation } from "@/features/crm/types/calendar"
import type { Client } from "@/features/crm/types/client"
export type { WidgetId } from "@/features/crm/types"
import { DEFAULT_WIDGET_CONFIG } from "../types/stats"
export { CHART_COLORS, EVENT_TYPE_LABELS } from "../types/stats"
import {
    normalizeEventType,
    CHART_COLORS,
    EVENT_TYPE_LABELS,
} from "@/features/crm/utils/eventTypes"
export { normalizeEventType }

import { useAnalyticsStats } from "../hooks/CRM_hook/use_stats"
import { useAnalyticsClients } from "../hooks/data/useAnalyticsClients"
import { useLeadBriefs } from "../hooks/data/useLeadBriefs"
import { useProduitRechercheMonthlyStats } from "../hooks/data/useProduitRechercheMonthlyStats"

// ==========================================
// UTILITAIRES DE DATES
// ==========================================
export const getISOWeek = (d: Date) => {
    const date = new Date(d.getTime())
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
    const week1 = new Date(date.getFullYear(), 0, 4)
    return (
        1 +
        Math.round(
            ((date.getTime() - week1.getTime()) / 86400000 -
                3 +
                ((week1.getDay() + 6) % 7)) /
                7
        )
    )
}
export const getISOWeekYear = (d: Date) => {
    const date = new Date(d.getTime())
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
    return date.getFullYear()
}
export const getWeekKey = (d: Date) =>
    `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`
export const getMonthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
export const getQuarterKey = (d: Date) =>
    `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
export const getYearKey = (d: Date) => `${d.getFullYear()}`
export const getDayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
// Clé horaire (granularité du graphe d'évolution en vue « jour »).
export const getHourKey = (d: Date) =>
    `${getDayKey(d)} ${String(d.getHours()).padStart(2, "0")}h`
// Clé de bucket pour une date selon la période sélectionnée (inclut "day").
export const getPeriodKey = (period: string, d: Date): string =>
    period === "day"
        ? getDayKey(d)
        : period === "week"
          ? getWeekKey(d)
          : period === "month"
            ? getMonthKey(d)
            : period === "quarter"
              ? getQuarterKey(d)
              : getYearKey(d)
export const getPreviousPeriodKey = (filter: string, period: string) => {
    if (!filter) return ""
    if (period === "day") {
        const d = new Date(filter)
        if (Number.isNaN(d.getTime())) return ""
        d.setDate(d.getDate() - 1)
        return getDayKey(d)
    }
    if (period === "week") {
        const [y, w] = filter.split("-W").map(Number)
        if (w === 1) return `${y - 1}-W52`
        return `${y}-W${String(w - 1).padStart(2, "0")}`
    }
    if (period === "month") {
        const [y, m] = filter.split("-").map(Number)
        if (m === 1) return `${y - 1}-12`
        return `${y}-${String(m - 1).padStart(2, "0")}`
    }
    if (period === "quarter") {
        const [y, qStr] = filter.split("-Q")
        const q = Number(qStr)
        if (q === 1) return `${Number(y) - 1}-Q4`
        return `${y}-Q${q - 1}`
    }
    return period === "year" ? String(Number(filter) - 1) : ""
}

// Produits et styles recherchés d'un brief, normalisés (1re lettre en
// majuscule, reste en minuscules), chacun une seule fois par brief.
// - Produits : la carte « Produits Recherchés » de la fiche
//   (colonneBrief.tsx) écrit dans `vendDeja` ({ nom, ... }) ; `recherche`,
//   vide sur les fiches actuelles, est lu en complément pour les anciennes.
// - Styles : « Style recherché » écrit dans `besoinsFemme` (chaînes) ;
//   `besoinsHomme` est l'ancien champ, lu en complément.
// Le brief peut arriver doublement encodé en JSON : on le re-parse jusqu'à
// obtenir un objet.
const extractProduitsRecherches = (brief: unknown): string[] => {
    let parsed = brief
    let attempts = 0
    while (typeof parsed === "string" && attempts < 3) {
        try {
            parsed = JSON.parse(parsed)
        } catch {
            break
        }
        attempts++
    }
    const fiche = parsed as Record<string, unknown> | null
    const noms = new Set<string>()
    const add = (value: unknown) => {
        const raw = typeof value === "string" ? value.trim() : ""
        if (raw)
            noms.add(raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase())
    }
    ;[fiche?.vendDeja, fiche?.recherche].forEach((list) => {
        if (!Array.isArray(list)) return
        list.forEach((entry: { nom?: unknown } | null) => add(entry?.nom))
    })
    ;[fiche?.besoinsFemme, fiche?.besoinsHomme].forEach((list) => {
        if (!Array.isArray(list)) return
        list.forEach(add)
    })
    return Array.from(noms)
}
// Décompte des produits/styles d'une liste de briefs : chaque client compte
// une fois par produit ou style. Les clients sans aucun des deux ne sont pas
// dans le classement : ils sont comptés à part (`sansProduit`), pour que les
// pourcentages ne portent que sur ce qui est renseigné.
const countProduitsFromBriefs = (briefs: unknown[]) => {
    const map = new Map<string, number>()
    let sansProduit = 0
    briefs.forEach((brief) => {
        const produits = extractProduitsRecherches(brief)
        if (produits.length === 0) {
            sansProduit++
            return
        }
        produits.forEach((nom) => map.set(nom, (map.get(nom) || 0) + 1))
    })
    return { map, sansProduit }
}
// Incrémente une série numérique dynamique d'un « bag » (bucket d'évolution ou
// ligne par personne) dont les valeurs connues peuvent aussi être des chaînes.
const bumpSeries = (
    bag: Record<string, number | string | undefined>,
    key: string,
    by = 1
) => {
    const cur = bag[key]
    bag[key] = (typeof cur === "number" ? cur : 0) + by
}

// Répartition MUTUELLEMENT EXCLUSIVE (achat % + decouverte % + visio % =
// 100 % du total) : tout RDV visio (achat ou découverte) tombe dans la
// catégorie « visio », achat/decouverte ne comptent que le physique.
export const classifyRdvType = (nom: string | undefined | null) => {
    const type = normalizeEventType(nom)
    const visio = type.includes("visio")
    return {
        achat: !visio && type.includes("achat"),
        decouverte: !visio && type.includes("decouverte"),
        visio,
    }
}

export const getPeriodRange = (
    period: PeriodType,
    filter: string | null
): { start: Date; end: Date } | null => {
    if (!filter) return null
    if (period === "day") {
        const [y, m, d] = filter.split("-").map(Number)
        if (!y || !m || !d) return null
        return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1) }
    }
    if (period === "week") {
        const [y, w] = filter.split("-W").map(Number)
        if (!y || !w) return null
        const simple = new Date(y, 0, 1 + (w - 1) * 7)
        const dow = simple.getDay()
        const start = new Date(simple)
        if (dow <= 4) start.setDate(simple.getDate() - dow + 1)
        else start.setDate(simple.getDate() + 8 - dow)
        const end = new Date(start)
        end.setDate(start.getDate() + 7)
        return { start, end }
    }
    if (period === "month") {
        const [y, m] = filter.split("-").map(Number)
        if (!y || !m) return null
        return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) }
    }
    if (period === "quarter") {
        const [y, q] = filter.split("-Q").map(Number)
        if (!y || !q) return null
        return {
            start: new Date(y, (q - 1) * 3, 1),
            end: new Date(y, q * 3, 1),
        }
    }
    if (period === "year") {
        const y = Number(filter)
        if (!y) return null
        return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) }
    }
    return null
}

// ==========================================
// CREATION DU CONTEXTE
// ==========================================
export interface StatRow {
    userId: string
    name: string
    activiteTotal: number
    nbMessage: number
    nbAppel: number
    nbMail: number
    /** Activités dont le titre porte « qualification » (même comptage par
     *  mot-clé que nbAppel/nbMessage/nbMail ci-dessus). */
    nbQualification: number
    rdv: number
    /** Nombre de bons proforma (devis) créés par le collaborateur. */
    nbProforma: number
    /** Chiffre d'affaires (somme des totalHT des bons proforma). */
    ca: number
}
export interface StatsExportData {
    period: PeriodType
    filter: string | null
    hasPrev: boolean
    /**
     * "collaborators" : une ligne par collaborateur (séparées par des barres).
     * "daily" : un seul collaborateur sélectionné → une ligne par jour de la
     * période (séquence continue, tendance vs jour précédent).
     */
    mode: "collaborators" | "daily"
    global: StatRow
    perCollaborator: StatRow[]
    globalPrev: StatRow
    perCollaboratorPrev: StatRow[]
}
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

// Couleur de la barre de séparation après un groupe de collaborateurs.
export type ExportSepColor = "black" | "red"
// Un groupe de collaborateurs dans l'export Excel (ordre = colonnes du tableau).
export interface ExportGroup {
    ids: string[]
    sepAfter?: ExportSepColor
}

// ==========================================
// TYPES DOMAINE (formes hétérogènes manipulées dynamiquement)
// ==========================================
// Élément générique (event / devis / activité / client) dont on extrait
// l'identifiant et le nom du collaborateur via des champs optionnels variés.
interface CommercialItem {
    id?: string
    user_id?: string | null
    creator_id?: string | null
    created_by?: string | null
    owner_id?: string | null
    owner?: string | { user_id?: string | null; id?: string | null } | null
    by?: string | null
    customer?: {
        user_id?: string | null
        id?: string | null
        full_name?: string | null
    } | null
    profiles?: {
        user_id?: string | null
        id?: string | null
        full_name?: string | null
    } | null
}

// Forme d'un événement/RDV agrégé. `Event_creation` (jointures CRM) plus les
// champs legacy/alternatifs consultés dynamiquement à l'agrégation.
type AnalyticsEvent = Event_creation & {
    created_by?: string | null
    source?: string | null
    src?: string | null
    user_id?: string | null
    owner_id?: string | null
    by?: string | null
    profiles?: {
        user_id?: string | null
        id?: string | null
        full_name?: string | null
    } | null
}

// Utilisateur tel que renvoyé par la recherche (search) du CRM.
interface SearchUser {
    user_id?: string | null
    id?: string | null
    name?: string | null
    full_name?: string | null
    display_name?: string | null
}

// Ligne d'un graphe d'évolution. `timestamp`/`displayDate` sont des métadonnées
// fixes ; toutes les autres clés sont des séries numériques (un total par
// collaborateur/type d'événement) accumulées dynamiquement.
interface EvolutionBucket {
    timestamp: number
    displayDate?: string
    // Séries dynamiques (revenue, Total, noms de collaborateurs, types…).
    [series: string]: number | string | undefined
}

// Données agrégées par personne (RDV ou activités) : nom + séries numériques
// dynamiques (un total par type).
interface PersonRow {
    name: string
    // Séries dynamiques (total + un compteur par type).
    [series: string]: number | string
}

// Données d'évolution du chiffre d'affaires.
interface RevenueEvolution {
    data: EvolutionBucket[]
    creators: string[]
    totals: Record<string, number>
}

// Données d'évolution des RDV.
interface RdvEvolution {
    data: EvolutionBucket[]
    eventTypes: string[]
    totals: Record<string, number>
}

// Répartition des RDV par personne.
interface RdvByPerson {
    data: PersonRow[]
    eventTypes: string[]
    totals: Record<string, number>
}

// Présents / absents (show / no-show).
interface ShowNoShow {
    data: { name: string; value: number; color: string }[]
    total: number
    shows: number
    noShows: number
    pending: number
    showRate: number
    noShowRate: number
}

// Activités regroupées par type.
interface ActivitesByType {
    data: { name: string; count: number }[]
    total: number
}

// Répartition des RDV par type (camembert).
interface RdvByType {
    data: { name: string; value: number; color: string }[]
    total: number
}

// Activités regroupées par propriétaire (séries dynamiques par type).
interface ActivitesByOwner {
    data: PersonRow[]
    types: string[]
    totals: Record<string, number>
}

// Provenance des clients.
interface ProvenanceData {
    data: { name: string; count: number }[]
    total: number
}

// Classement des produits et styles recherchés des leads entrants.
// total = mentions ; leads = clients analysés ; sansProduit = leads sans
// produit ni style, hors classement (null en vue globale, calculée depuis
// les snapshots).
interface ProduitRechercheRankingData {
    data: { name: string; count: number }[]
    total: number
    leads: number | null
    sansProduit: number | null
}

// Évolution mensuelle des produits recherchés (un point par mois stocké,
// une série par produit parmi les plus recherchés + une série Total).
interface ProduitRechercheEvolution {
    data: EvolutionBucket[]
    products: string[]
    totals: Record<string, number>
}

// Statistiques d'un membre sur la période.
interface MemberStats {
    userName: string
    rdvCount: number
    actCount: number
    completedTasksCount: number
}

// Indicateurs clés de performance (KPIs).
interface AnalyticsKPIs {
    totalRevenue: number
    totalDevis: number
    totalLeads: number
    totalRdv: number
    revenueChange: number | null
    devisChange: number | null
    leadsChange: number | null
    rdvChange: number | null
}

// Plage de dates personnalisée (sélection libre "du ... au ..."), en
// alternative au filtre par bucket (jour/semaine/mois/...). `end` est exclusif
// (même convention que getPeriodRange : lendemain minuit du dernier jour choisi).
export interface CustomDateRange {
    start: Date
    end: Date
}

interface AnalyticsContextType {
    selectedPeriod: PeriodType
    setSelectedPeriod: (v: PeriodType) => void
    selectedFilter: string | null
    setSelectedFilter: (v: string | null) => void
    customRange: CustomDateRange | null
    setCustomRange: (v: CustomDateRange | null) => void
    selectedCommercial: string
    setSelectedCommercial: (v: string) => void
    // false pour les rôles non privilégiés (verrouillés sur leurs propres
    // stats) ; true pour Super Admin / Manager qui voient tout le monde.
    canSelectCommercial: boolean
    widgets: typeof DEFAULT_WIDGET_CONFIG
    toggleWidget: (id: WidgetId) => void
    isWidgetsLoaded: boolean
    hiddenEventLines: string[]
    toggleEventLine: (name: string) => void
    hiddenProduitRechercheLines: string[]
    toggleProduitRechercheLine: (name: string) => void
    crmUsers: { id: string; name: string }[]
    availableFilters: string[]
    memberStats: MemberStats | null
    KPIs: AnalyticsKPIs
    revenueEvolutionData: RevenueEvolution
    rdvEvolutionData: RdvEvolution
    rdvByPersonData: RdvByPerson
    showNoShowData: ShowNoShow
    activitesByTypeData: ActivitesByType
    rdvByTypeData: RdvByType
    activitesByOwnerData: ActivitesByOwner
    provenanceData: ProvenanceData
    produitsRechercheRankingData: ProduitRechercheRankingData
    produitsRechercheEvolutionData: ProduitRechercheEvolution
    filteredClients: Client[]
    filteredEvents: AnalyticsEvent[]
    totalClients: number
    pipelineColumnCounts: Record<number, number> | null
    fetchEventstats: () => Promise<AnalyticsEvent[]>
    getStatsExportData: () => StatsExportData
    getRdvTypeExportData: () => RdvTypeExportData
    exportGroups: ExportGroup[]
    exportFallbackNames: Record<string, string>
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(
    undefined
)

export function AnalyticsProvider({ children }: { children: ReactNode }) {
    // Jeu de clients dédié (cache TanStack), indépendant du `clients[]` paginé
    // du Kanban.
    const { clients } = useAnalyticsClients()
    const {
        search,
        events, // Conservé pour les fallback potentiels
        Devis,
        activites,
        fetch_research,
    } = useCRMContext()

    const { user } = useAuth()

    // Snapshots mensuels stockés (crm_produit_recherche_monthly_stats),
    // agrégés par produit sur la période sélectionnée plus bas.
    const { data: produitRechercheMonthlyStats } =
        useProduitRechercheMonthlyStats()

    // Clé du bucket courant (aujourd'hui) pour une période donnée. Sert à
    // (ré)initialiser le filtre quand la période change.
    const currentPeriodKey = (period: PeriodType): string => {
        const today = new Date()
        if (period === "day") return getDayKey(today)
        if (period === "week") return getWeekKey(today)
        if (period === "month") return getMonthKey(today)
        if (period === "quarter") return getQuarterKey(today)
        return getYearKey(today)
    }

    const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("month")
    // Initialisation paresseuse sur le bucket courant de la période par défaut.
    const [selectedFilter, setSelectedFilter] = useState<string | null>(() =>
        currentPeriodKey("month")
    )
    const [selectedCommercial, setSelectedCommercial] = useState<string>("all")
    // Plage personnalisée active : prend le pas sur selectedPeriod/selectedFilter
    // pour tout ce qui filtre par date (KPIs, graphes, exports).
    const [customRange, setCustomRange] = useState<CustomDateRange | null>(
        null
    )

    // Contrôle d'accès à la sélection « collaborateur » : seuls les Super Admin
    // et les Manager peuvent consulter les stats de tous les collaborateurs.
    // Les autres rôles restent verrouillés sur leurs propres données.
    const roleSlug = (user?.role ?? "").toLowerCase().replace(/\s+/g, "")
    const canSelectCommercial =
        roleSlug === "superadmin" || roleSlug === "manager"

    // Pour un collaborateur non privilégié, on force la sélection sur lui-même
    // dès que son identité est connue (au lieu du « all » par défaut).
    useEffect(() => {
        if (!canSelectCommercial && user?.user_id) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- resync sur une donnée externe asynchrone (identité utilisateur arrivant après le montage) : non exprimable en valeur dérivée sans réécrire les ~15 lectures de selectedCommercial
            setSelectedCommercial((prev) =>
                prev === user.user_id ? prev : user.user_id!
            )
        }
    }, [canSelectCommercial, user?.user_id])

    // Setter public : garde-fou en plus du verrou UI — un rôle non privilégié
    // ne peut pas changer de collaborateur.
    const handleSetSelectedCommercial = useCallback(
        (v: string) => {
            if (!canSelectCommercial) return
            setSelectedCommercial(v)
        },
        [canSelectCommercial]
    )

    // Change la période ET recale le filtre sur le bucket courant, dans le même
    // handler (évite un setState dérivé dans un useEffect — la sémantique reste
    // identique : changer de période réinitialise le filtre sur la période en cours).
    const changeSelectedPeriod = useCallback((period: PeriodType) => {
        setSelectedPeriod(period)
        setSelectedFilter(currentPeriodKey(period))
        setCustomRange(null)
    }, [])

    const changeSelectedFilter = useCallback((v: string | null) => {
        setSelectedFilter(v)
        setCustomRange(null)
    }, [])

    const [widgets, setWidgets] = useState(DEFAULT_WIDGET_CONFIG)
    // La config des widgets est synchrone (constante) : disponible dès le 1er rendu.
    const isWidgetsLoaded = true
    const [hiddenEventLines, setHiddenEventLines] = useState<string[]>([])
    const [hiddenProduitRechercheLines, setHiddenProduitRechercheLines] =
        useState<string[]>([])

    // Config de l'export Excel (ordre/regroupements/noms de repli) chargée
    // depuis la table analytics_export_collaborators.
    const [exportGroups, setExportGroups] = useState<ExportGroup[]>([])
    const [exportFallbackNames, setExportFallbackNames] = useState<
        Record<string, string>
    >({})

    // ==========================================
    // PREPARATION DES DONNEES POUR LE HOOK DE STATS
    // ==========================================
    const userId = selectedCommercial === "all" ? null : selectedCommercial
    // Plage active : la sélection personnalisée prend le pas sur le bucket
    // jour/semaine/mois/... quand elle est renseignée.
    const range = customRange ?? getPeriodRange(selectedPeriod, selectedFilter)
    // Comparatif "période précédente" : fenêtre de même durée immédiatement
    // avant la plage personnalisée, ou bucket précédent en mode normal.
    const prevKey = getPreviousPeriodKey(selectedFilter || "", selectedPeriod)
    const customPrevRange: CustomDateRange | null = customRange
        ? {
              start: new Date(
                  customRange.start.getTime() -
                      (customRange.end.getTime() - customRange.start.getTime())
              ),
              end: customRange.start,
          }
        : null
    const prevRange = customPrevRange ?? getPeriodRange(selectedPeriod, prevKey)

    // Prédicat unique "cette date fait-elle partie de la sélection courante ?" —
    // en mode plage personnalisée : appartenance réelle à [range.start, range.end[.
    // En mode bucket : équivalent à l'ancien `key === selectedFilter` (ou true
    // en vue globale, sans filtre).
    const inSelectedRange = useCallback(
        (dateStr: string | null | undefined): boolean => {
            if (!dateStr) return false
            const d = new Date(dateStr)
            if (Number.isNaN(d.getTime())) return false
            if (customRange) return d >= customRange.start && d < customRange.end
            if (!selectedFilter) return true
            return getPeriodKey(selectedPeriod, d) === selectedFilter
        },
        [customRange, selectedFilter, selectedPeriod]
    )
    // Même prédicat pour la période précédente (comparatif de tendance).
    const inPrevSelectedRange = useCallback(
        (dateStr: string | null | undefined): boolean => {
            if (!dateStr) return false
            const d = new Date(dateStr)
            if (Number.isNaN(d.getTime())) return false
            if (customPrevRange)
                return d >= customPrevRange.start && d < customPrevRange.end
            if (!prevKey) return false
            return getPeriodKey(selectedPeriod, d) === prevKey
        },
        [customPrevRange, prevKey, selectedPeriod]
    )

    // Produit 'YYYY-MM-DD 00:00:00' (UTC) pour correspondre exactement au format
    // du SQL : created_at >= '2026-06-02 00:00:00' AND created_at < '2026-06-03 00:00:00'
    const toUTCMidnightISO = (d: Date) => {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, "0")
        const day = String(d.getDate()).padStart(2, "0")
        return `${y}-${m}-${day} 00:00:00`
    }

    const rangeStart = range?.start ? toUTCMidnightISO(range.start) : null
    const rangeEnd = range?.end ? toUTCMidnightISO(range.end) : null
    const prevRangeStart = prevRange?.start ? toUTCMidnightISO(prevRange.start) : null
    const prevRangeEnd = prevRange?.end ? toUTCMidnightISO(prevRange.end) : null

    // APPEL DU HOOK CENTRALISÉ
    const { eventsStats, rpcClientStats, pipelineColumnCounts, fetchEventstats } =
        useAnalyticsStats(
            userId,
            rangeStart,
            rangeEnd,
            prevRangeStart,
            prevRangeEnd,
            selectedCommercial
        )

    // ==========================================
    // EFFETS ET ACTIONS
    // ==========================================
    useEffect(() => {
        if (user?.user_id) fetch_research()
        // user?.user_id (primitif) et non l'objet `user` : ce dernier change de
        // référence à chaque event auth (refresh de token) et refait alors un
        // scan complet de client_crm pour rien.
    }, [user?.user_id, fetch_research])

    const toggleEventLine = (name: string) =>
        setHiddenEventLines((prev) =>
            prev.includes(name)
                ? prev.filter((l) => l !== name)
                : [...prev, name]
        )

    const toggleProduitRechercheLine = (name: string) =>
        setHiddenProduitRechercheLines((prev) =>
            prev.includes(name)
                ? prev.filter((l) => l !== name)
                : [...prev, name]
        )
    const toggleWidget = (id: WidgetId) =>
        setWidgets((prev) => ({
            ...prev,
            [id]: { ...prev[id], visible: !prev[id].visible },
        }))

    const crmUsers = useMemo(() => {
        if (!search || !Array.isArray(search)) return []
        const uniqueUsers = new Map<string, string>()
        search.forEach((u: SearchUser) => {
            const uId = u.user_id || u.id
            if (!uId) return
            const name = u.full_name || u.name || u.display_name
            if (name && !uniqueUsers.has(uId)) {
                uniqueUsers.set(uId, name)
            }
        })
        return Array.from(uniqueUsers.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [search])

    // Charge la config d'export depuis Supabase et la transforme en groupes
    // ordonnés + map de noms de repli (remplace les ex-constantes en dur).
    const fetchExportGroups = useCallback(async () => {
        const { data, error } = await fetchExportCollaborators()
        if (error) {
            console.error("❌ Erreur fetch export collaborators:", error)
            return
        }
        const groups: ExportGroup[] = []
        const names: Record<string, string> = {}
        const byGroup = new Map<number, ExportGroup>()
        ;(data || []).forEach((row) => {
            if (!row.user_id) return
            if (row.fallback_name) names[row.user_id] = row.fallback_name
            let g = byGroup.get(row.group_index)
            if (!g) {
                g = { ids: [] }
                byGroup.set(row.group_index, g)
                groups.push(g)
            }
            g.ids.push(row.user_id)
            if (row.sep_after === "black" || row.sep_after === "red") {
                g.sepAfter = row.sep_after
            }
        })
        setExportGroups(groups)
        setExportFallbackNames(names)
    }, [])

    useEffect(() => {
        fetchExportGroups()
    }, [fetchExportGroups])

    const getCommercialId = useCallback((item: CommercialItem | null) => {
        if (!item) return "unassigned"
        if (item.customer)
            return item.customer.user_id || item.customer.id || "unassigned"
        return (
            item.by ||
            item.profiles?.user_id ||
            item.profiles?.id ||
            item.user_id ||
            item.owner_id ||
            (typeof item.owner === "object"
                ? item.owner?.user_id || item.owner?.id
                : item.owner) ||
            item.created_by ||
            "unassigned"
        )
    }, [])

    const getCommercialName = useCallback(
        (item: CommercialItem) => {
            if (item.creator_id || item.created_by) {
                const creatorId = item.creator_id || item.created_by
                const found = search?.find(
                    (u: SearchUser) =>
                        u.user_id === creatorId || u.id === creatorId
                )
                if (found) return found.name || "Créateur inconnu"
            }

            if (item.profiles?.full_name) return item.profiles.full_name
            if (item.customer?.full_name) return item.customer.full_name
            const targetId = getCommercialId(item)
            const found = search?.find(
                (u: SearchUser) =>
                    u.user_id === targetId || u.id === targetId
            )
            return found?.name || "Non assigné"
        },
        [search, getCommercialId]
    )

    // Id du SETTER assigné à un RDV (colonne `customer`), pas le créateur de
    // l'événement : comme `isStatsEligible` n'accepte que les RDV créés par les
    // comptes centraux, `creator_id` est toujours un central → le vrai
    // commercial est le setter. Repli sur le créateur si pas de `customer`.
    const getEventSetterId = useCallback(
        (evt: AnalyticsEvent): string | null => {
            const custRaw = (evt as unknown as { customer?: unknown }).customer
            const setterId =
                typeof custRaw === "string"
                    ? custRaw
                    : (custRaw as { user_id?: string; id?: string } | null)
                          ?.user_id ||
                      (custRaw as { id?: string } | null)?.id ||
                      evt.creator_id ||
                      evt.created_by
            return setterId || null
        },
        []
    )

    // Nom du SETTER assigné à un RDV (colonne `customer`), pas le créateur de
    // l'événement (souvent un compte central commun). Utilisé pour que les RDV
    // ressortent sous le bon commercial dans les stats/widgets.
    const getEventSetterName = useCallback(
        (evt: AnalyticsEvent) => {
            const setterId = getEventSetterId(evt)
            if (!setterId) return "Non assigné"
            const found = search?.find(
                (u: SearchUser) =>
                    u.user_id === setterId || u.id === setterId
            )
            return found?.name || "Non assigné"
        },
        [search, getEventSetterId]
    )

    const isStandardMatch = useCallback(
        (item: CommercialItem) => {
            if (selectedCommercial === "all") return true
            return getCommercialId(item) === selectedCommercial
        },
        [selectedCommercial, getCommercialId]
    )

    const filteredEvents = useMemo(() => eventsStats, [eventsStats])

    const filteredDevis = useMemo(
        () => (Devis || []).filter(isStandardMatch),
        [Devis, isStandardMatch]
    )
    const filteredActivites = useMemo(
        () => (activites || []).filter(isStandardMatch),
        [activites, isStandardMatch]
    )
    const filteredClients = useMemo(
        () => (clients || []).filter(isStandardMatch),
        [clients, isStandardMatch]
    )

    // Total dynamique calculé à l'aide de l'état renvoyé par le hook (ou fallback mémoire)
    const totalClients = rpcClientStats?.total ?? filteredClients.length

    const memberStats = useMemo(() => {
        if (selectedCommercial === "all") return null
        const countInPeriod = <T,>(
            list: T[],
            dateField: string,
            condition?: (item: T) => boolean
        ) =>
            list.filter((item) => {
                if (condition && !condition(item)) return false
                const rec = item as Record<string, unknown>
                const dateStr = (rec[dateField] ||
                    rec.created_at ||
                    rec.Date_crea ||
                    rec.date ||
                    rec.debut) as string | null | undefined
                if (!dateStr || (!selectedFilter && !customRange)) return true
                return inSelectedRange(dateStr)
            }).length

        return {
            userName:
                crmUsers.find((u) => u.id === selectedCommercial)?.name ||
                "Collaborateur",
            // Prise de RDV = qui a effectivement pris le rendez-vous
            // (creator_id), pas le setter auquel il est assigné (customer) :
            // filteredEvents n'était pas scopé du tout par commercial, donc
            // sans ce filtre rdvCount comptait les RDV de TOUT LE MONDE sur la
            // période — pas seulement ceux pris par le collaborateur sélectionné.
            rdvCount: countInPeriod(
                filteredEvents,
                "created_at",
                (evt) => evt.creator_id === selectedCommercial
            ),
            actCount: countInPeriod(filteredActivites, "created_at"),
            completedTasksCount: countInPeriod(
                filteredActivites,
                "created_at",
                (act) => act.title === "Tâche terminée"
            ),
        }
    }, [
        selectedCommercial,
        filteredEvents,
        filteredActivites,
        selectedFilter,
        customRange,
        inSelectedRange,
        crmUsers,
    ])

    const availableFilters = useMemo(() => {
        const rawKeys: string[] = []
        const addKey = (dStr: string | null | undefined) => {
            if (!dStr) return
            const d = new Date(dStr)
            if (selectedPeriod === "day") rawKeys.push(getDayKey(d))
            else if (selectedPeriod === "week") rawKeys.push(getWeekKey(d))
            else if (selectedPeriod === "month") rawKeys.push(getMonthKey(d))
            else if (selectedPeriod === "quarter")
                rawKeys.push(getQuarterKey(d))
            else if (selectedPeriod === "year") rawKeys.push(getYearKey(d))
        }
        ;(Devis || []).forEach((d) => addKey(d.Date_crea))
        events?.forEach((e) => addKey(e.created_at || e.created_at || e.debut))
        activites?.forEach((a) => addKey(a.created_at ?? a.date))
        filteredClients?.forEach((c) => addKey(c.created_at))
        // Jamais de bucket futur dans la liste : un événement déjà planifié
        // (ex. RDV avec `debut` dans le mois prochain) ne doit pas faire
        // apparaître une période qu'on ne peut pas encore avoir "vécue".
        // Comparaison lexicographique valide ici : toutes les clés d'un même
        // `selectedPeriod` partagent le même format zéro-paddé (YYYY-Www,
        // YYYY-MM, YYYY-Qn, YYYY-MM-DD, YYYY), donc l'ordre alphabétique
        // suit l'ordre chronologique.
        const current = currentPeriodKey(selectedPeriod)
        return Array.from(new Set(rawKeys))
            .filter((k) => k <= current)
            .sort()
            .reverse()
    }, [Devis, events, activites, filteredClients, selectedPeriod])

    const getEvolutionBuckets = (dates: Date[]) => {
        const map = new Map<string, EvolutionBucket>()

        if (customRange || !selectedFilter) {
            // Bornes de la plage à couvrir : la plage personnalisée si active,
            // sinon l'étendue min/max des données fournies (vue globale).
            let minT: number
            let maxT: number
            if (customRange) {
                minT = customRange.start.getTime()
                // `end` exclusif : dernière journée réellement couverte.
                maxT = customRange.end.getTime() - 86_400_000
            } else {
                minT = Infinity
                maxT = -Infinity
                for (const d of dates) {
                    const t = d.getTime()
                    if (Number.isNaN(t)) continue
                    if (t < minT) minT = t
                    if (t > maxT) maxT = t
                }
            }
            if (minT === Infinity) return { skeleton: map, keyOf: getMonthKey }
            const spanDays = (maxT - minT) / 86_400_000

            if (spanDays <= 62) {
                const cursor = new Date(minT)
                cursor.setHours(0, 0, 0, 0)
                const end = new Date(maxT)
                end.setHours(0, 0, 0, 0)
                while (cursor <= end) {
                    const d = new Date(cursor)
                    map.set(getDayKey(d), {
                        timestamp: d.getTime(),
                        displayDate: d.toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                        }),
                    })
                    cursor.setDate(cursor.getDate() + 1)
                }
                return { skeleton: map, keyOf: getDayKey }
            }

            if (spanDays <= 1100) {
                const cursor = new Date(minT)
                cursor.setDate(1)
                cursor.setHours(0, 0, 0, 0)
                const last = new Date(maxT)
                const end = new Date(last.getFullYear(), last.getMonth(), 1)
                while (cursor <= end) {
                    const d = new Date(cursor)
                    map.set(getMonthKey(d), {
                        timestamp: d.getTime(),
                        displayDate: d.toLocaleDateString("fr-FR", {
                            month: "short",
                            year: "2-digit",
                        }),
                    })
                    cursor.setMonth(cursor.getMonth() + 1)
                }
                return { skeleton: map, keyOf: getMonthKey }
            }

            const startY = new Date(minT).getFullYear()
            const endY = new Date(maxT).getFullYear()
            for (let y = startY; y <= endY; y++) {
                const d = new Date(y, 0, 1)
                map.set(getYearKey(d), {
                    timestamp: d.getTime(),
                    displayDate: String(y),
                })
            }
            return { skeleton: map, keyOf: getYearKey }
        }

        const keyOf =
            selectedPeriod === "day"
                ? getHourKey
                : selectedPeriod === "week" || selectedPeriod === "month"
                  ? getDayKey
                  : getMonthKey
        const target = selectedFilter
        if (selectedPeriod === "day") {
            const [y, m, d] = target.split("-").map(Number)
            for (let h = 0; h < 24; h++) {
                const dt = new Date(y, m - 1, d, h)
                map.set(getHourKey(dt), {
                    timestamp: dt.getTime(),
                    displayDate: `${String(h).padStart(2, "0")}h`,
                })
            }
        } else if (selectedPeriod === "week") {
            const [y, w] = target.split("-W").map(Number)
            const simple = new Date(y, 0, 1 + (w - 1) * 7)
            simple.setDate(simple.getDate() - ((simple.getDay() + 6) % 7))
            for (let i = 0; i < 7; i++) {
                const d = new Date(simple)
                d.setDate(d.getDate() + i)
                map.set(getDayKey(d), {
                    timestamp: d.getTime(),
                    displayDate: d.toLocaleDateString("fr-FR", {
                        weekday: "short",
                        day: "2-digit",
                    }),
                })
            }
        } else if (selectedPeriod === "month") {
            const [year, month] = target.split("-").map(Number)
            const daysInMonth = new Date(year, month, 0).getDate()
            for (let i = 1; i <= daysInMonth; i++) {
                const d = new Date(year, month - 1, i)
                map.set(getDayKey(d), {
                    timestamp: d.getTime(),
                    displayDate: d.toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                    }),
                })
            }
        } else {
            const isYear = selectedPeriod === "year"
            const [y] = target.split("-")
            for (let i = 0; i < (isYear ? 12 : 3); i++) {
                const mIdx = isYear
                    ? i
                    : (Number(target.split("-Q")[1]) - 1) * 3 + i
                const d = new Date(Number(y), mIdx, 1)
                map.set(getMonthKey(d), {
                    timestamp: d.getTime(),
                    displayDate: d.toLocaleDateString("fr-FR", {
                        month: "short",
                    }),
                })
            }
        }
        return { skeleton: map, keyOf }
    }

    const revenueEvolutionData = useMemo(() => {
        const { skeleton, keyOf } = getEvolutionBuckets(
            filteredDevis
                .map((d) => (d.Date_crea ? new Date(d.Date_crea) : null))
                .filter((d): d is Date => d !== null)
        )
        const creatorsSet = new Set<string>()
        const totals: Record<string, number> = { revenue: 0 }
        for (const [, v] of skeleton.entries()) v.revenue = 0
        filteredDevis.forEach((d) => {
            if (!d.Date_crea) return
            const date = new Date(d.Date_crea)
            const key = keyOf(date)
            const current = skeleton.get(key)
            if (current) {
                const amount = d.totalHT || 0
                bumpSeries(current, "revenue", amount)
                totals.revenue += amount
                const creator = getCommercialName(d)
                creatorsSet.add(creator)
                bumpSeries(current, creator, amount)
                totals[creator] = (totals[creator] || 0) + amount
            }
        })
        const data = Array.from(skeleton.values())
            .map((v) => {
                creatorsSet.forEach((c) => {
                    if (v[c] === undefined) v[c] = 0
                })
                return v
            })
            .sort((a, b) => a.timestamp - b.timestamp)
        return { data, creators: Array.from(creatorsSet), totals }
    }, [filteredDevis, selectedPeriod, selectedFilter, customRange, getCommercialName])

    const rdvEvolutionData = useMemo(() => {
        const { skeleton, keyOf } = getEvolutionBuckets(
            filteredEvents
                .map((e) => {
                    const src = e.created_at || e.debut
                    return src ? new Date(src) : null
                })
                .filter((d): d is Date => d !== null)
        )
        const typesSet = new Set<string>()
        const totals: Record<string, number> = { Total: 0 }
        filteredEvents.forEach((e) => typesSet.add(normalizeEventType(e.nom)))
        const allTypes = Array.from(typesSet)
        for (const v of skeleton.values()) {
            v.Total = 0
            allTypes.forEach((t) => (v[t] = 0))
        }
        filteredEvents.forEach((evt) => {
            const dateSource = evt.created_at || evt.debut
            if (!dateSource) return

            const date = new Date(dateSource)
            const key = keyOf(date)
            const current = skeleton.get(key)
            if (current) {
                const type = normalizeEventType(evt.nom)
                bumpSeries(current, "Total")
                bumpSeries(current, type)
                totals.Total += 1
                totals[type] = (totals[type] || 0) + 1
            }
        })
        return {
            data: Array.from(skeleton.values()).sort(
                (a, b) => a.timestamp - b.timestamp
            ),
            eventTypes: allTypes,
            totals,
        }
    }, [filteredEvents, selectedPeriod, selectedFilter, customRange])

    const rdvByPersonData = useMemo(() => {
        const map = new Map<string, PersonRow>()
        const typesSet = new Set<string>()
        const totals: Record<string, number> = {}
        filteredEvents.forEach((evt) => {
            const dateSource = evt.created_at || evt.debut
            if (!inSelectedRange(dateSource)) return

            const setterName = getEventSetterName(evt)
            if (!map.has(setterName))
                map.set(setterName, { name: setterName, total: 0 })
            const current = map.get(setterName)!
            bumpSeries(current, "total")

            // Répartition mutuellement exclusive achat/decouverte/visio
            // (même classification que l'export RDV par type), plutôt que
            // les 4 types bruts (qui séparaient achat/decouverte physique
            // de leurs pendants visio).
            const { achat, decouverte, visio } = classifyRdvType(evt.nom)
            const bumpType = (type: string) => {
                typesSet.add(type)
                bumpSeries(current, type)
                totals[type] = (totals[type] || 0) + 1
            }
            if (achat) bumpType("achat")
            if (decouverte) bumpType("decouverte")
            if (visio) bumpType("visio")
        })
        return {
            data: Array.from(map.values()).sort(
                (a, b) => Number(b.total) - Number(a.total)
            ),
            eventTypes: Array.from(typesSet),
            totals,
        }
    }, [filteredEvents, getEventSetterName, inSelectedRange])

    const showNoShowData = useMemo(() => {
        let shows = 0,
            noShows = 0,
            pending = 0
        filteredEvents.forEach((evt) => {
            const dateSource = evt.created_at || evt.debut
            const nomLower = (evt.nom || "").trim().toLowerCase()
            if (
                nomLower === "non disponible" ||
                nomLower === "indisponible" ||
                !inSelectedRange(dateSource) ||
                // Prise de RDV = creator_id (qui a pris le RDV), cohérent avec
                // rdvCount. Sans ce filtre, le présence/absence d'un commercial
                // sélectionné mélangeait les RDV de tout le monde.
                (selectedCommercial !== "all" &&
                    evt.creator_id !== selectedCommercial)
            )
                return

            if (evt.show === true) shows++
            else if (evt.show === false) noShows++
            else pending++
        })
        const markedTotal = shows + noShows
        const total = markedTotal + pending
        const data = [
            { name: "Présents", value: shows, color: "hsl(var(--success))" },
            { name: "Absents", value: noShows, color: "hsl(var(--destructive))" },
            ...(pending > 0
                ? [{ name: "Non renseigné", value: pending, color: "hsl(var(--muted-foreground))" }]
                : []),
        ]
        return {
            data: total > 0 ? data : [],
            total,
            shows,
            noShows,
            pending,
            showRate: markedTotal > 0 ? Math.round((shows / markedTotal) * 100) : 0,
            noShowRate: markedTotal > 0 ? Math.round((noShows / markedTotal) * 100) : 0,
        }
    }, [filteredEvents, inSelectedRange, selectedCommercial])

    const activitesByTypeData = useMemo(() => {
        const map = new Map<string, number>()
        filteredActivites.forEach((act) => {
            if (!inSelectedRange(act.created_at ?? act.date)) return
            const actType =
                (act.title || "Action").charAt(0).toUpperCase() +
                (act.title || "Action").slice(1)
            map.set(actType, (map.get(actType) || 0) + 1)
        })
        const data = Array.from(map.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
        return { data, total: data.reduce((acc, curr) => acc + curr.count, 0) }
    }, [filteredActivites, inSelectedRange])

    const rdvByTypeData = useMemo(() => {
        const map = new Map<string, number>()
        filteredEvents.forEach((evt) => {
            if (!inSelectedRange(evt.created_at || evt.debut)) return
            const type = normalizeEventType(evt.nom)
            map.set(type, (map.get(type) || 0) + 1)
        })
        const data = Array.from(map.entries())
            .map(([type, value], i) => ({
                name: EVENT_TYPE_LABELS[type] || type,
                value,
                color: CHART_COLORS[i % CHART_COLORS.length],
            }))
            .sort((a, b) => b.value - a.value)
        return { data, total: data.reduce((acc, curr) => acc + curr.value, 0) }
    }, [filteredEvents, inSelectedRange])

    const activitesByOwnerData = useMemo(() => {
        const map = new Map<string, PersonRow>()
        const typesSet = new Set<string>()
        const totals: Record<string, number> = {}
        if (!filteredActivites || filteredActivites.length === 0)
            return { data: [], types: [], totals: {} }
        filteredActivites.forEach((act) => {
            if (!inSelectedRange(act.created_at ?? act.date)) return
            const ownerName = getCommercialName(act as CommercialItem)
            const typeLabel =
                (act.title || "Action").charAt(0).toUpperCase() +
                (act.title || "Action").slice(1)
            typesSet.add(typeLabel)
            if (!map.has(ownerName))
                map.set(ownerName, { name: ownerName, total: 0 })
            const current = map.get(ownerName)!
            bumpSeries(current, "total")
            bumpSeries(current, typeLabel)
            totals[typeLabel] = (totals[typeLabel] || 0) + 1
        })
        return {
            data: Array.from(map.values()).sort(
                (a, b) => Number(b.total) - Number(a.total)
            ),
            types: Array.from(typesSet),
            totals,
        }
    }, [filteredActivites, getCommercialName, inSelectedRange])

    const provenanceData = useMemo(() => {
        const map = new Map<string, number>()
        let total = 0
        filteredClients.forEach((client) => {
            const dateStr = client.created_at
            if (dateStr && (selectedFilter || customRange) && !inSelectedRange(dateStr))
                return
            let provenance = "Non renseigné"
            if (client.brief) {
                let parsedData = client.brief
                let attempts = 0
                while (typeof parsedData === "string" && attempts < 3) {
                    try {
                        parsedData = JSON.parse(parsedData)
                    } catch {
                        break
                    }
                    attempts++
                }
                if (
                    parsedData &&
                    typeof parsedData === "object" &&
                    parsedData.provenance
                ) {
                    provenance = String(parsedData.provenance).trim()
                }
            }
            if (!provenance || provenance === "") provenance = "Non renseigné"
            const cleanProv =
                provenance.charAt(0).toUpperCase() +
                provenance.slice(1).toLowerCase()
            map.set(cleanProv, (map.get(cleanProv) || 0) + 1)
            total++
        })
        return {
            data: Array.from(map.entries())
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count),
            total,
        }
    }, [filteredClients, selectedFilter, customRange, inSelectedRange])

    // Clé du mois en cours, au format des snapshots stockés ("YYYY-MM-01").
    const currentMonthKey = (() => {
        const now = new Date()
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
    })()

    // Produits recherchés des leads entrants : clients créés sur la période,
    // avec le même périmètre que le KPI « Leads » (count_clients_filtered).
    const leadBriefs = useLeadBriefs(rangeStart, rangeEnd, userId)

    // Mois en cours pour le graphique d'évolution (non snapshoté) : requête
    // dédiée, indépendante de la période sélectionnée. Bornes au même format
    // que rangeStart/rangeEnd.
    const currentMonthStart = toUTCMidnightISO(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    )
    const currentMonthEnd = toUTCMidnightISO(
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    )
    const currentMonthLeadBriefs = useLeadBriefs(
        currentMonthStart,
        currentMonthEnd,
        userId
    )
    const liveProduitRechercheByProduct = useMemo(
        () => countProduitsFromBriefs(currentMonthLeadBriefs).map,
        [currentMonthLeadBriefs]
    )

    // Classement des produits recherchés sur la période sélectionnée, depuis
    // les leads entrants. En vue globale (sans bornes) on retombe sur les
    // snapshots stockés (crm_produit_recherche_monthly_stats), qui ne
    // connaissent pas le nombre de leads.
    const produitsRechercheRankingData = useMemo(() => {
        let map: Map<string, number>
        let leads: number | null
        let sansProduit: number | null
        if (rangeEnd) {
            const counted = countProduitsFromBriefs(leadBriefs)
            map = counted.map
            sansProduit = counted.sansProduit
            leads = leadBriefs.length
        } else {
            map = new Map<string, number>()
            produitRechercheMonthlyStats.forEach((row) => {
                map.set(row.product, (map.get(row.product) || 0) + row.total)
            })
            leads = null
            sansProduit = null
        }
        let total = 0
        map.forEach((count) => {
            total += count
        })
        return {
            data: Array.from(map.entries())
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count),
            total,
            leads,
            sansProduit,
        }
    }, [leadBriefs, produitRechercheMonthlyStats, rangeEnd])

    // Évolution mensuelle des produits recherchés, un point par mois stocké
    // dans crm_produit_recherche_monthly_stats — contrairement à
    // getEvolutionBuckets, qui découpe en jours pour un filtre "Mois", ce
    // qui n'aurait pas de sens ici (la donnée source est déjà mensuelle).
    const produitsRechercheEvolutionData = useMemo(() => {
        const MAX_LINES = 5

        // Année ciblée : celle de la plage perso, sinon celle du filtre
        // sélectionné (les clés day/week/month/quarter/year commencent
        // toutes par "YYYY"), sinon l'année en cours. Le sous-découpage
        // jour/semaine/mois du sélecteur de période est ignoré ici : ce
        // widget montre toujours les 12 mois de l'année ciblée.
        const targetYear = customRange
            ? customRange.start.getFullYear()
            : selectedFilter
              ? Number(selectedFilter.slice(0, 4))
              : new Date().getFullYear()

        // Mois clos de l'année ciblée : snapshot stocké. Le mois en cours
        // est exclu ici et réinjecté plus bas depuis
        // liveProduitRechercheByProduct (voir produitsRechercheRankingData
        // ci-dessus pour le pourquoi).
        const rows = produitRechercheMonthlyStats.filter(
            (row) =>
                Number(row.month.slice(0, 4)) === targetYear &&
                row.month !== currentMonthKey
        )
        const currentMonthInTargetYear =
            Number(currentMonthKey.slice(0, 4)) === targetYear

        const totalsByProduct = new Map<string, number>()
        rows.forEach((row) => {
            totalsByProduct.set(
                row.product,
                (totalsByProduct.get(row.product) || 0) + row.total
            )
        })
        if (currentMonthInTargetYear) {
            liveProduitRechercheByProduct.forEach((count, product) => {
                totalsByProduct.set(
                    product,
                    (totalsByProduct.get(product) || 0) + count
                )
            })
        }
        const topProducts = Array.from(totalsByProduct.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, MAX_LINES)
            .map(([name]) => name)

        // Squelette des 12 mois de l'année ciblée, y compris ceux sans
        // snapshot stocké (comptent 0) — pour toujours voir l'année
        // complète, pas seulement les mois où la table a des lignes.
        // Parsing manuel en heure locale (pas new Date(row.month)) :
        // "2026-09-01" est interprété en UTC par le moteur JS, puis
        // reformaté en heure locale — sur un fuseau derrière UTC, ça fait
        // basculer la date au jour/mois précédent (même classe de bug que
        // eventForm.test.ts "fix fuseau").
        const skeleton = new Map<string, EvolutionBucket>()
        for (let m = 0; m < 12; m++) {
            const d = new Date(targetYear, m, 1)
            const key = `${targetYear}-${String(m + 1).padStart(2, "0")}-01`
            const monthName = d.toLocaleDateString("fr-FR", { month: "long" })
            skeleton.set(key, {
                timestamp: d.getTime(),
                displayDate:
                    monthName.charAt(0).toUpperCase() + monthName.slice(1),
                Total: 0,
            })
        }

        const totals: Record<string, number> = { Total: 0 }
        rows.forEach((row) => {
            const bucket = skeleton.get(row.month)
            if (!bucket) return
            bumpSeries(bucket, "Total", row.total)
            totals.Total = (totals.Total || 0) + row.total
            if (topProducts.includes(row.product)) {
                bumpSeries(bucket, row.product, row.total)
                totals[row.product] = (totals[row.product] || 0) + row.total
            }
        })
        if (currentMonthInTargetYear) {
            const currentBucket = skeleton.get(currentMonthKey)
            if (currentBucket) {
                liveProduitRechercheByProduct.forEach((count, product) => {
                        bumpSeries(currentBucket, "Total", count)
                    totals.Total = (totals.Total || 0) + count
                    if (topProducts.includes(product)) {
                        bumpSeries(currentBucket, product, count)
                        totals[product] = (totals[product] || 0) + count
                    }
                })
            }
        }

        return {
            data: Array.from(skeleton.values()).sort(
                (a, b) => a.timestamp - b.timestamp
            ),
            products: topProducts,
            totals,
        }
    }, [
        produitRechercheMonthlyStats,
        liveProduitRechercheByProduct,
        currentMonthKey,
        selectedFilter,
        customRange,
    ])

    const KPIs = useMemo(() => {
        let cur = 0,
            prev = 0,
            curCount = 0,
            prevCount = 0,
            curLeads = 0,
            prevLeads = 0,
            curRdv = 0,
            prevRdv = 0

        filteredDevis.forEach((d) => {
            if (inSelectedRange(d.Date_crea)) {
                cur += d.totalHT || 0
                curCount++
            } else if (inPrevSelectedRange(d.Date_crea)) {
                prev += d.totalHT || 0
                prevCount++
            }
        })

        filteredClients.forEach((c) => {
            if (inSelectedRange(c.created_at)) {
                curLeads++
            } else if (inPrevSelectedRange(c.created_at)) {
                prevLeads++
            }
        })

        filteredEvents.forEach((e) => {
            const dateStr = e.created_at || e.debut
            if (inSelectedRange(dateStr)) {
                curRdv++
            } else if (inPrevSelectedRange(dateStr)) {
                prevRdv++
            }
        })

        const leadsCur = rpcClientStats?.leadsCurrent ?? curLeads
        const leadsPrev = rpcClientStats?.leadsPrevious ?? prevLeads

        return {
            totalRevenue: cur,
            totalDevis: curCount,
            totalLeads: leadsCur,
            totalRdv: curRdv,
            revenueChange: prev === 0 ? null : ((cur - prev) / prev) * 100,
            devisChange:
                prevCount === 0
                    ? null
                    : ((curCount - prevCount) / prevCount) * 100,
            leadsChange:
                leadsPrev === 0
                    ? null
                    : ((leadsCur - leadsPrev) / leadsPrev) * 100,
            rdvChange:
                prevRdv === 0 ? null : ((curRdv - prevRdv) / prevRdv) * 100,
        }
    }, [
        rpcClientStats,
        filteredDevis,
        filteredClients,
        filteredEvents,
        inSelectedRange,
        inPrevSelectedRange,
    ])

    // Données d'export (tableur) : métriques globales + par collaborateur sur la
    // période courante. Indépendant du filtre « collaborateur » de l'écran : on
    // ventile toujours sur tous les collaborateurs.
    const getStatsExportData = useCallback((): StatsExportData => {
        const empty = (userId: string, name: string): StatRow => ({
            userId,
            name,
            activiteTotal: 0,
            nbMessage: 0,
            nbAppel: 0,
            nbMail: 0,
            nbQualification: 0,
            rdv: 0,
            nbProforma: 0,
            ca: 0,
        })

        const reduceGlobal = (rows: StatRow[]): StatRow =>
            rows.reduce(
                (acc, r) => ({
                    userId: "GLOBAL",
                    name: "GLOBAL",
                    activiteTotal: acc.activiteTotal + r.activiteTotal,
                    nbMessage: acc.nbMessage + r.nbMessage,
                    nbAppel: acc.nbAppel + r.nbAppel,
                    nbMail: acc.nbMail + r.nbMail,
                    nbQualification: acc.nbQualification + r.nbQualification,
                    rdv: acc.rdv + r.rdv,
                    nbProforma: acc.nbProforma + r.nbProforma,
                    ca: acc.ca + r.ca,
                }),
                empty("GLOBAL", "GLOBAL")
            )

        // === MODE « UN SEUL COLLABORATEUR » : ventilation JOUR PAR JOUR ===
        // Quand un commercial unique est sélectionné, on ne sort QUE ses stats,
        // découpées par jour sur la période (séquence continue), avec tendance
        // calculée vs le jour précédent. Attribution : RDV par SETTER (champ
        // `customer`, car le créateur est toujours un compte central),
        // activités/devis par getCommercialId.
        if (selectedCommercial !== "all") {
            const cid = selectedCommercial
            // `range` (plage active : personnalisée ou bucket) vient du scope
            // du provider — reste cohérent avec KPIs/graphes/RPC. Peut être
            // `null` en vue globale (aucun filtre posé) : tout est alors inclus.
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
            const dayRows = new Map<string, StatRow>()
            const ensureDay = (key: string) => {
                let r = dayRows.get(key)
                if (!r) {
                    r = empty(key, labelOf(key))
                    dayRows.set(key, r)
                }
                return r
            }
            // Pré-remplit tous les jours de la plage → séquence « à la suite »
            // sans trous (jours sans activité = ligne à 0). Rien à pré-remplir
            // en vue globale (pas de bornes).
            if (range) {
                for (
                    const t = new Date(range.start);
                    t < range.end;
                    t.setDate(t.getDate() + 1)
                )
                    ensureDay(getDayKey(t))
            }
            ;(eventsStats || []).forEach((evt) => {
                const e = evt as AnalyticsEvent
                // RDV attribués au setter (customer) : on ne garde que ceux du
                // commercial sélectionné, même créés sous un compte central.
                if (getEventSetterId(e) !== cid) return
                const key = dayKeyIfValid(e.created_at)
                if (key) ensureDay(key).rdv += 1
            })
            ;(activites || []).forEach((a) => {
                if (getCommercialId(a as CommercialItem) !== cid) return
                const key = dayKeyIfValid(a.created_at ?? a.date)
                if (!key) return
                const r = ensureDay(key)
                r.activiteTotal += 1
                const t = (a.title || "").toLowerCase()
                if (t.includes("appel")) r.nbAppel += 1
                if (t.includes("message")) r.nbMessage += 1
                if (t.includes("mail")) r.nbMail += 1
                if (t.includes("qualification")) r.nbQualification += 1
            })
            ;(Devis || []).forEach((d) => {
                if (getCommercialId(d as CommercialItem) !== cid) return
                const key = dayKeyIfValid(d.Date_crea)
                if (!key) return
                const r = ensureDay(key)
                r.nbProforma += 1
                r.ca += d.totalHT || 0
            })
            // Tri chronologique (clé YYYY-MM-DD = tri lexicographique).
            const days = Array.from(dayRows.keys()).sort()
            const perDay = days.map((k) => dayRows.get(k)!)
            // Tendance = jour précédent dans la séquence ; on clé le « prev » sur
            // le jour COURANT pour que l'export retrouve le bon comparatif.
            const perDayPrev: StatRow[] = days.map((k, i) =>
                i > 0
                    ? { ...dayRows.get(days[i - 1])!, userId: k }
                    : empty(k, "")
            )
            return {
                period: selectedPeriod,
                filter: selectedFilter,
                hasPrev: perDay.length > 1,
                mode: "daily",
                global: reduceGlobal(perDay),
                perCollaborator: perDay,
                globalPrev: reduceGlobal(perDayPrev),
                perCollaboratorPrev: perDayPrev,
            }
        }

        // Agrège events (RDV) + activités sur les lignes retenues par `matches`.
        const aggregate = (matches: (d?: string | null) => boolean) => {
            const byCollab = new Map<string, StatRow>()
            const bucketByIdName = (id: string, name: string) => {
                let r = byCollab.get(id)
                if (!r) {
                    r = empty(id, name)
                    byCollab.set(id, r)
                }
                return r
            }
            const bucket = (item: CommercialItem) =>
                bucketByIdName(getCommercialId(item), getCommercialName(item))

            // Source = eventsStats (sortie de use_stats), déjà filtré EXACTEMENT
            // comme les stats : source crm + créateurs autorisés, exclusion
            // week-end/jours fériés sur created_at, suppression des doublons et
            // des « indisponible ». On compte ainsi les RDV pris « de la même
            // manière » que use_stats, en ventilant par période sur created_at.
            ;(eventsStats || []).forEach((evt) => {
                const e = evt as AnalyticsEvent
                if (!matches(e.created_at)) return
                // RDV ventilés par CRÉATEUR (qui a créé le RDV), à la date de
                // création : même clé que use_stats (dédup par creator_id), donc
                // « le RDV créé à la date et par qui ».
                const creatorId = e.creator_id || e.created_by
                if (!creatorId) return
                // Libellé = setter réel (champ `customer`), pas le compte
                // central créateur, pour que le RDV ressorte sous le commercial
                // direct. La clé de ventilation reste `creatorId` (chiffres
                // inchangés) ; on ne change que le nom affiché.
                const setterName = getEventSetterName(e)
                const displayName =
                    setterName !== "Non assigné"
                        ? setterName
                        : getCommercialName(e as unknown as CommercialItem)
                bucketByIdName(creatorId, displayName).rdv += 1
            })
            ;(activites || []).forEach((a) => {
                if (!matches(a.created_at ?? a.date)) return
                const r = bucket(a as CommercialItem)
                r.activiteTotal += 1
                const t = (a.title || "").toLowerCase()
                if (t.includes("appel")) r.nbAppel += 1
                if (t.includes("message")) r.nbMessage += 1
                if (t.includes("mail")) r.nbMail += 1
                if (t.includes("qualification")) r.nbQualification += 1
            })
            // Bons proforma (devis) ventilés par créateur, à leur date de
            // création : nombre + CA (totalHT, même base que revenueEvolution).
            ;(Devis || []).forEach((d) => {
                if (!matches(d.Date_crea)) return
                const r = bucket(d as CommercialItem)
                r.nbProforma += 1
                r.ca += d.totalHT || 0
            })
            return byCollab
        }

        // Courant / précédent : mêmes prédicats que KPIs/graphes (bucket ou
        // plage personnalisée), pour que l'export reste cohérent avec l'écran.
        const cur = aggregate(inSelectedRange)
        const hasPrev = !!selectedFilter || !!customRange
        const prev = hasPrev
            ? aggregate(inPrevSelectedRange)
            : new Map<string, StatRow>()

        const perCollaborator = Array.from(cur.values()).sort(
            (a, b) => b.activiteTotal - a.activiteTotal
        )
        const perCollaboratorPrev = Array.from(prev.values())

        return {
            period: selectedPeriod,
            filter: selectedFilter,
            hasPrev,
            mode: "collaborators",
            global: reduceGlobal(perCollaborator),
            perCollaborator,
            globalPrev: reduceGlobal(perCollaboratorPrev),
            perCollaboratorPrev,
        }
    }, [
        eventsStats,
        activites,
        Devis,
        search,
        range,
        customRange,
        inSelectedRange,
        inPrevSelectedRange,
        getCommercialName,
        getCommercialId,
        getEventSetterName,
        getEventSetterId,
        selectedPeriod,
        selectedFilter,
        selectedCommercial,
    ])

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
            // `range` peut être `null` en vue globale (aucun filtre posé) :
            // tout est alors inclus.
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
                    const t = new Date(range.start);
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
                // Ventilé par SETTER réel (champ `customer`), pas par
                // créateur (compte central partagé) : contrairement à
                // getStatsExportData, on veut une ligne par commercial
                // individuel dans cet export.
                const setterId = getEventSetterId(e)
                if (!setterId) return
                const setterName = getEventSetterName(e)
                const displayName =
                    setterName !== "Non assigné"
                        ? setterName
                        : getCommercialName(e as unknown as CommercialItem)
                bumpType(bucketByIdName(setterId, displayName), e.nom)
            })
            return byCollab
        }

        const cur = aggregate(inSelectedRange)
        const hasPrev = !!selectedFilter || !!customRange
        const prev = hasPrev
            ? aggregate(inPrevSelectedRange)
            : new Map<string, RdvTypeRow>()

        const perCollaborator = Array.from(cur.values()).sort(
            (a, b) => b.total - a.total
        )
        const perCollaboratorPrev = Array.from(prev.values())

        return {
            period: selectedPeriod,
            filter: selectedFilter,
            hasPrev,
            mode: "collaborators",
            perCollaborator,
            perCollaboratorPrev,
        }
    }, [
        eventsStats,
        range,
        customRange,
        inSelectedRange,
        inPrevSelectedRange,
        getCommercialName,
        getEventSetterName,
        getEventSetterId,
        selectedPeriod,
        selectedFilter,
        selectedCommercial,
    ])

    return (
        <AnalyticsContext
            value={{
                selectedPeriod,
                setSelectedPeriod: changeSelectedPeriod,
                selectedFilter,
                setSelectedFilter: changeSelectedFilter,
                customRange,
                setCustomRange,
                selectedCommercial,
                setSelectedCommercial: handleSetSelectedCommercial,
                canSelectCommercial,
                widgets,
                toggleWidget,
                isWidgetsLoaded,
                hiddenEventLines,
                toggleEventLine,
                hiddenProduitRechercheLines,
                toggleProduitRechercheLine,
                crmUsers,
                availableFilters,
                memberStats,
                KPIs,
                revenueEvolutionData,
                rdvEvolutionData,
                rdvByPersonData,
                showNoShowData,
                activitesByTypeData,
                rdvByTypeData,
                activitesByOwnerData,
                provenanceData,
                produitsRechercheRankingData,
                produitsRechercheEvolutionData,
                filteredClients,
                filteredEvents,
                totalClients,
                pipelineColumnCounts,
                fetchEventstats,
                getStatsExportData,
                getRdvTypeExportData,
                exportGroups,
                exportFallbackNames,
            }}
        >
            {children}
        </AnalyticsContext>
    )
}

export const useAnalytics = () => {
    const context = use(AnalyticsContext)
    if (!context)
        throw new Error(
            "useAnalytics doit être utilisé dans un AnalyticsProvider"
        )
    return context
}
