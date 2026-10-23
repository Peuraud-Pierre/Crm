import { useState, type ReactNode } from "react"
import { FileUp, RotateCcw, Trash2 } from "lucide-react"
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
import { Button } from "@/shared/ui/atoms/button"

interface ConfirmSpec {
    title: ReactNode
    description: ReactNode
    confirmLabel: string
    destructive?: boolean
    run: () => Promise<void>
}

interface PackingSheetActionsProps {
    /** Chaque action absente n'est pas rendue — les droits sont résolus par l'appelant. */
    onReopen?: () => Promise<void>
    onReplace?: () => Promise<void>
    onDelete?: () => Promise<void>
    /** « Réessayer avec un autre fichier » plutôt que « Remplacer » après un échec. */
    replaceLabel?: string
}

/**
 * Pied de la sheet packing. Toute action qui défait du travail passe par une
 * confirmation : remplacer ou supprimer une packing emporte la vérification
 * faite à la main, ce qui peut représenter une demi-heure.
 */
export function PackingSheetActions({
    onReopen,
    onReplace,
    onDelete,
    replaceLabel = "Remplacer le fichier",
}: PackingSheetActionsProps) {
    const [pending, setPending] = useState<ConfirmSpec | null>(null)
    const [running, setRunning] = useState(false)

    const confirm = async () => {
        if (!pending) return
        setRunning(true)
        try {
            await pending.run()
            setPending(null)
        } finally {
            setRunning(false)
        }
    }

    return (
        <>
            {/*
              * Un seul conteneur flex, et non deux imbriqués : le pied de
              * `DetailSheet` est déjà en `flex flex-row`, et il est partagé avec
              * d'autres features — le rendre responsive là-bas changerait leurs
              * pieds de sheet aussi. Ce wrapper prend donc toute la largeur du
              * seul enfant qu'il lui donne, et empile sous 640 px : trois boutons
              * côte à côte ne tiennent pas sur 360 px.
              */}
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                {onDelete && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                        onClick={() =>
                            setPending({
                                title: "Supprimer la packing list ?",
                                description:
                                    "Les lignes et toute la vérification faite sont supprimées. L'arrivage et ses totaux saisis ne changent pas.",
                                confirmLabel: "Supprimer",
                                destructive: true,
                                run: onDelete,
                            })
                        }
                    >
                        <Trash2 size={13} aria-hidden />
                        Supprimer
                    </Button>
                )}

                <div className="flex flex-col gap-2 sm:flex-1 sm:flex-row sm:justify-end">
                    {onReplace && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full gap-1.5 sm:w-auto"
                            onClick={() =>
                                setPending({
                                    title: `${replaceLabel} ?`,
                                    description:
                                        "La packing list actuelle et sa vérification sont supprimées, puis vous pourrez déposer un nouveau fichier.",
                                    confirmLabel: "Continuer",
                                    destructive: true,
                                    run: onReplace,
                                })
                            }
                        >
                            <FileUp size={13} aria-hidden />
                            {replaceLabel}
                        </Button>
                    )}

                    {onReopen && (
                        <Button
                            type="button"
                            size="sm"
                            className="w-full gap-1.5 sm:w-auto"
                            onClick={() =>
                                setPending({
                                    title: "Rouvrir la vérification ?",
                                    description:
                                        "La packing list repasse « À vérifier » : les catégories redeviennent modifiables et il faudra la valider de nouveau.",
                                    confirmLabel: "Rouvrir",
                                    run: onReopen,
                                })
                            }
                        >
                            <RotateCcw size={13} aria-hidden />
                            Rouvrir la vérification
                        </Button>
                    )}
                </div>
            </div>

            <AlertDialog
                open={pending !== null}
                onOpenChange={(next) => {
                    if (!next && !running) setPending(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
                        <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={running}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                // Sans preventDefault, Radix referme avant la fin de l'appel.
                                event.preventDefault()
                                confirm()
                            }}
                            disabled={running}
                            className={
                                pending?.destructive
                                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    : undefined
                            }
                        >
                            {running ? "En cours…" : pending?.confirmLabel}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
