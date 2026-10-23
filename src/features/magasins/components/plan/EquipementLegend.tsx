import { EQUIPEMENT_KIND_LABEL } from "@/features/magasins/constants"
import { EQUIPEMENT_COLOR_VAR, STAIRS_DOWN_COLOR_VAR } from "@/features/magasins/theme"
import type { EquipementKind } from "@/features/magasins/types/magasin.types"

const EQUIPEMENT_KINDS: EquipementKind[] = ["entree", "sortie", "entree_sortie", "caisse", "escalier", "escalier_colimacon", "mannequin"]

/** Légende des couleurs d'équipement, sous le plan. */
export function EquipementLegend() {
    return (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Légende des équipements">
            {EQUIPEMENT_KINDS.map((kind) => (
                <li key={kind} className="flex items-center gap-1.5">
                    <span aria-hidden className="size-2.5 rounded-sm" style={{ background: `hsl(var(${EQUIPEMENT_COLOR_VAR[kind]}))` }} />
                    {EQUIPEMENT_KIND_LABEL[kind]}
                </li>
            ))}
            <li className="flex items-center gap-1.5">
                <span
                    aria-hidden
                    className="size-2.5 rounded-sm border border-dashed"
                    style={{ background: `hsl(var(${STAIRS_DOWN_COLOR_VAR}))` }}
                />
                Escalier qui descend
            </li>
        </ul>
    )
}
