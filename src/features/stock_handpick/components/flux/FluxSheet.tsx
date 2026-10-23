import { useEffect, useRef, useState } from "react"
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import { FormSheet } from "@/shared/ui/organisms/form-sheet"
import type {
    FluxFormInput,
    FluxHandpickRow,
    MouvementDirection,
} from "@/features/stock_handpick/types/flux.types"
import { FluxForm, emptyFluxForm, toFluxFormInput } from "./FluxForm"

interface FluxSheetProps {
    open: boolean
    /** `null` = création. */
    flux: FluxHandpickRow | null
    /** Sens du tableau depuis lequel la création a été lancée. */
    defaultDirection: MouvementDirection
    /** Droit de création : gate le formulaire quand `flux` est `null`. */
    canCreate: boolean
    /** Droit de modification : gate le formulaire d'une expédition existante. */
    canUpdate: boolean
    canDelete: boolean
    onClose: () => void
    /** Vrai si l'écriture a abouti : la sheet ne se referme qu'à cette condition. */
    onSubmit: (payload: FluxFormInput) => Promise<boolean>
    /** Vrai si la suppression a abouti. */
    onDelete?: () => Promise<boolean>
}

/**
 * Formulaire de l'EN-TÊTE d'une expédition : le transport, les dates, la
 * facture. Rien de son contenu.
 *
 * La liste de colisage vit dans `FluxDetailSheet`, la fiche de lecture. Ce
 * docblock affirmait le contraire, et `LignesPanel` était bien importé ici —
 * mais jamais rendu, si bien que le colisage n'était atteignable nulle part.
 * La séparation est maintenant délibérée : ce panneau écrit immédiatement,
 * alors que `FormSheet` est un contrat brouillon → submit → close, et c'est
 * leur cohabitation qui avait imposé le contournement `seedKey` ci-dessous.
 *
 * À la création, l'expédition n'a pas encore d'identifiant, donc rien à quoi
 * rattacher une ligne : on enregistre l'en-tête d'abord, et `FluxTab` ouvre
 * ensuite la fiche de l'expédition créée, où le colisage se saisit. C'est aussi
 * le modèle que le stock principal prévoit pour ses imports de packing list —
 * attacher le détail à un arrivage qui existe déjà.
 *
 * Le droit qui ouvre le formulaire dépend du mode : `canCreate` pour une
 * création, `canUpdate` pour une modification. Les confondre gatait la
 * création sur `update` — un compte qui n'avait que `flux.create` voyait le
 * bouton « Nouvel arrivage » et un formulaire grisé sans bouton Créer.
 */
export function FluxSheet({
    open,
    flux,
    defaultDirection,
    canCreate,
    canUpdate,
    canDelete,
    onClose,
    onSubmit,
    onDelete,
}: FluxSheetProps) {
    const [draft, setDraft] = useState<FluxFormInput>(() => emptyFluxForm(defaultDirection))
    const [saving, setSaving] = useState(false)

    // Ce qu'identifie le brouillon en cours : l'expédition ouverte, ou le sens
    // d'une création. Le refetch du realtime reconstruit la liste, donc l'objet
    // `flux` change d'identité à chaque salve sans que l'expédition ouverte
    // change. Réamorcer sur l'objet écrasait la saisie en cours ; on réamorce
    // sur l'identité.
    //
    // La salve la plus fréquente venait des lignes de colisage, saisies à
    // l'époque depuis cette sheet. Elles ont depuis rejoint `FluxDetailSheet`,
    // mais une écriture sur l'en-tête en produit une aussi : la garde reste
    // nécessaire.
    //
    // Fermer la sheet oublie l'identité : rouvrir la même expédition après une
    // saisie abandonnée repart des valeurs du serveur, pas du brouillon annulé.
    const seedKey = !open ? null : flux ? flux.id : `new:${defaultDirection}`
    const seededForRef = useRef<string | null>(null)

    useEffect(() => {
        if (seedKey === null) {
            seededForRef.current = null
            return
        }
        if (seededForRef.current === seedKey) return
        seededForRef.current = seedKey
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setDraft(flux ? toFluxFormInput(flux) : emptyFluxForm(defaultDirection))
    }, [seedKey, flux, defaultDirection])

    const canWrite = flux ? canUpdate : canCreate

    const handleSubmit = async () => {
        setSaving(true)
        try {
            // En échec, le contexte a déjà signalé l'erreur : on garde la
            // sheet ouverte pour que la saisie ne soit pas perdue.
            if (await onSubmit(draft)) onClose()
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!onDelete) return
        setSaving(true)
        try {
            if (await onDelete()) onClose()
        } finally {
            setSaving(false)
        }
    }

    const Icon = draft.direction === "in" ? ArrowDownToLine : ArrowUpFromLine
    const noun = draft.direction === "in" ? "arrivage" : "départ"
    const lignes = flux?.lignes_count ?? 0

    return (
        <FormSheet
            open={open}
            onClose={onClose}
            icon={Icon}
            title={flux ? `Modifier l'${noun}` : `Nouvel ${noun}`}
            description={
                flux
                    ? "L'en-tête décrit le transport ; la liste de colisage, ce qu'il contient."
                    : "Enregistrez l'en-tête : la liste de colisage se saisit ensuite."
            }
            onSubmit={canWrite ? handleSubmit : undefined}
            submitLabel={flux ? "Enregistrer" : "Créer"}
            loading={saving}
            onDelete={flux && canDelete && onDelete ? handleDelete : undefined}
            deleteLabel={`Supprimer l'${noun}`}
            deleteConfirm={{
                title: `Supprimer l'${noun} ?`,
                // Les lignes partent avec l'en-tête (`ON DELETE CASCADE`) : le
                // dire, sans quoi on croit ne supprimer qu'un en-tête.
                description:
                    lignes > 0
                        ? `Sa liste de colisage est supprimée avec lui : ${lignes} ligne${lignes > 1 ? "s" : ""}. Cette action est définitive.`
                        : "Cette action est définitive.",
            }}
        >
            <FluxForm value={draft} onChange={setDraft} disabled={saving || !canWrite} />
        </FormSheet>
    )
}
