import { useEffect, useSyncExternalStore } from "react"

/**
 * Mise à jour de l'application et ce qui la retient.
 *
 * Le service worker s'active dès qu'une nouvelle version est déployée et
 * rechargeait la page sur-le-champ. Quelqu'un en train de rédiger perdait sa
 * saisie sans avertissement. Le rechargement est désormais différé tant qu'un
 * formulaire déclare du travail non enregistré, puis part de lui-même dès que
 * tout est propre — l'intention anti-vieille-version est préservée, sans
 * couper personne en pleine frappe.
 */

/** Clés des formulaires ayant du travail non enregistré. */
const dirtyKeys = new Set<string>()
const listeners = new Set<() => void>()

let updateAvailable = false

function emit() {
    for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

/**
 * Déclare (ou lève) du travail non enregistré pour une clé donnée.
 * Une clé stable par formulaire — plusieurs formulaires peuvent coexister.
 */
export function setUnsavedWork(key: string, dirty: boolean): void {
    const had = dirtyKeys.has(key)
    if (dirty) dirtyKeys.add(key)
    else dirtyKeys.delete(key)
    if (had === dirty) return

    emit()
    // Une mise à jour retenue part dès que le dernier formulaire est propre.
    if (!dirty && updateAvailable && dirtyKeys.size === 0) {
        reloadNow()
    }
}

export function hasUnsavedWork(): boolean {
    return dirtyKeys.size > 0
}

/**
 * Signale qu'une nouvelle version est prête. Recharge immédiatement si rien
 * n'est en cours, sinon attend que tout soit enregistré.
 */
export function notifyUpdateAvailable(): void {
    if (updateAvailable) return
    updateAvailable = true
    emit()

    if (!hasUnsavedWork()) reloadNow()
}

export function reloadNow(): void {
    window.location.reload()
}

/** true dès qu'une nouvelle version attend d'être appliquée. */
export function useUpdateAvailable(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => updateAvailable,
        // Rendu serveur / prérendu : aucune mise à jour en attente.
        () => false
    )
}

/**
 * Déclare du travail non enregistré le temps que `dirty` reste vrai, et le
 * lève au démontage — sans quoi un formulaire fermé en cours de saisie
 * retiendrait la mise à jour indéfiniment.
 */
export function useUnsavedWork(key: string, dirty: boolean): void {
    useEffect(() => {
        setUnsavedWork(key, dirty)
    }, [key, dirty])

    useEffect(() => {
        return () => setUnsavedWork(key, false)
    }, [key])
}

/** Réservé aux tests : remet le module à zéro entre deux cas. */
export function __resetAppUpdate(): void {
    dirtyKeys.clear()
    updateAvailable = false
    listeners.clear()
}
