import { useMemo, useState } from "react"
import { Layers } from "lucide-react"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Switch } from "@/shared/ui/atoms/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/atoms/select"
import { FormSheet } from "@/shared/ui/organisms/form-sheet"
import { ALLOWED_PARENT_KINDS, ZONE_KIND_LABEL } from "@/features/magasins/constants"
import { chartColorHex } from "@/features/magasins/theme"
import type { ZoneFormInput, ZoneKind, ZoneMagasin } from "@/features/magasins/types/magasin.types"
import { descendantZoneIds, PATH_SEPARATOR, zoneSegments } from "@/features/magasins/utils/planTree"

export interface ZoneFormTarget {
    /** Zone modifiée, ou `null` pour une création. */
    zone: ZoneMagasin | null
    /** Valeurs proposées à la création (« + Rayon » depuis une zone). */
    defaults?: Partial<Pick<ZoneFormInput, "kind" | "parent_id">>
}

interface ZoneFormSheetProps {
    target: ZoneFormTarget | null
    zones: readonly ZoneMagasin[]
    onClose: () => void
    onSubmit: (input: ZoneFormInput) => Promise<boolean>
    /** Absent : pas de droit de suppression, ou création. */
    onDelete?: () => Promise<boolean>
    /** Emplacements emportés par la suppression (cascade). */
    emplacementCount: number
}

const KINDS: ZoneKind[] = ["zone", "rayon", "etagere"]

function emptyInput(defaults?: ZoneFormTarget["defaults"]): ZoneFormInput {
    return {
        kind: defaults?.kind ?? "zone",
        parent_id: defaults?.parent_id ?? null,
        code: "",
        label: null,
        color: null,
        is_active: true,
    }
}

function initialInput(target: ZoneFormTarget | null): ZoneFormInput {
    const zone = target?.zone
    if (!zone) return emptyInput(target?.defaults)
    return {
        kind: zone.kind,
        parent_id: zone.parent_id,
        code: zone.code,
        label: zone.label,
        color: zone.color,
        is_active: zone.is_active,
    }
}

/** Création / modification d'une zone, d'un rayon ou d'un portant. */
export function ZoneFormSheet({ target, zones, onClose, onSubmit, onDelete, emplacementCount }: ZoneFormSheetProps) {
    // État initialisé à l'ouverture : le parent remonte la sheet (prop `key`)
    // à chaque nouvelle cible.
    const [input, setInput] = useState<ZoneFormInput>(() => initialInput(target))
    const [saving, setSaving] = useState(false)
    const zone = target?.zone ?? null

    const zonesById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones])

    // Parents possibles : du bon niveau, et jamais la zone elle-même ou sa
    // descendance (le trigger refuserait le cycle).
    const parentOptions = useMemo(() => {
        const excluded = new Set(zone ? descendantZoneIds(zone.id, zones) : [])
        return zones
            .filter((z) => ALLOWED_PARENT_KINDS[input.kind].includes(z.kind) && !excluded.has(z.id))
            .map((z) => ({ id: z.id, path: zoneSegments(z.id, zonesById).join(PATH_SEPARATOR) }))
            .sort((a, b) => a.path.localeCompare(b.path, "fr", { numeric: true }))
    }, [zones, zonesById, zone, input.kind])

    const needsParent = input.kind !== "zone"
    const valid = input.code.trim() !== "" && (!needsParent || Boolean(input.parent_id))
    const noun = ZONE_KIND_LABEL[input.kind].toLowerCase()

    const submit = async () => {
        if (!valid) return
        setSaving(true)
        const ok = await onSubmit({
            ...input,
            code: input.code.trim(),
            label: input.label?.trim() || null,
            parent_id: needsParent ? input.parent_id : null,
        })
        setSaving(false)
        if (ok) onClose()
    }

    return (
        <FormSheet
            open={target !== null}
            onClose={onClose}
            icon={Layers}
            title={zone ? `Modifier ${zone.code}` : `Nouveau niveau`}
            description="Les zones contiennent des rayons, qui contiennent des portants ; un emplacement se range dans l'un d'eux."
            onSubmit={submit}
            submitDisabled={!valid}
            loading={saving}
            size="md"
            onDelete={onDelete ? async () => { if (await onDelete()) onClose() } : undefined}
            deleteConfirm={{
                title: `Supprimer ${zone?.code ?? ""} ?`,
                description:
                    emplacementCount > 0
                        ? `Ses sous-niveaux et ${emplacementCount} emplacement${emplacementCount > 1 ? "s" : ""} seront supprimés avec lui.`
                        : "Ses sous-niveaux seront supprimés avec lui.",
            }}
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <Label>Type</Label>
                    <Select
                        value={input.kind}
                        disabled={Boolean(zone)}
                        onValueChange={(kind) => setInput((prev) => ({ ...prev, kind: kind as ZoneKind, parent_id: null }))}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {KINDS.map((k) => (
                                <SelectItem key={k} value={k}>
                                    {ZONE_KIND_LABEL[k]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {needsParent && (
                    <div className="flex flex-col gap-1.5">
                        <Label>Rattaché à</Label>
                        <Select
                            value={input.parent_id ?? ""}
                            onValueChange={(parent_id) => setInput((prev) => ({ ...prev, parent_id }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={parentOptions.length ? "Choisir…" : "Aucun parent possible : créez d'abord une zone"} />
                            </SelectTrigger>
                            <SelectContent>
                                {parentOptions.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.path}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="zone-code">Code</Label>
                        <Input
                            id="zone-code"
                            value={input.code}
                            placeholder={input.kind === "zone" ? "A" : input.kind === "rayon" ? "R1" : "P1"}
                            onChange={(e) => setInput((prev) => ({ ...prev, code: e.target.value }))}
                            autoFocus
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="zone-label">Nom (optionnel)</Label>
                        <Input
                            id="zone-label"
                            value={input.label ?? ""}
                            placeholder={`Nom du ${noun}`}
                            onChange={(e) => setInput((prev) => ({ ...prev, label: e.target.value }))}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                        <Switch
                            id="zone-color-custom"
                            checked={input.color !== null}
                            // Part de la couleur automatique, que l'utilisateur ajuste.
                            onCheckedChange={(on) => setInput((prev) => ({ ...prev, color: on ? chartColorHex(0) : null }))}
                        />
                        <Label htmlFor="zone-color-custom">Couleur personnalisée</Label>
                    </div>
                    {input.color !== null && (
                        <input
                            type="color"
                            aria-label="Couleur"
                            value={input.color}
                            onChange={(e) => setInput((prev) => ({ ...prev, color: e.target.value }))}
                            className="h-9 w-14 cursor-pointer rounded-md border border-border bg-background"
                        />
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Switch
                        id="zone-active"
                        checked={input.is_active}
                        onCheckedChange={(is_active) => setInput((prev) => ({ ...prev, is_active }))}
                    />
                    <Label htmlFor="zone-active">Actif</Label>
                </div>
            </div>
        </FormSheet>
    )
}
