import { useState } from "react"
import { Store } from "lucide-react"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Switch } from "@/shared/ui/atoms/switch"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { FormSheet } from "@/shared/ui/organisms/form-sheet"
import type { Magasin, MagasinFormInput } from "@/features/magasins/types/magasin.types"

interface MagasinFormSheetProps {
    open: boolean
    /** Magasin modifié, ou `null` pour une création. */
    magasin: Magasin | null
    onClose: () => void
    onSubmit: (input: MagasinFormInput) => Promise<boolean>
    onDelete?: () => Promise<boolean>
}

interface Draft {
    code: string
    nom: string
    adresse: string
    ville: string
    largeur: string
    profondeur: string
    notes: string
    is_active: boolean
}

const toDraft = (m: Magasin | null): Draft => ({
    code: m?.code ?? "",
    nom: m?.nom ?? "",
    adresse: m?.adresse ?? "",
    ville: m?.ville ?? "",
    largeur: String(m?.largeur ?? 20),
    profondeur: String(m?.profondeur ?? 15),
    notes: m?.notes ?? "",
    is_active: m?.is_active ?? true,
})

const positive = (value: string) => {
    const n = Number(value.replace(",", "."))
    return Number.isFinite(n) && n > 0 ? n : null
}

/** Création / modification d'un magasin et de l'emprise de son plan. */
export function MagasinFormSheet({ open, magasin, onClose, onSubmit, onDelete }: MagasinFormSheetProps) {
    // État initialisé à l'ouverture : le parent remonte la sheet (prop `key`)
    // à chaque ouverture.
    const [draft, setDraft] = useState<Draft>(() => toDraft(magasin))
    const [saving, setSaving] = useState(false)

    const largeur = positive(draft.largeur)
    const profondeur = positive(draft.profondeur)
    const valid = draft.code.trim() !== "" && draft.nom.trim() !== "" && largeur !== null && profondeur !== null
    const set = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }))

    const submit = async () => {
        if (!valid || largeur === null || profondeur === null) return
        setSaving(true)
        const ok = await onSubmit({
            code: draft.code.trim(),
            nom: draft.nom.trim(),
            adresse: draft.adresse.trim() || null,
            ville: draft.ville.trim() || null,
            largeur,
            profondeur,
            notes: draft.notes.trim() || null,
            is_active: draft.is_active,
        })
        setSaving(false)
        if (ok) onClose()
    }

    return (
        <FormSheet
            open={open}
            onClose={onClose}
            icon={Store}
            title={magasin ? `Modifier ${magasin.nom}` : "Nouveau magasin"}
            description="Les dimensions fixent l'emprise du plan, en mètres."
            onSubmit={submit}
            submitDisabled={!valid}
            loading={saving}
            size="md"
            onDelete={onDelete ? async () => { if (await onDelete()) onClose() } : undefined}
            deleteConfirm={{
                title: `Supprimer ${magasin?.nom ?? "ce magasin"} ?`,
                description: "Son plan, ses zones et tous ses emplacements seront supprimés. Pour le garder en archive, désactivez-le plutôt.",
            }}
        >
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="magasin-code">Code</Label>
                        <Input id="magasin-code" value={draft.code} placeholder="PAR1" onChange={(e) => set({ code: e.target.value })} autoFocus />
                    </div>
                    <div className="col-span-2 flex flex-col gap-1.5">
                        <Label htmlFor="magasin-nom">Nom</Label>
                        <Input id="magasin-nom" value={draft.nom} placeholder="Nokk_project Paris Marais" onChange={(e) => set({ nom: e.target.value })} />
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 flex flex-col gap-1.5">
                        <Label htmlFor="magasin-adresse">Adresse</Label>
                        <Input id="magasin-adresse" value={draft.adresse} onChange={(e) => set({ adresse: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="magasin-ville">Ville</Label>
                        <Input id="magasin-ville" value={draft.ville} onChange={(e) => set({ ville: e.target.value })} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="magasin-largeur">Largeur (m)</Label>
                        <Input id="magasin-largeur" inputMode="decimal" value={draft.largeur} onChange={(e) => set({ largeur: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="magasin-profondeur">Profondeur (m)</Label>
                        <Input id="magasin-profondeur" inputMode="decimal" value={draft.profondeur} onChange={(e) => set({ profondeur: e.target.value })} />
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="magasin-notes">Notes</Label>
                    <Textarea id="magasin-notes" rows={3} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                    <Switch id="magasin-active" checked={draft.is_active} onCheckedChange={(is_active) => set({ is_active })} />
                    <Label htmlFor="magasin-active">Magasin actif</Label>
                </div>
            </div>
        </FormSheet>
    )
}
