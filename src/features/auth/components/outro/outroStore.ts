import { useSyncExternalStore } from "react"

/*
 * Outro de connexion : le logo de l'écran de connexion passe dans une
 * surcouche montée hors du routeur (AuthOutroLayer), ondule au centre le
 * temps que l'accueil se charge, puis vole jusqu'au bouton menu de l'en-tête
 * et s'y fond. Quatre acteurs qui ne se connaissent pas se coordonnent ici :
 *
 *   - le formulaire arme l'outro quand le mot de passe (ou le code MFA) est
 *     accepté : seule une vraie connexion la joue, jamais une session
 *     restaurée au rechargement ;
 *   - PublicOnlyLayout passe le relais (OutroHandoff) : la feuille sort,
 *     la surcouche reprend le logo à sa place exacte, puis on navigue ;
 *   - AuthGuardLayout signale que l'accueil est affiché pour de bon ;
 *   - le bouton menu de l'en-tête sert de cible et rebondit à l'arrivée.
 *
 * État de module : l'outro traverse un changement de route, aucun contexte
 * React ne survit à la fois à l'écran de connexion et à l'application.
 */

export type OutroPhase =
    /** Rien en cours. */
    | "idle"
    /** La feuille du formulaire quitte l'écran de connexion. */
    | "exiting"
    /** La surcouche a repris le logo, l'accueil se charge dessous. */
    | "holding"
    /** Le logo vole vers le bouton menu, la surcouche s'efface. */
    | "landing"

export interface OutroState {
    phase: OutroPhase
    /** Place du logo au moment du relais (coordonnées de la fenêtre). */
    from: DOMRect | null
    /** Début de la sortie : les bornes de durée se comptent de là. */
    startedAt: number
    /** L'accueil est affiché (code de la page chargé, permissions reçues). */
    ready: boolean
}

/** Durée de la sortie de la feuille, avant que la surcouche ne reprenne le logo. */
export const OUTRO_EXIT_MS = 420
/** Bornes de l'outro, comptées depuis le début de la sortie : jamais moins
 *  (l'animation doit se lire), jamais plus (l'accueil arrive alors avec son
 *  propre chargement). */
export const OUTRO_MIN_MS = 1200
export const OUTRO_MAX_MS = 4000

/** Un armement non suivi d'une entrée dans l'app (échec du profil…) expire. */
const ARM_TTL_MS = 30_000

const IDLE: OutroState = { phase: "idle", from: null, startedAt: 0, ready: false }

let state = IDLE
let armedAt = Number.NEGATIVE_INFINITY
let logoEl: HTMLElement | null = null
let targetEl: HTMLElement | null = null
const listeners = new Set<() => void>()
const landedListeners = new Set<() => void>()

function update(patch: Partial<OutroState>) {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
}

function prefersReducedMotion() {
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
}

export const authOutro = {
    /** Mot de passe ou code accepté : la prochaine entrée dans l'app jouera l'outro. */
    arm() {
        // Mouvement réduit : pas d'outro, l'accueil s'affiche directement.
        if (!prefersReducedMotion()) armedAt = performance.now()
    },
    /** Connexion abandonnée (retour depuis l'étape MFA). */
    disarm() {
        armedAt = Number.NEGATIVE_INFINITY
    },
    isArmed() {
        return performance.now() - armedAt < ARM_TTL_MS
    },
    /** Début de la sortie : la feuille quitte l'écran de connexion. */
    exit() {
        armedAt = Number.NEGATIVE_INFINITY
        if (state.phase !== "idle") return
        update({ phase: "exiting", from: null, startedAt: performance.now(), ready: false })
    },
    /** La surcouche reprend le logo exactement là où il est. */
    takeOver() {
        update({ phase: "holding", from: logoEl?.getBoundingClientRect() ?? null })
    },
    markReady() {
        if (state.phase !== "idle" && !state.ready) update({ ready: true })
    },
    land() {
        if (state.phase === "holding") update({ phase: "landing" })
    },
    finish() {
        update(IDLE)
    },

    /** Logo de l'écran de connexion (AuthShell), mesuré au moment du relais. */
    registerLogo(el: HTMLElement | null) {
        logoEl = el
    },
    /** Bouton menu de l'en-tête : là où le logo atterrit. */
    registerTarget(el: HTMLElement | null) {
        targetEl = el
    },
    getTarget() {
        return targetEl
    },
    /** Le logo s'est fondu dans la cible : elle joue son rebond. */
    notifyLanded() {
        for (const listener of landedListeners) listener()
    },
    onLanded(listener: () => void) {
        landedListeners.add(listener)
        return () => {
            landedListeners.delete(listener)
        }
    },
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

const getSnapshot = () => state

export function useAuthOutro(): OutroState {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
