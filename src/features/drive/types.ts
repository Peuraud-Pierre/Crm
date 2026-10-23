export type DriveItemType = "image" | "video" | "audio" | "file" | "folder"

export type DriveItem = {
    id: string
    url: string
    title?: string
    owner: "perso" | "partage"
    owner_id: string
    createdAt: string
    sharedWith?: string[]
    type?: DriveItemType
    /**
     * MIME réel du fichier, renvoyé par l'API.
     * Absent sur les entrées créées avant la migration 005.
     */
    mime?: string
    /** Taille en octets. 0 ou absent = inconnue (entrées antérieures à la 005). */
    sizeBytes?: number
    /** Un dossier n'a ni URL ni taille : il se navigue, il ne s'ouvre pas. */
    isFolder?: boolean
    /** Dossier parent. Absent = racine du Drive. */
    parentId?: string
    /** Date de mise en corbeille. Absente hors corbeille. */
    deletedAt?: string
}

/** Maillon du fil d'Ariane, de la racine vers le dossier courant. */
export type PathSegment = { id: string; title: string }

export type Contact = { id: string; name: string; email: string }

/**
 * Type de transfert d'un déplacement interne au Drive. Il distingue un
 * glisser-déposer d'éléments existants d'un dépôt de fichiers venus du
 * bureau, que `dataTransfer.types` annonce comme "Files".
 */
export const DRIVE_DRAG_TYPE = "application/x-drive-item-ids"
