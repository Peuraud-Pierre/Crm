import { X } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { MUR_EPAISSEURS } from "@/features/magasins/constants"
import type { Mur, MurPatch } from "@/features/magasins/types/magasin.types"
import { wallLength } from "@/features/magasins/utils/wall"

interface WallPanelProps {
    mur: Mur
    canEdit: boolean
    onChange: (patch: MurPatch) => void
    onClose: () => void
}

const cm = (m: number) => Math.round(m * 100)

/**
 * Fiche du mur sélectionné : longueur, épaisseur (au choix parmi les
 * épaisseurs courantes), hauteur. Ses points se retouchent sur le plan en
 * mode édition ; la suppression est sous le plan, à droite.
 */
export function WallPanel({ mur, canEdit, onChange, onClose }: WallPanelProps) {
    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <Badge variant="secondary">Mur</Badge>
                    <p className="mt-1 text-base font-semibold text-foreground">
                        {wallLength(mur.points).toLocaleString("fr-FR")} m de long
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {mur.points.length - 1} segment{mur.points.length > 2 ? "s" : ""}
                    </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer la fiche">
                    <X size={16} />
                </Button>
            </div>

            <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Épaisseur</Label>
                    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Épaisseur du mur">
                        {MUR_EPAISSEURS.map((e) => (
                            <Button
                                key={e}
                                variant={cm(e) === cm(mur.epaisseur) ? "default" : "outline"}
                                size="sm"
                                role="radio"
                                aria-checked={cm(e) === cm(mur.epaisseur)}
                                disabled={!canEdit}
                                onClick={() => onChange({ epaisseur: e })}
                            >
                                {cm(e)} cm
                            </Button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="mur-hauteur" className="text-xs text-muted-foreground">
                        Hauteur (m)
                    </Label>
                    {/* `key` : le champ repart de la valeur enregistrée quand le mur change. */}
                    <Input
                        key={`${mur.id}-${mur.hauteur}`}
                        id="mur-hauteur"
                        inputMode="decimal"
                        className="h-9 w-24"
                        defaultValue={mur.hauteur}
                        disabled={!canEdit}
                        onBlur={(e) => {
                            const value = Number(e.target.value.replace(",", "."))
                            if (Number.isFinite(value) && value > 0 && value <= 10 && value !== mur.hauteur) {
                                onChange({ hauteur: Math.round(value * 100) / 100 })
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
