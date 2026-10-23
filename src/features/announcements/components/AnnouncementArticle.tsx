import { Dialog, DialogContent_2 } from "@/shared/ui/atoms/dialog"
import type { Announcement } from "../types/announcement.types"
import { AnnouncementArticleBody } from "./AnnouncementArticleBody"

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    announcement: Announcement | null
}

/**
 * Une annonce lue en entier.
 *
 * Bâti sur `DialogContent_2`, qui apporte **un seul** ascenseur, correct :
 * la version précédente en imbriquait un second (`max-h-[60vh]`) dans un
 * conteneur déjà borné à `90vh`, et ouvrait une deuxième modale par-dessus
 * la première pour agrandir l'image.
 *
 * Ce fichier ne fait plus que poser le dialogue : la mise en page vit dans
 * `AnnouncementArticleBody`, que l'aperçu de la console réutilise tel quel.
 */
export function AnnouncementArticle({
    open,
    onOpenChange,
    announcement,
}: Props) {
    if (!announcement) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent_2 className="max-w-3xl gap-0 p-0">
                <AnnouncementArticleBody announcement={announcement} inDialog />
            </DialogContent_2>
        </Dialog>
    )
}
