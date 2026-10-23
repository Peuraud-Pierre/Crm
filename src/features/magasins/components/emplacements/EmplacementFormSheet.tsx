import { useMemo, useState } from "react"
import { MapPin } from "lucide-react"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Switch } from "@/shared/ui/atoms/switch"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/atoms/select"
import { FormSheet } from "@/shared/ui/organisms/form-sheet"
import type {
    EmplacementFormInput,
    EmplacementMagasin,
    ZoneMagasin,
} from "@/features/magasins/types/magasin.types"
import { PATH_SEPARATOR, zoneSegments } from "@/features/magasins/utils/planTree"

export interface EmplacementFormTarget {
    emplacement: EmplacementMagasin | null
    /** Zone proposée à la création (« + Emplacement » depuis un rayon). */
    zoneId?: string
}

interface EmplacementFormSheetProps {
    target: EmplacementFormTarget | null
    zones: readonly ZoneMagasin[]
    onClose: () => void
    onSubmit: (input: EmplacementFormInput) => Promise<boolean>
    onDelete?: () => Promise<boolean>
}

/** Création / modification d'un emplacement. */
export function EmplacementFormSheet({ target, zones, onClose, onSubmit, onDelete }: EmplacementFormSheetProps) {
    // État initialisé à l'ouverture : le parent remonte la sheet (prop `key`)
    // à chaque nouvelle cible.
    const [input, setInput] = useState<EmplacementFormInput>(() => ({
        zone_id: target?.emplacement?.zone_id ?? target?.zoneId ?? "",
        code: target?.emplacement?.code ?? "",
        label: target?.emplacement?.label ?? null,
        notes: target?.emplacement?.notes ?? null,
        is_active: target?.emplacement?.is_active ?? true,
    }))
    const [saving, setSaving] = useState(false)
    const emplacement = target?.emplacement ?? null

    const zoneOptions = useMemo(() => {
        const byId = new Map(zones.map((z) => [z.id, z]))
        return zones
            .map((z) => ({ id: z.id, path: zoneSegments(z.id, byId).join(PATH_SEPARATOR) }))
            .sort((a, b) => a.path.localeCompare(b.path, "fr", { numeric: true }))
    }, [zones])

    const valid = input.code.trim() !== "" && input.zone_id !== ""

    const submit = async () => {
        if (!valid) return
        setSaving(true)
        const ok = await onSubmit({
            ...input,
            code: input.code.trim(),
            label: input.label?.trim() || null,
            notes: input.notes?.trim() || null,
        })
        setSaving(false)
        if (ok) onClose()
    }

    return (
        <FormSheet
            open={target !== null}
            onClose={onClose}
            icon={MapPin}
            title={emplacement ? `Modifier l'emplacement ${emplacement.code}` : "Nouvel emplacement"}
            onSubmit={submit}
            submitDisabled={!valid}
            loading={saving}
            size="md"
            onDelete={onDelete ? async () => { if (await onDelete()) onClose() } : undefined}
            deleteConfirm={{ title: `Supprimer l'emplacement ${emplacement?.code ?? ""} ?` }}
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <Label>Rangé dans</Label>
                    <Select value={input.zone_id} onValueChange={(zone_id) => setInput((prev) => ({ ...prev, zone_id }))}>
                        <SelectTrigger>
                            <SelectValue placeholder="Choisir une zone, un rayon ou un portant" />
                        </SelectTrigger>
                        <SelectContent>
                            {zoneOptions.map((z) => (
                                <SelectItem key={z.id} value={z.id}>
                                    {z.path}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="emplacement-code">Code</Label>
                        <Input
                            id="emplacement-code"
                            value={input.code}
                            placeholder="H1"
                            onChange={(e) => setInput((prev) => ({ ...prev, code: e.target.value }))}
                            autoFocus
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="emplacement-label">Nom (optionnel)</Label>
                        <Input
                            id="emplacement-label"
                            value={input.label ?? ""}
                            placeholder="Tailles S–M"
                            onChange={(e) => setInput((prev) => ({ ...prev, label: e.target.value }))}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="emplacement-notes">Notes</Label>
                    <Textarea
                        id="emplacement-notes"
                        rows={3}
                        value={input.notes ?? ""}
                        onChange={(e) => setInput((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Switch
                        id="emplacement-active"
                        checked={input.is_active}
                        onCheckedChange={(is_active) => setInput((prev) => ({ ...prev, is_active }))}
                    />
                    <Label htmlFor="emplacement-active">Actif</Label>
                </div>
            </div>
        </FormSheet>
    )
}
