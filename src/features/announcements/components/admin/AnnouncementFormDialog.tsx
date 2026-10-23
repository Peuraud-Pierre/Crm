"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { useAnnouncementForm } from "../../hooks/useAnnouncementForm"
import type {
    Announcement,
    AnnouncementDraft,
} from "../../types/announcement.types"
import { AnnouncementFields } from "./AnnouncementFields"
import { AnnouncementPreview } from "./AnnouncementPreview"

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Annonce à modifier ; absente = création. */
    editing?: Announcement | null
    onSubmit: (draft: AnnouncementDraft) => Promise<boolean>
}

/**
 * Création et modification d'une annonce, dans un seul écran.
 *
 * Remplace `AnnonceForm.tsx` (263 l., création) et `AnnonceEditDialog.tsx`
 * (170 l., modification), qui portaient deux fois la même logique avec des
 * conventions de dates divergentes. Les validations passent par `toast`
 * plutôt que par `alert()`, comme partout ailleurs dans l'application.
 *
 * Ce fichier n'assemble plus que deux choses : l'état vit dans
 * `useAnnouncementForm`, les champs dans `AnnouncementFields`. La fusion
 * des deux écrans d'origine avait produit un fichier de 428 lignes, soit
 * au-dessus du seuil de 400 (`Architecture_Feature.pdf` §15).
 */
export function AnnouncementFormDialog({
    open,
    onOpenChange,
    editing,
    onSubmit,
}: Props) {
    const form = useAnnouncementForm({
        open,
        editing,
        onSubmit,
        onDone: () => onOpenChange(false),
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-5xl bg-background">
                <DialogHeader>
                    <DialogTitle>
                        {editing ? "Modifier l'annonce" : "Créer une annonce"}
                    </DialogTitle>
                </DialogHeader>

                {/* Hauteur en unité de fenêtre : le dialogue doit tenir à
                    l'écran quelle que soit la longueur de l'article, et
                    c'est la colonne qui défile, pas la page. */}
                <div className="grid h-[72vh] grid-cols-1 gap-6 md:grid-cols-2">
                    <AnnouncementFields
                        draft={form.draft}
                        patch={form.patch}
                        scheduled={form.scheduled}
                        onScheduledChange={form.setScheduled}
                        uploading={form.uploading}
                        saving={form.saving}
                        onImageChange={form.handleImageChange}
                        onSubmit={() => void form.handleSubmit()}
                        editing={!!editing}
                    />

                    <div className="overflow-y-auto border-l py-2 pl-4 pr-2">
                        <p className="mb-3 font-semibold">Prévisualisation</p>
                        <AnnouncementPreview draft={form.draft} />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
