import { useState } from "react"
import { AlertTriangle, Bomb } from "lucide-react"
import { Button, buttonVariants } from "@/shared/ui/atoms/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/ui/atoms/alert-dialog"

interface BalleEclaterButtonProps {
    disabled?: boolean
    /** Chemin de l'emplacement que la balle va quitter, si elle est rangée. */
    place: string | null
    /** Vrai si la balle est empruntée : l'emprunt sera clôturé. */
    isBorrowed: boolean
    borrowerName: string | null
    /** Vrai si l'éclatement a abouti — la confirmation se ferme alors. */
    onConfirm: () => Promise<boolean>
}

/**
 * Bouton « Éclater » et son avertissement. L'action est définitive : la balle
 * sort du stock et de son emplacement, elle ne reste que pour les stats.
 * L'avertissement liste ce que l'éclatement va défaire sur CETTE balle.
 */
export function BalleEclaterButton({
    disabled,
    place,
    isBorrowed,
    borrowerName,
    onConfirm,
}: BalleEclaterButtonProps) {
    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)

    const confirm = async () => {
        setBusy(true)
        try {
            if (await onConfirm()) setOpen(false)
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-destructive hover:text-destructive"
                disabled={disabled}
                onClick={() => setOpen(true)}
            >
                <Bomb size={13} aria-hidden />
                Éclater
            </Button>

            <AlertDialog
                open={open}
                onOpenChange={(value) => {
                    if (!value && !busy) setOpen(false)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle size={18} className="shrink-0 text-warning" aria-hidden />
                            Éclater cette balle ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Elle reste enregistrée pour les statistiques, mais ne pourra
                            plus être rangée, empruntée ni rattachée à une expédition.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <ul className="space-y-1.5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
                        <li>• Elle sera retirée du stock.</li>
                        {place && (
                            <li>
                                • Elle quittera son emplacement{" "}
                                <span className="font-mono font-semibold">{place}</span>.
                            </li>
                        )}
                        {isBorrowed && (
                            <li>
                                • L&apos;emprunt{borrowerName ? ` de ${borrowerName}` : ""} sera
                                clôturé.
                            </li>
                        )}
                        <li className="font-semibold">• Cette action est définitive.</li>
                    </ul>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={busy}
                            className={buttonVariants({ variant: "destructive" })}
                            onClick={(event) => {
                                event.preventDefault()
                                void confirm()
                            }}
                        >
                            Éclater la balle
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
