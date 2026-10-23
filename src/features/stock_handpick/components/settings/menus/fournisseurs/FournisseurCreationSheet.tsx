import { useState } from "react"
import { Building2 } from "lucide-react"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { FormSheet } from "@/shared/ui/organisms/form-sheet"

interface FournisseurCreationSheetProps {
    open: boolean
    onClose: () => void
    /**
     * Vrai si la création a abouti — la sheet ne se referme qu'alors, sans
     * quoi un nom refusé (déjà utilisé) faisait perdre toute la saisie.
     */
    onCreate: (payload: {
        name: string
        siege_localisation: string | null
        tag: string | null
        notes: string | null
        is_active: boolean
    }) => Promise<boolean>
}

export function FournisseurCreationSheet({
    open,
    onClose,
    onCreate,
}: FournisseurCreationSheetProps) {
    const [name, setName] = useState("")
    const [tag, setTag] = useState("")
    const [notes, setNotes] = useState("")
    const [loading, setLoading] = useState(false)

    const reset = () => {
        setName("")
        setTag("")
        setNotes("")
    }

    const handleClose = () => {
        reset()
        onClose()
    }

    const handleCreate = async () => {
        if (!name.trim()) return
        setLoading(true)
        try {
            // Plus de localisation ni de catégories proposées : la colonne
            // reste en base, les nouvelles usines la laissent vide.
            const created = await onCreate({
                name: name.trim(),
                siege_localisation: null,
                tag: tag.trim() || null,
                notes: notes.trim() || null,
                is_active: true,
            })
            if (created) handleClose()
        } finally {
            setLoading(false)
        }
    }

    return (
        <FormSheet
            open={open}
            onClose={handleClose}
            icon={Building2}
            title="Nouvelle usine"
            size="md"
            onSubmit={handleCreate}
            submitLabel="Créer"
            submitDisabled={!name.trim()}
            loading={loading}
        >
            <div className="flex flex-col gap-2">
                <Label
                    htmlFor="hp-fournisseur-name"
                    className="text-sm font-semibold"
                >
                    Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                    id="hp-fournisseur-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ex : Textiles SA"
                    className="h-10"
                    autoFocus
                />
            </div>


            <div className="flex flex-col gap-2">
                <Label
                    htmlFor="hp-fournisseur-tag"
                    className="text-sm font-semibold"
                >
                    Tag
                </Label>
                <Input
                    id="hp-fournisseur-tag"
                    value={tag}
                    onChange={(event) => setTag(event.target.value)}
                    placeholder="Ex : TEX"
                    className="h-10 font-mono"
                />
            </div>


            <div className="flex flex-col gap-2">
                <Label
                    htmlFor="hp-fournisseur-notes"
                    className="text-sm font-semibold"
                >
                    Notes
                </Label>
                <Textarea
                    id="hp-fournisseur-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Informations utiles sur cette usine…"
                    rows={3}
                />
            </div>
        </FormSheet>
    )
}
