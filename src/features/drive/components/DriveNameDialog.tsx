import { useState } from "react"

import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"

/**
 * Saisie d'un nom d'élément du Drive : création d'un dossier, renommage d'un
 * fichier ou d'un dossier. `onSubmit` reçoit le nom déjà trimé et non vide ;
 * le dialog ne se ferme qu'en cas de succès, pour que l'erreur reste lisible
 * à côté du champ.
 */
export default function DriveNameDialog({
    open,
    onOpenChange,
    onSubmit,
    heading = "Nouveau dossier",
    label = "Nom du dossier",
    placeholder = "Factures 2026",
    submitLabel = "Créer",
    pendingLabel = "Création…",
    initialValue = "",
    suffix = "",
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (title: string) => Promise<void>
    heading?: string
    label?: string
    placeholder?: string
    submitLabel?: string
    pendingLabel?: string
    /**
     * Nom courant, en renommage. Il n'est lu qu'au montage : pour le rafraîchir
     * d'un élément à l'autre, l'appelant passe une `key` distincte plutôt qu'un
     * effet de synchronisation.
     */
    initialValue?: string
    /**
     * Extension du fichier, affichée après le champ mais hors de sa saisie, et
     * recollée au nom avant `onSubmit`. La modifier casserait l'ouverture du
     * fichier, le type MIME enregistré ne suivant pas le nouveau suffixe.
     */
    suffix?: string
}) {
    const [title, setTitle] = useState(initialValue)
    const [pending, setPending] = useState(false)

    const close = () => {
        setTitle(initialValue)
        setPending(false)
        onOpenChange(false)
    }

    const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        const clean = title.trim()
        if (!clean || pending) return

        setPending(true)
        try {
            await onSubmit(clean + suffix)
            close()
        } catch {
            // Le parent a déjà signalé l'échec. On garde le dialog ouvert pour
            // que le nom saisi reste corrigeable, sans laisser l'erreur
            // remonter en rejet non capturé.
        } finally {
            setPending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>{heading}</DialogTitle>
                    </DialogHeader>

                    <div className="my-4 space-y-2">
                        <Label htmlFor="drive-item-name">{label}</Label>
                        {/* L'extension est montrée, jamais éditable : la voir
                            évite de la retaper « pour être sûr », ce qui
                            produirait « rapport.pdf.pdf ». */}
                        <div className="flex items-center gap-2">
                            <Input
                                id="drive-item-name"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={placeholder}
                                maxLength={255}
                                autoFocus
                                disabled={pending}
                            />
                            {suffix && (
                                <span className="shrink-0 text-sm text-muted-foreground">
                                    {suffix}
                                </span>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="flex-row justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={close}
                            disabled={pending}
                        >
                            Annuler
                        </Button>
                        <Button type="submit" disabled={!title.trim() || pending}>
                            {pending ? pendingLabel : submitLabel}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
