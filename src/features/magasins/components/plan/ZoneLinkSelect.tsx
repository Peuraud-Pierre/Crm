import { Label } from "@/shared/ui/atoms/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/atoms/select"

/** Valeur du choix « aucune zone » : Radix refuse une valeur vide. */
const NONE = "none"

export interface ZoneLink {
    value: string | null
    /** Zones, rayons et portants de l'étage, par leur chemin. */
    options: { id: string; path: string }[]
    onChange: (zoneId: string | null) => void
}

/** Rattachement d'un mannequin à une zone, un rayon ou un portant. */
export function ZoneLinkSelect({ value, options, onChange }: ZoneLink) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor="mannequin-zone" className="text-xs text-muted-foreground">
                Rattaché à
            </Label>
            <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
                <SelectTrigger id="mannequin-zone" className="h-9 w-full sm:w-72">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={NONE}>Aucune zone</SelectItem>
                    {options.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                            {o.path}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
