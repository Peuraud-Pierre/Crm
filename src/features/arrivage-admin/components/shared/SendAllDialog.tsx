import { useState } from "react"
import { Mail } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/shared/ui/atoms/dialog"

interface SendAllDialogProps {
    sending: boolean
    onConfirm: () => Promise<void>
    /** Compact sur mobile : le libellé du bouton laisse place à l'icône seule. */
    className?: string
}

/**
 * Bouton « Envoyer à tous » avec sa confirmation. Partagé entre le dashboard
 * (carte santé du service) et l'onglet Abonnés — c'est la même action, elle ne
 * doit pas exister en deux exemplaires divergents.
 *
 * L'appelant est responsable du gating par permission
 * (stock.arrivage.newsletter.send) : ce composant ne s'affiche pas de lui-même.
 */
export function SendAllDialog({ sending, onConfirm, className }: SendAllDialogProps) {
    const [open, setOpen] = useState(false)

    const handleConfirm = async () => {
        await onConfirm()
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" disabled={sending} className={className}>
                    <Mail className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">
                        {sending ? "Envoi…" : "Envoyer à tous"}
                    </span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        Envoyer la newsletter à tous les abonnés ?
                    </DialogTitle>
                </DialogHeader>
                <p className="py-2 text-sm text-muted-foreground">
                    Envoie immédiatement l'état actuel du tableau des arrivages
                    à tous les abonnés actifs, avec les dernières modifications
                    mises en évidence.
                </p>
                <DialogFooter>
                    <Button onClick={handleConfirm} disabled={sending}>
                        {sending ? "Envoi…" : "Envoyer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
