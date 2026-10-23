/**
 * Horodatage relatif compact des journaux d'activité (« 5m », « 3h », « 12j »).
 *
 * Compact et non verbeux (« il y a 5 minutes ») parce qu'il est rendu en bout
 * de ligne, à côté du nom de l'auteur, dans une colonne qui ne doit pas pousser
 * le contenu. Au-delà de 30 jours il bascule sur une date courte : « 47j » ne
 * dit plus rien d'utile.
 *
 * Une date future renvoie « à l'instant » plutôt qu'une durée négative — le cas
 * se produit avec une horloge client légèrement en avance sur le serveur.
 */
export function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    if (diff < 0) return "à l'instant"
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return "à l'instant"
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}j`
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

/** Date et heure complètes, pour les infobulles et les sheets de détail. */
export function formatExact(dateStr: string): string {
    return new Date(dateStr).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}
