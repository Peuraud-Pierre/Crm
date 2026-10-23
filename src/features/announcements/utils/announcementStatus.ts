import type {
    Announcement,
    AnnouncementStatus,
} from "../types/announcement.types"

/**
 * Statut d'une annonce à un instant donné.
 *
 * `now` est passé en paramètre plutôt que lu depuis `Date.now()` : c'est
 * ce qui rend la fonction testable, et surtout ce qui permet à l'appelant
 * de garder une valeur stable le temps d'un rendu. L'ancien code
 * recalculait `new Date().toISOString()` **dans le corps du composant** et
 * le listait comme dépendance de `useMemo` — une valeur différente à
 * chaque rendu, donc un mémo qui ne mémoïsait jamais.
 */
export function getAnnouncementStatus(
    announcement: Pick<Announcement, "archived_at" | "start_date" | "end_date">,
    now: number
): AnnouncementStatus {
    if (announcement.archived_at) return "archived"

    const start = new Date(announcement.start_date).getTime()
    if (start > now) return "planned"

    if (announcement.end_date) {
        const end = new Date(announcement.end_date).getTime()
        if (end <= now) return "expired"
    }

    return "online"
}

/**
 * Ordre d'affichage public : épinglées d'abord, puis les plus récemment
 * ouvertes. Reproduit l'index partiel `annonce_active_idx`.
 */
export function compareForDisplay(a: Announcement, b: Announcement): number {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
}
