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
import type { PackingTeaching } from "@/features/stock/utils/packingLearning"

interface PackingValidateDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    teaching: PackingTeaching
    onConfirm: () => void
}

/**
 * Ce que ce conteneur enseigne, dit au seul moment où on peut encore le dire.
 *
 * Après `validate_packing_list`, les lignes sont rechargées et la distinction
 * entre « tranché à la main » et « repris du tableau » a disparu — l'occasion
 * de rapporter le travail à son résultat ne revient pas.
 *
 * Le dialogue n'est pas une cérémonie : il n'apparaît que s'il y a réellement
 * quelque chose d'appris (voir `PackingListSheet`). Un conteneur entièrement
 * couvert par le tableau de correspondance se valide sans rien demander.
 */
export function PackingValidateDialog({
    open,
    onOpenChange,
    teaching,
    onConfirm,
}: PackingValidateDialogProps) {
    const { created, updated, fromModel } = teaching
    const s = created > 1 ? "s" : ""

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Valider et enregistrer {created} nouvelle{s} correspondance{s} ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Les {created} libellé{s} que vous avez classé{s} entre{created > 1 ? "nt" : ""} dans le
                        tableau de correspondance : ils seront reconnus d'office sur les prochains conteneurs.
                        {updated > 0 && (
                            <>
                                {" "}
                                {updated} met{updated > 1 ? "tent" : ""} à jour une correspondance existante.
                            </>
                        )}
                        {fromModel > 0 && (
                            <>
                                {" "}
                                Les {fromModel} libellé{fromModel > 1 ? "s" : ""} classé
                                {fromModel > 1 ? "s" : ""} par le modèle n'y entre
                                {fromModel > 1 ? "nt" : ""} pas — une supposition, même juste, ne devient pas
                                une correspondance.
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
                        }}
                    >
                        Valider la packing list
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
