import { useState, type ReactNode } from "react"
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
import { cn } from "@/shared/lib/utils"
import { buttonVariants } from "@/shared/ui/atoms/button"

interface ConfirmActionProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: ReactNode
    description: ReactNode
    confirmLabel: string
    /** Action irréversible ou destructrice : bouton rouge. */
    destructive?: boolean
    /** Rend `false` en échec : le dialogue reste ouvert. */
    onConfirm: () => Promise<boolean> | boolean
    /** Contenu additionnel (un champ « motif », par exemple). */
    children?: ReactNode
    confirmDisabled?: boolean
}

/**
 * Confirmation d'une action à conséquence (expédier, clôturer, supprimer).
 * Le dialogue ne se referme que si l'action a abouti : une erreur laisse la
 * main à l'utilisateur au lieu de faire disparaître sa décision.
 */
export function ConfirmAction({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    destructive,
    onConfirm,
    children,
    confirmDisabled,
}: ConfirmActionProps) {
    const [busy, setBusy] = useState(false)

    const confirm = async (event: React.MouseEvent) => {
        // Radix referme le dialogue au clic : on garde la main jusqu'au résultat.
        event.preventDefault()
        setBusy(true)
        try {
            if (await onConfirm()) onOpenChange(false)
        } finally {
            setBusy(false)
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="text-sm text-muted-foreground">{description}</div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {children}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={confirm}
                        disabled={busy || confirmDisabled}
                        className={cn(destructive && buttonVariants({ variant: "destructive" }))}
                    >
                        {busy ? "…" : confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
