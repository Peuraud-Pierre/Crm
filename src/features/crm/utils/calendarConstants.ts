/**
 * calendarConstants.ts
 * Constantes et utilitaires calendrier extraits de components/types.ts.
 * Importé par useCreateEventLogic et les vues Calendar.
 */

import { parseISO, isValid } from "date-fns"

// Types d'événements, thèmes et libellés : centralisés dans `eventTypes.ts`.
// Réexportés ici pour conserver les imports existants des vues calendrier.
export {
    EVENT_TYPES,
    getEventTheme,
    type EventTheme,
} from "@/features/crm/utils/eventTypes"

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de grille
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Agendas fixes (les "constantes")
// ─────────────────────────────────────────────────────────────────────────────
// Commerciaux dont l'agenda est toujours visible. En vues MOIS et SEMAINE, on
// n'affiche QUE ces agendas + celui de l'utilisateur courant (aucune autre
// personne). Chaque id peut correspondre soit à `profiles.id`, soit à
// `profiles.user_id`.
export const FIXED_OWNER_IDS = [
    "998e6ec9-1a2b-4c84-ac36-e0deedb43f52",
    "77f6427e-3658-47e7-80ce-d40eb31a5d8e",
    "cc288e8e-e940-44d9-948c-fa6d9366172c",
] as const

// Agenda supplémentaire toujours affiché, mais TOUJOURS en dernière colonne
// (pas de tri alphabétique avec les 4 fixes) — actuellement Antoine.
export const PINNED_LAST_OWNER_IDS = [
    "8f93efc7-a3fb-496b-a397-781ae3fc41cf",
] as const

type TeamRef = { id?: string | null; user_id?: string | null }

/**
 * Ensemble des identifiants autorisés en vues mois/semaine :
 * les agendas fixes (résolus en `id` ET `user_id` via `search`) + l'utilisateur
 * courant. Permet de matcher un événement quel que soit le format de son owner.
 */
export function buildAllowedOwnerSet(
    search: TeamRef[] | null | undefined,
    currentUserId: string | null | undefined
): Set<string> {
    const set = new Set<string>()
    const add = (v?: string | null) => {
        if (v) set.add(v.toString())
    }
    add(currentUserId)
    for (const id of [...FIXED_OWNER_IDS, ...PINNED_LAST_OWNER_IDS]) {
        add(id)
        const p = search?.find((u) => u.id === id || u.user_id === id)
        add(p?.id)
        add(p?.user_id)
    }
    return set
}

/** Vrai si l'événement appartient à un owner présent dans `allowed`. */
export function isOwnerAllowed(
    evt: { owner?: string | null; customer?: unknown },
    allowed: Set<string>
): boolean {
    const keys: Array<string | null | undefined> = []
    if (evt.owner) keys.push(evt.owner)
    const c = evt.customer
    if (c && typeof c === "object") {
        const obj = c as TeamRef
        keys.push(obj.user_id, obj.id)
    } else if (typeof c === "string") {
        keys.push(c)
    }
    return keys.some((k) => k && allowed.has(k.toString()))
}

/**
 * Échelle d'empilement des grilles de l'agenda (vues Jour et Semaine, grille
 * de la modale de création). Documentée ici parce que les valeurs se lisaient
 * auparavant les unes par rapport aux autres, fichier par fichier — d'où des
 * `z-[60]` / `z-[70]` qui dépassaient sans le savoir le drawer de la sidebar
 * applicative (`z-50`, `shared/components/layout/MainLayout.tsx`).
 *
 *   z-0   fond : lignes horaires, indisponibilités
 *   z-10  cartes d'événement (+ `zIndex` par index dans un groupe de
 *         chevauchement, borné à 19)
 *   z-20  ligne « heure actuelle » — au-dessus des cartes, sinon un créneau
 *         chargé la masque entièrement
 *   z-30  gouttière des heures (sticky) et poignées de redimensionnement
 *   z-40  événement en cours de déplacement
 *   z-50  en-têtes collants, fondu de débordement mobile, overlays de la
 *         feature — PLAFOND : au-delà, l'élément passe devant la sidebar
 *
 * Le cloisonnement est garanti par l'`isolate` posé sur le conteneur de
 * contenu de MainLayout ; cette échelle sert à rester lisible à l'intérieur.
 * Les vraies modales passent par le `Dialog` du design system (portalisé).
 */
export const START_HOUR = 7
export const END_HOUR = 21
export const HOUR_HEIGHT = 60

// Heures affichées dans la grille (ex. [7, 8, …, 21]) : valeurs réelles plutôt
// qu'un tableau de `undefined`, pour servir de clés React stables.
export const TIME_GRID_ARRAY: number[] = Array.from(
    { length: END_HOUR - START_HOUR + 1 },
    (_, i) => START_HOUR + i
)

export const TIME_SLOTS = (() => {
    const slots: string[] = []
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15)
            slots.push(
                `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
            )
    }
    return slots
})()

export const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

// ─────────────────────────────────────────────────────────────────────────────
// Jours fériés français
// ─────────────────────────────────────────────────────────────────────────────

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
    return new Date(year, month - 1, day)
}

function getDayKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function buildFeriesSet(year: number): Set<string> {
    const easter = getEasterDate(year)
    const add = (base: Date, days: number) => {
        const r = new Date(base)
        r.setDate(r.getDate() + days)
        return r
    }
    return new Set([
        getDayKey(new Date(year, 0, 1)), // Jour de l'an
        getDayKey(add(easter, 1)), // Lundi de Pâques
        getDayKey(new Date(year, 4, 1)), // Fête du Travail
        getDayKey(new Date(year, 4, 8)), // Victoire 1945
        getDayKey(add(easter, 39)), // Ascension
        getDayKey(add(easter, 50)), // Lundi de Pentecôte
        getDayKey(new Date(year, 6, 14)), // Fête Nationale
        getDayKey(new Date(year, 7, 15)), // Assomption
        getDayKey(new Date(year, 10, 1)), // Toussaint
        getDayKey(new Date(year, 10, 11)), // Armistice
        getDayKey(new Date(year, 11, 25)), // Noël
    ])
}

const feriesCache = new Map<number, Set<string>>()

/** Retourne true si la date est un samedi, dimanche ou jour férié français. */
export function isFerieOrWeekend(dateStr: string | undefined | null): boolean {
    if (!dateStr) return false
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return false
    const day = d.getDay()
    if (day === 0 || day === 6) return true
    const year = d.getFullYear()
    if (!feriesCache.has(year)) feriesCache.set(year, buildFeriesSet(year))
    return feriesCache.get(year)!.has(getDayKey(d))
}

/** Retourne le nom du jour férié si la date en est un, sinon null. */
export function getFerieLabel(dateStr: string): string | null {
    if (!dateStr) return null
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    const day = d.getDay()
    if (day === 6) return "Samedi"
    if (day === 0) return "Dimanche"
    const year = d.getFullYear()
    if (!feriesCache.has(year)) feriesCache.set(year, buildFeriesSet(year))
    const key = getDayKey(d)
    if (!feriesCache.get(year)!.has(key)) return null

    const easter = getEasterDate(year)
    const fmt = (base: Date, days: number) => {
        const r = new Date(base)
        r.setDate(r.getDate() + days)
        return getDayKey(r)
    }
    const labels: [string, string][] = [
        [getDayKey(new Date(year, 0, 1)), "Jour de l'an"],
        [fmt(easter, 1), "Lundi de Pâques"],
        [getDayKey(new Date(year, 4, 1)), "Fête du Travail"],
        [getDayKey(new Date(year, 4, 8)), "Victoire 1945"],
        [fmt(easter, 39), "Ascension"],
        [fmt(easter, 50), "Lundi de Pentecôte"],
        [getDayKey(new Date(year, 6, 14)), "Fête Nationale"],
        [getDayKey(new Date(year, 7, 15)), "Assomption"],
        [getDayKey(new Date(year, 10, 1)), "Toussaint"],
        [getDayKey(new Date(year, 10, 11)), "Armistice"],
        [getDayKey(new Date(year, 11, 25)), "Noël"],
    ]
    return labels.find(([k]) => k === key)?.[1] ?? "Jour férié"
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaires de date/heure (version calendrier — utilise parseISO pour les strings)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse une valeur en Date valide. Utilise `parseISO` pour les strings
 * ISO (plus précis que `new Date()`).
 */
export const safeDate = (val: unknown): Date | null => {
    if (val == null || val === "") return null
    const parsed =
        typeof val === "string"
            ? parseISO(val)
            : new Date(val as string | number | Date)
    return isValid(parsed) ? parsed : null
}

export const timeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number)
    return h * 60 + m
}

export const minutesToTime = (min: number) => {
    const h = Math.max(0, Math.min(23, Math.floor(min / 60)))
    const m = Math.max(0, Math.min(45, Math.floor((min % 60) / 15) * 15))
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * RDV Amelia en attente de confirmation : affiché en pointillé dans l'agenda.
 *
 * Le prospect a posé une date, mais le client est encore dans la colonne
 * « RDV à confirmer ». On montre le créneau demandé plutôt que rien, tout en
 * le distinguant d'un RDV ferme. `confirmed` est optionnel côté type : seul
 * `false` (RDV Amelia en attente) déclenche le pointillé, `undefined`
 * (événement créé à la main) reste un trait plein.
 */
export const pendingEventClass = (confirmed?: boolean | null) =>
    confirmed === false ? "border-dashed border-2 opacity-75" : ""

/**
 * Variante pastille (MonthView mobile) du RDV en attente : losange plein.
 *
 * Une texture (pointillé, contour creux) est illisible à 6 px : le trait se
 * perd sur le fond blanc de la cellule. On change donc de FORME plutôt que de
 * remplissage — rond = confirmé, losange = en attente — ce qui se perçoit
 * instantanément quel que soit le fond, et garde le fond plein qui porte la
 * couleur du type de RDV. La rotation d'un carré de 6 px donne une diagonale
 * de ~8,5 px : même encombrement visuel, aucun chevauchement des voisines.
 */
export const pendingDotClass = (confirmed?: boolean | null) =>
    confirmed === false ? "rounded-none rotate-45" : ""
