// Portage serveur du calcul des stats CRM exportées (digest newsletter).
//
// Reproduit, pour la vue « tous les collaborateurs » (selectedCommercial =
// "all"), ce que fait le navigateur via :
//   - src/features/crm/context/AnalyticsContext.tsx (getStatsExportData,
//     getCommercialId/Name, getEventSetterId/Name, helpers de dates),
//   - src/features/crm/hooks/CRM_hook/use_stats.tsx (fetchEventstats, voie RPC),
//   - src/features/crm/utils/calendarConstants.ts (isFerieOrWeekend),
//   - les services Supabase appelés par CRMContext (activités, devis, search).
// Toute évolution de ces règles doit être reportée ici.
//
// Fuseau : le navigateur calcule en heure locale (Europe/Paris) alors que le
// runtime Edge tourne en UTC. On manipule donc des dates « murales » : des
// `Date` dont les champs UTC valent l'heure de Paris, lus via getUTC*().
import type { SupabaseClient } from "@supabase/supabase-js"

export type Period = "week" | "day"

export interface StatRow {
    userId: string
    name: string
    activiteTotal: number
    nbMessage: number
    nbAppel: number
    nbMail: number
    nbQualification: number
    rdv: number
    nbProforma: number
    ca: number
}

// Copie de src/features/crm/components/Analytics/Widget/EventsPalier.tsx.
export const TARGET_IDS = new Set([
    "8f93efc7-a3fb-496b-a397-781ae3fc41cf",
    "921e5a2d-1447-4f4c-b893-2f935a996973",
    "2c2312cb-1cf3-4c6a-a4c6-c0a363eb9ade",
])

// Copie de use_stats.tsx.
const STATS_ALLOWED_CREATORS = new Set([
    "2c2312cb-1cf3-4c6a-a4c6-c0a363eb9ade",
    "8f93efc7-a3fb-496b-a397-781ae3fc41cf",
    "921e5a2d-1447-4f4c-b893-2f935a996973", // Bastien
    "e8b399a9-61bd-4ee4-b9fe-8334019201e1", // adam
])

// ==========================================
// HEURE DE PARIS
// ==========================================
const parisFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
})

/** Instant réel → date murale de Paris. */
export function toWall(instant: Date): Date {
    const p: Record<string, string> = {}
    for (const part of parisFmt.formatToParts(instant)) p[part.type] = part.value
    return new Date(
        Date.UTC(
            Number(p.year),
            Number(p.month) - 1,
            Number(p.day),
            Number(p.hour),
            Number(p.minute),
            Number(p.second),
            instant.getUTCMilliseconds()
        )
    )
}

/** Date murale de Paris → instant réel (équivalent d'un `new Date(y, m, d)` navigateur). */
function wallToInstant(wall: Date): Date {
    let t = wall.getTime()
    for (let i = 0; i < 2; i++) {
        const offset = toWall(new Date(t)).getTime() - t
        t = wall.getTime() - offset
    }
    return new Date(t)
}

const pad2 = (n: number) => String(n).padStart(2, "0")

// ==========================================
// UTILITAIRES DE DATES (dates murales)
// ==========================================
export const getISOWeek = (d: Date) => {
    const date = new Date(d.getTime())
    date.setUTCHours(0, 0, 0, 0)
    date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7))
    const week1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
    return (
        1 +
        Math.round(
            ((date.getTime() - week1.getTime()) / 86400000 -
                3 +
                ((week1.getUTCDay() + 6) % 7)) /
                7
        )
    )
}
const getISOWeekYear = (d: Date) => {
    const date = new Date(d.getTime())
    date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7))
    return date.getUTCFullYear()
}
const getWeekKey = (d: Date) =>
    `${getISOWeekYear(d)}-W${pad2(getISOWeek(d))}`
const getDayKey = (d: Date) =>
    `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
const getPeriodKey = (period: Period, d: Date) =>
    period === "day" ? getDayKey(d) : getWeekKey(d)

const getPreviousPeriodKey = (filter: string, period: Period) => {
    if (period === "day") {
        const d = new Date(`${filter}T00:00:00Z`)
        d.setUTCDate(d.getUTCDate() - 1)
        return getDayKey(d)
    }
    const [y, w] = filter.split("-W").map(Number)
    if (w === 1) return `${y - 1}-W52`
    return `${y}-W${pad2(w - 1)}`
}

const getPeriodRange = (
    period: Period,
    filter: string
): { start: Date; end: Date } | null => {
    if (period === "day") {
        const [y, m, d] = filter.split("-").map(Number)
        if (!y || !m || !d) return null
        return {
            start: new Date(Date.UTC(y, m - 1, d)),
            end: new Date(Date.UTC(y, m - 1, d + 1)),
        }
    }
    const [y, w] = filter.split("-W").map(Number)
    if (!y || !w) return null
    const simple = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7))
    const dow = simple.getUTCDay()
    const start = new Date(simple)
    if (dow <= 4) start.setUTCDate(simple.getUTCDate() - dow + 1)
    else start.setUTCDate(simple.getUTCDate() + 8 - dow)
    const end = new Date(start)
    end.setUTCDate(start.getUTCDate() + 7)
    return { start, end }
}

// 'YYYY-MM-DD 00:00:00' — même format que toUTCMidnightISO du contexte.
const toMidnightSql = (wall: Date) => `${getDayKey(wall)} 00:00:00`

// ==========================================
// JOURS FÉRIÉS (copie de calendarConstants.ts)
// ==========================================
function getEasterDate(year: number): Date {
    const a = year % 19
    const b = Math.floor(year / 100)
    const c = year % 100
    const d = Math.floor(b / 4)
    const e = b % 4
    const f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4)
    const k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const month = Math.floor((h + l - 7 * m + 114) / 31)
    const day = ((h + l - 7 * m + 114) % 31) + 1
    return new Date(Date.UTC(year, month - 1, day))
}

function buildFeriesSet(year: number): Set<string> {
    const easter = getEasterDate(year)
    const add = (base: Date, days: number) => {
        const r = new Date(base)
        r.setUTCDate(r.getUTCDate() + days)
        return r
    }
    const ymd = (m: number, d: number) => getDayKey(new Date(Date.UTC(year, m, d)))
    return new Set([
        ymd(0, 1), // Jour de l'an
        getDayKey(add(easter, 1)), // Lundi de Pâques
        ymd(4, 1), // Fête du Travail
        ymd(4, 8), // Victoire 1945
        getDayKey(add(easter, 39)), // Ascension
        getDayKey(add(easter, 50)), // Lundi de Pentecôte
        ymd(6, 14), // Fête Nationale
        ymd(7, 15), // Assomption
        ymd(10, 1), // Toussaint
        ymd(10, 11), // Armistice
        ymd(11, 25), // Noël
    ])
}

const feriesCache = new Map<number, Set<string>>()

function isFerieOrWeekend(dateStr: string | undefined | null): boolean {
    if (!dateStr) return false
    const instant = new Date(dateStr)
    if (isNaN(instant.getTime())) return false
    const d = toWall(instant)
    const day = d.getUTCDay()
    if (day === 0 || day === 6) return true
    const year = d.getUTCFullYear()
    if (!feriesCache.has(year)) feriesCache.set(year, buildFeriesSet(year))
    return feriesCache.get(year)!.has(getDayKey(d))
}

// ==========================================
// PÉRIODE ENVOYÉE
// ==========================================
export interface PeriodContext {
    period: Period
    /** Bucket courant (= selectedFilter du contexte après setSelectedPeriod). */
    filter: string
    prevKey: string
    rangeStart: string
    rangeEnd: string
    prevRangeStart: string | null
    /** Champs du formulaire `POST /newsletter/upload`. */
    weekNumber: number
    startDate: string
    endDate: string
}

export function buildPeriodContext(period: Period, now: Date): PeriodContext {
    const wallNow = toWall(now)
    const filter = getPeriodKey(period, wallNow)
    const prevKey = getPreviousPeriodKey(filter, period)
    const range = getPeriodRange(period, filter)!
    const prevRange = getPeriodRange(period, prevKey)
    // Le front envoie `toISOString()` de minuits LOCAUX : on reproduit la
    // même conversion (minuit Paris → date UTC) pour des champs identiques.
    const toISODate = (wall: Date) =>
        wallToInstant(wall).toISOString().slice(0, 10)
    return {
        period,
        filter,
        prevKey,
        rangeStart: toMidnightSql(range.start),
        rangeEnd: toMidnightSql(range.end),
        prevRangeStart: prevRange ? toMidnightSql(prevRange.start) : null,
        weekNumber: getISOWeek(wallNow),
        startDate: toISODate(range.start),
        endDate: toISODate(range.end),
    }
}

// ==========================================
// CHARGEMENT DES DONNÉES
// ==========================================
// Formes volontairement lâches : les règles d'attribution ci-dessous lisent
// des champs optionnels variés, exactement comme le contexte navigateur.
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>

interface SearchUser {
    id: string
    user_id: string
    name: string
}

export interface ExportGroup {
    ids: string[]
    sepAfter?: "black" | "red"
}

export interface StatsSources {
    events: Row[]
    activites: Row[]
    devis: Row[]
    search: SearchUser[]
    exportGroups: ExportGroup[]
    exportFallbackNames: Record<string, string>
}

const fail = (what: string, error: { message: string }) =>
    new Error(`${what} : ${error.message}`)

export async function loadStatsSources(
    supabase: SupabaseClient,
    ctx: PeriodContext
): Promise<StatsSources> {
    const [eventsRes, activitesRes, devisRes, ownersRes, exportRes] =
        await Promise.all([
            // use_stats.fetchEventstats — voie RPC (couvre N-1 + N).
            supabase.rpc("get_crm_event_stats", {
                p_range_start: ctx.prevRangeStart ?? ctx.rangeStart,
                p_range_end: ctx.rangeEnd,
            }),
            // activitesService.fetchActivites() (sans client).
            supabase
                .from("Client_activite")
                .select("*, owner:profiles!owner(user_id, full_name)"),
            // devisService.fetchDevisByUser({ type: "by", id: "*" }) — les
            // lignes de tableau ne servent pas au calcul (totalHT est une
            // colonne du devis).
            supabase
                .from("Devis")
                .select("*, profiles(*), client_crm(*)")
                .order("Date_crea", { ascending: false }),
            // clientService.fetchActiveOwnerRefs() (fetch_research).
            supabase.from("client_crm").select("customer, closers"),
            // analyticsExportService.fetchExportCollaborators().
            supabase
                .from("analytics_export_collaborators")
                .select("user_id, fallback_name, group_index, member_index, sep_after")
                .order("group_index", { ascending: true })
                .order("member_index", { ascending: true }),
        ])
    if (eventsRes.error) throw fail("get_crm_event_stats", eventsRes.error)
    if (activitesRes.error) throw fail("Client_activite", activitesRes.error)
    if (devisRes.error) throw fail("Devis", devisRes.error)
    if (ownersRes.error) throw fail("client_crm", ownersRes.error)
    if (exportRes.error)
        throw fail("analytics_export_collaborators", exportRes.error)

    const events = ((eventsRes.data ?? []) as Row[])
        .filter(
            (e) =>
                // Même règle que src/features/crm/utils/statsEligibility.ts :
                // créé depuis le CRM, ou RDV Amelia confirmé depuis le CRM.
                ((e.source ?? e.src) === "crm" || Boolean(e.confirmed_by)) &&
                STATS_ALLOWED_CREATORS.has(e.created_by ?? e.creator_id ?? "") &&
                !isFerieOrWeekend(e.created_at)
        )
        .map((e) => ({ ...e, debut: e.debut || new Date().toISOString() }))
    events.sort(
        (a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime()
    )

    const time = (v: unknown) => {
        const t = v ? new Date(v as string).getTime() : 0
        return isNaN(t) ? 0 : t
    }
    // use_activites.stableSort
    const activites = [...((activitesRes.data ?? []) as Row[])].sort((a, b) => {
        const da = time(a.date)
        const db = time(b.date)
        if (da !== db) return db - da
        const ca = a.created_at ? new Date(a.created_at).getTime() : 0
        const cb = b.created_at ? new Date(b.created_at).getTime() : 0
        if (ca !== cb) return cb - ca
        return (a.id || "").localeCompare(b.id || "")
    })

    // use_client.fetch_research
    const activeIds = new Set<string>()
    for (const item of (ownersRes.data ?? []) as Row[]) {
        if (item.customer) activeIds.add(item.customer)
        if (item.closers) activeIds.add(item.closers)
    }
    let search: SearchUser[] = []
    if (activeIds.size > 0) {
        const { data, error } = await supabase
            .from("profiles")
            .select("id, user_id, full_name")
            .in("user_id", Array.from(activeIds))
        if (error) throw fail("profiles", error)
        search = ((data ?? []) as Row[]).map((u) => ({
            id: u.id,
            user_id: u.user_id || u.id,
            name: u.full_name || "Utilisateur sans nom",
        }))
    }

    // AnalyticsContext.fetchExportGroups
    const exportGroups: ExportGroup[] = []
    const exportFallbackNames: Record<string, string> = {}
    const byGroup = new Map<number, ExportGroup>()
    for (const row of (exportRes.data ?? []) as Row[]) {
        if (!row.user_id) continue
        if (row.fallback_name) exportFallbackNames[row.user_id] = row.fallback_name
        let g = byGroup.get(row.group_index)
        if (!g) {
            g = { ids: [] }
            byGroup.set(row.group_index, g)
            exportGroups.push(g)
        }
        g.ids.push(row.user_id)
        if (row.sep_after === "black" || row.sep_after === "red") {
            g.sepAfter = row.sep_after
        }
    }

    return {
        events,
        activites,
        devis: (devisRes.data ?? []) as Row[],
        search,
        exportGroups,
        exportFallbackNames,
    }
}

// ==========================================
// AGRÉGATION (AnalyticsContext.getStatsExportData, mode "collaborators")
// ==========================================
export function buildStatsExportData(src: StatsSources, ctx: PeriodContext) {
    const { search } = src
    const findUser = (id: unknown) =>
        search.find((u) => u.user_id === id || u.id === id)

    const getCommercialId = (item: Row | null): string => {
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
    }

    const getCommercialName = (item: Row): string => {
        if (item.creator_id || item.created_by) {
            const found = findUser(item.creator_id || item.created_by)
            if (found) return found.name || "Créateur inconnu"
        }
        if (item.profiles?.full_name) return item.profiles.full_name
        if (item.customer?.full_name) return item.customer.full_name
        return findUser(getCommercialId(item))?.name || "Non assigné"
    }

    const getEventSetterId = (evt: Row): string | null => {
        const custRaw = evt.customer
        const setterId =
            typeof custRaw === "string"
                ? custRaw
                : custRaw?.user_id ||
                  custRaw?.id ||
                  evt.creator_id ||
                  evt.created_by
        return setterId || null
    }

    const getEventSetterName = (evt: Row): string => {
        const setterId = getEventSetterId(evt)
        if (!setterId) return "Non assigné"
        return findUser(setterId)?.name || "Non assigné"
    }

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

    const inBucket = (key: string) => (dateStr: string | null | undefined) => {
        if (!dateStr) return false
        const d = new Date(dateStr)
        if (Number.isNaN(d.getTime())) return false
        return getPeriodKey(ctx.period, toWall(d)) === key
    }

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
        const bucket = (item: Row) =>
            bucketByIdName(getCommercialId(item), getCommercialName(item))

        for (const e of src.events) {
            if (!matches(e.created_at)) continue
            const creatorId = e.creator_id || e.created_by
            if (!creatorId) continue
            const setterName = getEventSetterName(e)
            const displayName =
                setterName !== "Non assigné" ? setterName : getCommercialName(e)
            bucketByIdName(creatorId, displayName).rdv += 1
        }
        for (const a of src.activites) {
            if (!matches(a.created_at ?? a.date)) continue
            const r = bucket(a)
            r.activiteTotal += 1
            const t = (a.title || "").toLowerCase()
            if (t.includes("appel")) r.nbAppel += 1
            if (t.includes("message")) r.nbMessage += 1
            if (t.includes("mail")) r.nbMail += 1
            if (t.includes("qualification")) r.nbQualification += 1
        }
        for (const d of src.devis) {
            if (!matches(d.Date_crea)) continue
            const r = bucket(d)
            r.nbProforma += 1
            r.ca += d.totalHT || 0
        }
        return byCollab
    }

    const cur = aggregate(inBucket(ctx.filter))
    const prev = aggregate(inBucket(ctx.prevKey))

    // crmUsers du contexte (dérivé de search).
    const uniqueUsers = new Map<string, string>()
    for (const u of search) {
        const uId = u.user_id || u.id
        if (uId && u.name && !uniqueUsers.has(uId)) uniqueUsers.set(uId, u.name)
    }
    const crmUsers = Array.from(uniqueUsers.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name))

    return {
        getStatsExportData: () => ({
            perCollaborator: Array.from(cur.values()).sort(
                (a, b) => b.activiteTotal - a.activiteTotal
            ),
            perCollaboratorPrev: Array.from(prev.values()),
            hasPrev: true,
            mode: "collaborators" as const,
        }),
        selectedPeriod: ctx.period,
        selectedFilter: ctx.filter,
        selectedCommercial: "all",
        crmUsers,
        exportGroups: src.exportGroups,
        exportFallbackNames: src.exportFallbackNames,
    }
}
