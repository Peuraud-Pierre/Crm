import { useEffect, useRef, useState } from "react"
import { Boxes } from "lucide-react"
import { FormSheet } from "@/shared/ui/organisms/form-sheet"
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
import { UUID_DISPLAY_LENGTH } from "@/features/stock_handpick/constants"
import type {
    BalleHandpick,
    BalleHandpickFormInput,
} from "@/features/stock_handpick/types/balle.types"
import {
    buildLotPayloads,
    emptyLine,
    type BalleLotLine,
} from "@/features/stock_handpick/utils/balleLot"
import { BalleForm, EMPTY_BALLE_FORM } from "./BalleForm"
import { BalleLotLines } from "./BalleLotLines"

interface BalleSheetProps {
    open: boolean
    /** `null` = création ; sinon édition de cette balle. */
    balle: BalleHandpick | null
    canDelete: boolean
    onClose: () => void
    /** Édition d'une balle. Vrai si l'écriture a abouti : la sheet ne se referme qu'alors. */
    onSubmit: (payload: BalleHandpickFormInput) => Promise<boolean>
    /** Création en lot, tout ou rien. Vrai si toutes les balles ont été créées. */
    onCreateMany: (payloads: BalleHandpickFormInput[]) => Promise<boolean>
    /** Vrai si la suppression a abouti. */
    onDelete?: () => Promise<boolean>
}

function toFormInput(balle: BalleHandpick): BalleHandpickFormInput {
    return {
        packing: balle.packing,
        packing_mode: balle.packing_mode,
        import_date: balle.import_date,
        fournisseur_id: balle.fournisseur_id,
        category_id: balle.category_id,
        raw_name: balle.raw_name,
        provenance: balle.provenance,
        is_original: balle.is_original,
        parent_balle_id: balle.parent_balle_id,
        status: balle.status,
        location: balle.location,
        type: balle.type,
        emplacement_id: balle.emplacement_id,
        purchase_price: balle.purchase_price,
        treatment_cost: balle.treatment_cost,
        notes: balle.notes,
    }
}

/**
 * Sheet unique pour la création et l'édition, sur le même `BalleForm`.
 * La création se fait EN LOT : champs communs (usine, date, statut…) une
 * fois, puis une ligne par balle (`BalleLotLines`). L'édition reste à une
 * balle.
 *
 * L'ouverture est pilotée par le segment `detail` de l'URL, jamais par un
 * state local (docs/ROUTING.md) — d'où la resynchronisation du brouillon quand
 * la balle ciblée change.
 *
 * Le brouillon se réamorce sur l'IDENTITÉ de la balle, pas sur l'objet : la
 * table est publiée en realtime, et chaque écriture sur l'inventaire (un
 * collègue, une assignation d'emplacement) reconstruit la liste — donc un
 * nouvel objet pour la même balle. Réamorcer sur l'objet écrasait la saisie en
 * cours. Même garde que `FluxSheet`, et même oubli à la fermeture : rouvrir
 * repart des valeurs du serveur, pas d'un brouillon abandonné.
 */
export function BalleSheet({
    open,
    balle,
    canDelete,
    onClose,
    onSubmit,
    onCreateMany,
    onDelete,
}: BalleSheetProps) {
    const [draft, setDraft] = useState<BalleHandpickFormInput>(EMPTY_BALLE_FORM)
    const [lines, setLines] = useState<BalleLotLine[]>(() => [emptyLine()])
    const [saving, setSaving] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)

    const seedKey = !open ? null : balle ? balle.id : "new"
    const seededForRef = useRef<string | null>(null)

    useEffect(() => {
        if (seedKey === null) {
            seededForRef.current = null
            return
        }
        if (seededForRef.current === seedKey) return
        seededForRef.current = seedKey
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setDraft(balle ? toFormInput(balle) : EMPTY_BALLE_FORM)
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setLines([emptyLine()])
    }, [seedKey, balle])

    const handleSubmit = async () => {
        setSaving(true)
        try {
            // En échec, le contexte a déjà signalé l'erreur : la sheet reste
            // ouverte pour que la saisie ne soit pas perdue.
            const ok = balle
                ? await onSubmit(draft)
                : await onCreateMany(buildLotPayloads(draft, lines))
            if (ok) onClose()
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!onDelete) return
        setSaving(true)
        try {
            if (await onDelete()) {
                setConfirmDelete(false)
                onClose()
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <FormSheet
                open={open}
                onClose={onClose}
                icon={Boxes}
                title={balle ? "Modifier la balle" : "Nouvelles balles"}
                // Une balle n'a pas de code lisible : son identifiant technique
                // tronqué tient lieu de sous-titre.
                description={
                    balle ? balle.id.slice(0, UUID_DISPLAY_LENGTH) : undefined
                }
                onSubmit={handleSubmit}
                submitLabel={
                    balle
                        ? "Enregistrer"
                        : lines.length > 1
                          ? `Créer ${lines.length} balles`
                          : "Créer la balle"
                }
                loading={saving}
                onDelete={
                    balle && canDelete && onDelete
                        ? () => setConfirmDelete(true)
                        : undefined
                }
                deleteLabel="Supprimer la balle"
            >
                <BalleForm
                    value={draft}
                    onChange={setDraft}
                    disabled={saving}
                    lotLines={
                        balle ? undefined : (
                            <BalleLotLines lines={lines} onChange={setLines} disabled={saving} />
                        )
                    }
                />
            </FormSheet>

            <AlertDialog
                open={confirmDelete}
                onOpenChange={(value) => {
                    if (!value && !saving) setConfirmDelete(false)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Supprimer cette balle ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Les mouvements déjà enregistrés la concernant sont
                            conservés, avec le libellé figé au moment du
                            mouvement. Cette action est définitive.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={saving}>
                            Annuler
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault()
                                handleDelete()
                            }}
                            disabled={saving}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {saving ? "Suppression…" : "Supprimer"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
