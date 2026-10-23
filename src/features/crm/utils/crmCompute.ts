import type { Client, Tache, Event_creation, TaskStatus, ClientFilters, FilterInput, ActiveTab, BoardData, OwnerColumn } from "@/features/crm/types"
import { COLUMN_NAMES, isFutur, isToday, isYesterday } from "@/shared/utils/CrmTab"
import { safeDate, safeDateMs } from "./safeDate"
import {
    getBriefField,
    getCustomerKey,
    getCustomerName,
    isCustomerObject,
    isFicheAppro,
} from "./invariants"

// =============================================================
// Types partagés re-exportés depuis @/features/crm/types
// =============================================================
export type {
    TaskStatus,
    ClientFilters,
    FilterInput,
    ActiveTab,
    BoardData,
    OwnerColumn,
} from "@/features/crm/types"

const DATE_FILTER_MS: Record<ClientFilters["date"], number> = {
    "1d": 86_400_000,
    "3d": 3 * 86_400_000,
    "1w": 7 * 86_400_000,
    "1m": 30 * 86_400_000,
    all: Number.POSITIVE_INFINITY,
}

const EXPERIENCE_RANGE: Record<string, ClientFilters["experience"] | "new" | "none"> = {
    "+ 3 ans": "high",
    "1 - 3 ans": "mid",
    "0 - 1 ans": "low",
    Nouveau: "new",
}

// =============================================================
// 1. Carte des statuts de tâches par client
// =============================================================
export function buildClientTaskMap(
    clients: Client[] | undefined | null,
    tasks: Tache[] | undefined | null
): Map<string, TaskStatus> {
    const map = new Map<string, TaskStatus>()
    if (!clients || !tasks) return map

    const tasksByClient = new Map<string, Tache[]>()
    for (const task of tasks) {
        const clientId =
            typeof task.client === "string" ? task.client : task.client?.id
        if (!clientId) continue
        const arr = tasksByClient.get(clientId)
        if (arr) arr.push(task)
        else tasksByClient.set(clientId, [task])
    }

    for (const client of clients) {
        if (!client.id) continue
        const list = tasksByClient.get(client.id)
        if (!list || list.length === 0) {
            map.set(client.id, "notask")
            continue
        }
        let status: TaskStatus = "none"
        for (const t of list) {
            const d = safeDate(t.date)
            if (!d) continue
            if (isToday(d)) {
                status = "green"
                break
            }
            if (isYesterday(d)) status = "red"
            else if (status === "none" && isFutur(d)) status = "gray"
        }
        map.set(client.id, status)
    }
    return map
}

// =============================================================
// 2. Filtrage des clients (recherche + filtres)
// =============================================================
export function filterClients(
    clients: Client[] | undefined | null,
    input: FilterInput
): Client[] {
    if (!clients) return []
    const { searchTerm, filters, clientTaskMap, visibleColsIndices } = input

    const term = searchTerm.toLowerCase()
    const dateFilterMs = DATE_FILTER_MS[filters.date]
    const nowMs = Date.now()

    return clients.filter((client) => {
        if (!visibleColsIndices.includes(client.collum ?? 0)) return false

        if (term) {
            const matches =
                client.nom?.toLowerCase().includes(term) ||
                client.telephone?.replace(/\s+/g, "").includes(term) ||
                client.mail?.toLowerCase().includes(term) ||
                client.societe?.toLowerCase().includes(term) ||
                client.customer?.full_name?.toLowerCase().includes(term) ||
                client.closers?.full_name?.toLowerCase().includes(term)
            if (!matches) return false
        }

        if (filters.date !== "all") {
            const ms = safeDateMs(client.created_at || client.updated_at)
            const safeMs = ms || nowMs
            if (nowMs - safeMs > dateFilterMs) return false
        }

        if (filters.experience !== "all") {
            const expValue = getBriefField(client.brief, "experience")
            if (!expValue) return false
            const range = EXPERIENCE_RANGE[expValue] ?? "none"
            if (range !== filters.experience) return false
        }

        if (filters.task !== "all") {
            const status = clientTaskMap.get(client.id ?? "")
            const hasTask = !!status && status !== "notask"
            if (filters.task === "with" && !hasTask) return false
            if (filters.task === "without" && hasTask) return false
        }

        return true
    })
}

// =============================================================
// 3. Groupement et tri des clients pour le board Kanban
// =============================================================
const ACQUISITION_COLS = [
    "Nouveau lead",
    "RDV à confirmer",
    "En qualification",
    "En incubation",
    "RDV Decouverte",
    "RDV Achat",
    "No Show",
    "Dormant",
] as const

const FIDELISATION_COLS = [
    "Visio RDV",
    "RDV Decouverte",
    "RDV Achat",
    "Fidélisation / Client Actif",
    "Dormant",
    "No Show",
] as const

export function groupAndSortBoard(
    filteredClients: Client[],
    activeTab: ActiveTab
): BoardData {
    const visibleCols: string[] = [
        ...(activeTab === "acquisition" ? ACQUISITION_COLS : FIDELISATION_COLS),
    ]
    const groups: Record<string, Client[]> = {}
    for (const col of visibleCols) groups[col] = []

    for (const client of filteredClients) {
        const colName = COLUMN_NAMES[client.collum ?? 0] ?? COLUMN_NAMES[0]
        const bucket = groups[colName]
        if (bucket) bucket.push(client)
    }

    const timeCache = new Map<string, number>()
    // Tri par `updated_at DESC` (activité récente en haut) pour s'aligner avec
    // l'ordre de fetch (`updated_at DESC` + cursor `lt(oldestUpdatedAt)`).
    // Conséquence : un scroll vers le bas charge des clients plus anciens en
    // updated_at, qui s'insèrent naturellement EN BAS de la colonne.
    // Fallback sur created_at si updated_at est NULL, puis 0.
    const getUpdatedMs = (client: Client): number => {
        const id = client.id
        if (id && timeCache.has(id)) return timeCache.get(id)!
        const ms =
            safeDateMs(client.updated_at) ||
            safeDateMs(client.created_at) ||
            0
        if (id) timeCache.set(id, ms)
        return ms
    }

    for (const col of visibleCols) {
        groups[col].sort((a, b) => {
            const diff = getUpdatedMs(b) - getUpdatedMs(a) // DESC
            if (diff !== 0) return diff
            const budgetA = isFicheAppro(a.brief) ? a.brief.budget ?? 0 : 0
            const budgetB = isFicheAppro(b.brief) ? b.brief.budget ?? 0 : 0
            return budgetB - budgetA
        })
    }

    return { groups, visibleCols }
}

// =============================================================
// 4. Regroupement des événements par propriétaire (DayView)
// =============================================================
export function groupEventsByOwner(events: Event_creation[]): OwnerColumn[] {
    const groups = new Map<string, OwnerColumn>()
    for (const evt of events) {
        const ref = evt.customer
        let key: string = "unassigned"
        let name: string = "Non assigné"
        if (isCustomerObject(ref)) {
            key = getCustomerKey(ref) ?? key
            name = getCustomerName(ref, evt.owner ?? "Utilisateur")
        } else if (typeof ref === "string" && ref) {
            key = ref
            name = evt.owner ?? "Utilisateur"
        }
        let bucket = groups.get(key)
        if (!bucket) {
            bucket = { id: key, ownerName: name, events: [] }
            groups.set(key, bucket)
        }
        bucket.events.push(evt)
    }
    return Array.from(groups.values())
}

// =============================================================
// 5. Détection de chevauchements (O(n log n) sweep-line)
// =============================================================
interface Interval {
    start: number
    end: number
    evt: Event_creation
}

export function computeOverlapGroups(
    events: Event_creation[]
): Event_creation[][] {
    if (events.length === 0) return []
    const intervals: Interval[] = events
        .map((evt) => {
            const start = safeDateMs(evt.debut)
            const endRaw = safeDateMs(evt.fin) || start
            return { start, end: Math.max(start, endRaw), evt }
        })
        .filter((i) => i.start > 0)
        .sort((a, b) => a.start - b.start)

    const groups: Event_creation[][] = []
    let current: Interval[] = []
    let currentMaxEnd = -Infinity

    for (const iv of intervals) {
        if (current.length === 0 || iv.start < currentMaxEnd) {
            current.push(iv)
            currentMaxEnd = Math.max(currentMaxEnd, iv.end)
        } else {
            groups.push(current.map((i) => i.evt))
            current = [iv]
            currentMaxEnd = iv.end
        }
    }
    if (current.length > 0) groups.push(current.map((i) => i.evt))
    return groups
}
