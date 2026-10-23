import { Building2 } from "lucide-react"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { FormSheet } from "@/shared/ui/organisms/form-sheet"
import { useState } from "react"
import type { Fournisseur } from "@/features/stock/types/stock.types"

interface FournisseurCreationSheetProps {
    open:     boolean
    onClose:  () => void
    onCreate: (payload: Omit<Fournisseur, "id" | "created_at">) => Promise<Fournisseur | null>
}

export function FournisseurCreationSheet({ open, onClose, onCreate }: FournisseurCreationSheetProps) {
    const [name,    setName]    = useState("")
    const [siege,   setSiege]   = useState("")
    const [tag,     setTag]     = useState("")
    const [loading, setLoading] = useState(false)

    const reset = () => { setName(""); setSiege(""); setTag("") }

    const handleClose = () => { reset(); onClose() }

    const handleCreate = async () => {
        if (!name.trim()) return
        setLoading(true)
        const created = await onCreate({ name: name.trim(), siege_localisation: siege.trim(), tag: tag.trim() })
        setLoading(false)
        // `null` = échec déjà signalé : garder la saisie plutôt que de la vider.
        if (created) handleClose()
    }

    return (
        <FormSheet
            open={open}
            onClose={handleClose}
            icon={Building2}
            title="Nouveau fournisseur"
            size="md"
            onSubmit={handleCreate}
            submitDisabled={!name.trim()}
            loading={loading}
        >

                <div className="flex flex-col gap-5 flex-1 mt-4">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="fourn-name" className="text-sm font-semibold">
                            Nom <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="fourn-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex : Texchange Paris"
                            className="h-10"
                            autoFocus
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="fourn-siege" className="text-sm font-semibold">
                            Localisation du siège
                        </Label>
                        <Input
                            id="fourn-siege"
                            value={siege}
                            onChange={(e) => setSiege(e.target.value)}
                            placeholder="Ex : Lyon, France"
                            className="h-10"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="fourn-tag" className="text-sm font-semibold">
                            Tag de référence
                        </Label>
                        <Input
                            id="fourn-tag"
                            value={tag}
                            onChange={(e) => setTag(e.target.value)}
                            placeholder="Ex : TXP"
                            className="font-mono h-10 uppercase"
                            maxLength={8}
                        />
                        <p className="text-xs text-muted-foreground">
                            Identifiant court utilisé pour les références rapides (max 3 caractères).
                        </p>
                    </div>
                </div>

        </FormSheet>
    )
}