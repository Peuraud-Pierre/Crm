"use client"

import type {
    Announcement,
    AnnouncementDraft,
} from "../../types/announcement.types"
import { AnnouncementArticleBody } from "../AnnouncementArticleBody"

/**
 * Aperçu d'une annonce en cours de saisie, rendu avec le composant réel
 * que verra le destinataire — c'est ce qui garantit que l'aperçu ne
 * diverge pas de l'affichage final.
 *
 * `AnnouncementArticleBody` et non `AnnouncementCard` : la carte est le
 * gabarit de la liste d'administration, elle ne rend pas le markdown. Un
 * aperçu qui ne montre pas le rendu de ce qu'on est en train d'écrire ne
 * prévisualise rien.
 */
export function AnnouncementPreview({ draft }: { draft: AnnouncementDraft }) {
    // Objet factice au format `Announcement` : id/created_at/archived_at
    // n'existent pas encore avant l'enregistrement.
    const preview: Announcement = {
        id: "preview",
        created_at: new Date().toISOString(),
        archived_at: null,
        titre: draft.titre || "Titre de l'annonce",
        type: draft.type,
        description: draft.description,
        excerpt: draft.excerpt || "Le chapô apparaîtra ici.",
        body_markdown: draft.body_markdown,
        event_date: draft.event_date,
        author_id: draft.author_id,
        author: null,
        image: draft.image,
        link: draft.link,
        start_date: draft.start_date,
        end_date: draft.end_date,
        pinned: draft.pinned,
        target_role_ids: draft.target_role_ids,
        target_service_ids: draft.target_service_ids,
    }

    return <AnnouncementArticleBody announcement={preview} />
}
