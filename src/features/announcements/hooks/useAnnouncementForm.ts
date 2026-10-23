import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    discardAnnouncementImage,
    uploadAnnouncementImage,
} from "../services/announcementService"
import type {
    Announcement,
    AnnouncementDraft,
} from "../types/announcement.types"

function emptyDraft(): AnnouncementDraft {
    return {
        titre: "",
        type: "news",
        excerpt: null,
        body_markdown: null,
        event_date: null,
        author_id: null,
        description: null,
        image: null,
        link: null,
        start_date: new Date().toISOString(),
        end_date: null,
        pinned: false,
        target_role_ids: [],
        target_service_ids: [],
    }
}

interface Options {
    open: boolean
    editing?: Announcement | null
    onSubmit: (draft: AnnouncementDraft) => Promise<boolean>
    onDone: () => void
}

/**
 * L'état du formulaire d'annonce, hors du composant.
 *
 * Le dialogue faisait 428 lignes, au-dessus du seuil de 400
 * (`Architecture_Feature.pdf` §15) — et l'écrivait lui-même dans son
 * en-tête, puisqu'il fusionnait deux fichiers sans les redécouper. Même
 * traitement que `changelogForm.tsx` dans la même refonte : l'état ici,
 * les champs dans `AnnouncementFields`, le dialogue n'assemble plus que
 * les deux.
 */
export function useAnnouncementForm({
    open,
    editing,
    onSubmit,
    onDone,
}: Options) {
    const { user } = useAuth()
    const userId = user?.user_id

    const [draft, setDraft] = useState<AnnouncementDraft>(emptyDraft)
    const [scheduled, setScheduled] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        /* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect -- réinitialisation d'un formulaire contrôlé à l'ouverture du dialogue */
        if (!open) return

        if (editing) {
            setDraft({
                titre: editing.titre,
                type: editing.type,
                excerpt: editing.excerpt,
                // Le repli sur `description` est posé DANS le brouillon, et
                // non dans la valeur du champ. Sinon la zone de texte
                // affichait l'ancien corps sans que le brouillon le porte :
                // enregistrer sans y toucher écrivait `body_markdown = null`,
                // et y toucher migrait tout — la même annonce se comportait
                // différemment selon qu'on l'avait effleurée ou non.
                body_markdown: editing.body_markdown ?? editing.description,
                event_date: editing.event_date,
                author_id: editing.author_id,
                description: editing.description,
                image: editing.image,
                link: editing.link,
                start_date: editing.start_date,
                end_date: editing.end_date,
                pinned: editing.pinned,
                target_role_ids: editing.target_role_ids ?? [],
                target_service_ids: editing.target_service_ids ?? [],
            })
            // Une annonce dont la diffusion est bornée reste éditable en
            // mode planifié, sinon on masquerait ses dates existantes.
            setScheduled(
                new Date(editing.start_date).getTime() > Date.now() ||
                    !!editing.end_date
            )
        } else {
            setDraft(emptyDraft())
            setScheduled(false)
        }
        /* eslint-enable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */
    }, [open, editing])

    function patch(updates: Partial<AnnouncementDraft>) {
        setDraft((prev) => ({ ...prev, ...updates }))
    }

    async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        const previous = draft.image
        setUploading(true)
        try {
            // Téléversé dans le bucket, et non plus encodé en base64 dans
            // la colonne : c'est un chemin qui est stocké.
            patch({ image: await uploadAnnouncementImage(file) })
            // Et l'ancien objet part avec, sinon chaque hésitation de
            // l'auteur laisse un fichier que plus rien ne référence.
            await discardAnnouncementImage(previous)
        } catch (err) {
            console.error("[useAnnouncementForm] upload:", err)
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Erreur lors de l'envoi de l'image"
            )
        } finally {
            setUploading(false)
        }
    }

    async function handleSubmit() {
        if (!draft.titre.trim()) {
            toast.error("Veuillez renseigner un titre")
            return
        }
        if (
            draft.end_date &&
            new Date(draft.end_date) <= new Date(draft.start_date)
        ) {
            toast.error("La fin de diffusion doit suivre le début")
            return
        }

        setSaving(true)
        const ok = await onSubmit({
            ...draft,
            titre: draft.titre.trim(),
            excerpt: draft.excerpt?.trim() || null,
            body_markdown: draft.body_markdown?.trim() || null,
            description: draft.description?.trim() || null,
            link: draft.link?.trim() || null,
            // La signature est celle de qui publie : la demander dans un
            // champ inviterait à publier sous le nom d'un autre.
            author_id: draft.author_id ?? userId ?? null,
            // Publication immédiate quand la planification est désactivée.
            start_date: scheduled ? draft.start_date : new Date().toISOString(),
            end_date: scheduled ? draft.end_date : null,
        })
        setSaving(false)
        if (ok) onDone()
    }

    return {
        draft,
        patch,
        scheduled,
        setScheduled,
        uploading,
        saving,
        handleImageChange,
        handleSubmit,
    }
}
