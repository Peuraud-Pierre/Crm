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

interface PackingBulkConfirmDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /**
     * `suggestions` : accepter en bloc ce que la machine a proposé.
     * `selection`   : donner une catégorie CHOISIE à des libellés cochés.
     *
     * Les deux gestes touchent plusieurs libellés d'un coup et s'arrêtent tous
     * deux aux lignes non classées, mais ce qu'ils engagent n'a rien à voir :
     * le premier retient des propositions que personne n'a vérifiées, le second
     * applique une décision humaine. Un seul texte pour les deux mentirait sur
     * l'un ou sur l'autre.
     */
    mode: "suggestions" | "selection"
    count: number
    /** Mode `selection` : la catégorie retenue, nommée dans la question. */
    categoryLabel?: string
    onConfirm: () => void
}

/**
 * Garde-fou des gestes qui touchent plusieurs libellés d'un coup.
 */
export function PackingBulkConfirmDialog({
    open,
    onOpenChange,
    mode,
    count,
    categoryLabel = "",
    onConfirm,
}: PackingBulkConfirmDialogProps) {
    const suggestions = mode === "suggestions"

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {suggestions
                            ? `Confirmer ${count} propositions d'un coup ?`
                            : `Classer ${count} libellés dans « ${categoryLabel} » ?`}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {suggestions ? (
                            <>
                                Les catégories proposées seront retenues telles quelles pour ces {count}{" "}
                                libellés. Ces propositions n'ont pas atteint la confiance qui permet au modèle
                                de classer seul : elles peuvent intervertir deux marques proches. Les libellés
                                sans proposition resteront à classer.
                            </>
                        ) : (
                            <>
                                « {categoryLabel} » sera attribuée aux lignes encore non classées de ces {count}{" "}
                                libellés. Les lignes que vous avez déjà réattribuées à la main gardent leur
                                catégorie.
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(event) => {
                            // Sans preventDefault, Radix referme avant la fin de l'appel.
                            event.preventDefault()
                            onConfirm()
                            onOpenChange(false)
                        }}
                    >
                        {suggestions ? "Confirmer tout" : "Classer la sélection"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
