/**
 * Easter egg « bio-mode ».
 *
 * Un clic sur le numéro de la dernière version, dans le changelog, bascule
 * la classe `bio-mode` sur `<html>`. Le thème (`src/index.css`) et
 * `features/dashboard/decor/BioModeOverlay` réagissent à cette classe.
 *
 * Regroupé ici parce que la bascule et l'observation vivent dans deux
 * features différentes : la logique était jusqu'ici enfouie dans un
 * `onClick` et un `useEffect` au milieu d'une carte de changelog de
 * 768 lignes, sans rapport avec ce qu'elle affiche.
 */
const STORAGE_KEY = "bioMode"
const CLASS_NAME = "bio-mode"

/** Réapplique le mode mémorisé au chargement. Sans effet s'il est éteint. */
export function restoreBioMode(): void {
    try {
        if (localStorage.getItem(STORAGE_KEY) === "true") {
            document.documentElement.classList.add(CLASS_NAME)
        }
    } catch {
        // localStorage indisponible (navigation privée, stockage bloqué) :
        // l'easter egg n'est pas restauré, et c'est sans conséquence.
    }
}

/** Bascule le mode et mémorise le choix. Retourne le nouvel état. */
export function toggleBioMode(): boolean {
    const enabled = document.documentElement.classList.toggle(CLASS_NAME)
    try {
        localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false")
    } catch {
        // Idem : la bascule reste effective pour la session en cours.
    }
    return enabled
}
