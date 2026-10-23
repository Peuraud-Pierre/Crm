import { BrickWall, DoorOpen, Minus, PersonStanding, Footprints, PenTool, RotateCw, Plus, Save, ShoppingCart, SquareDashedMousePointer, Spline } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/shared/ui/atoms/dropdown-menu"
import { EQUIPEMENT_KIND_LABEL } from "@/features/magasins/constants"
import type { EquipementKind } from "@/features/magasins/types/magasin.types"

/** `wallLine` : mur droit, deux clics ; `wall` : mur à plusieurs angles. */
export type PlanEditTool = "draw" | "sketch" | "wall" | "wallLine" | "contour" | null

const EQUIPEMENT_KINDS: EquipementKind[] = ["entree", "sortie", "entree_sortie", "caisse", "escalier", "escalier_colimacon", "mannequin"]

const EQUIPEMENT_ICON: Record<EquipementKind, typeof DoorOpen> = {
    entree: DoorOpen,
    sortie: DoorOpen,
    entree_sortie: DoorOpen,
    caisse: ShoppingCart,
    escalier: Footprints,
    escalier_colimacon: RotateCw,
    mannequin: PersonStanding,
}

interface PlanEditToolbarProps {
    canCreate: boolean
    saving: boolean
    /** Nombre d'éléments déplacés ou redimensionnés, non enregistrés. */
    changes: number
    tool: PlanEditTool
    onToolChange: (tool: PlanEditTool) => void
    onAddEquipement: (kind: EquipementKind) => void
    onCancel: () => void
    onSave: () => void
    /** Table des murs absente (migration non passée) : outil Mur indisponible. */
    wallsUnavailable?: boolean
}

/**
 * Barre d'outils du mode « Modifier le plan » : ajout de caisses et de
 * portes, zone rectangulaire, forme libre point par point, contour de
 * l'étage, annuler / enregistrer.
 * Un seul outil à la fois : recliquer l'outil actif le relâche.
 */
export function PlanEditToolbar({
    canCreate,
    saving,
    changes,
    tool,
    onToolChange,
    onAddEquipement,
    onCancel,
    onSave,
    wallsUnavailable = false,
}: PlanEditToolbarProps) {
    const toggle = (next: Exclude<PlanEditTool, null>) => onToolChange(tool === next ? null : next)

    return (
        <>
            {canCreate && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={saving}>
                            <Plus size={14} /> Ajouter
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {EQUIPEMENT_KINDS.map((kind) => {
                            const Icon = EQUIPEMENT_ICON[kind]
                            return (
                                <DropdownMenuItem key={kind} onSelect={() => onAddEquipement(kind)}>
                                    <Icon size={14} />
                                    {EQUIPEMENT_KIND_LABEL[kind]}
                                </DropdownMenuItem>
                            )
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            {canCreate && (
                <Button variant={tool === "draw" ? "default" : "outline"} size="sm" aria-pressed={tool === "draw"} onClick={() => toggle("draw")}>
                    <SquareDashedMousePointer size={14} /> Dessiner une zone
                </Button>
            )}
            {canCreate && (
                <Button
                    variant={tool === "sketch" ? "default" : "outline"}
                    size="sm"
                    aria-pressed={tool === "sketch"}
                    onClick={() => toggle("sketch")}
                >
                    <PenTool size={14} /> Tracer point par point
                </Button>
            )}
            {canCreate && (
                <Button
                    variant={tool === "wall" ? "default" : "outline"}
                    size="sm"
                    aria-pressed={tool === "wall"}
                    disabled={wallsUnavailable}
                    title={
                        wallsUnavailable
                            ? "Murs indisponibles : la base de données n'a pas la migration des murs (20261008150000_magasins_murs)."
                            : undefined
                    }
                    onClick={() => toggle("wall")}
                >
                    <BrickWall size={14} /> Mur
                </Button>
            )}
            {canCreate && (
                <Button
                    variant={tool === "wallLine" ? "default" : "outline"}
                    size="sm"
                    aria-pressed={tool === "wallLine"}
                    disabled={wallsUnavailable}
                    title="Mur droit : un clic au départ, un clic à l'arrivée."
                    onClick={() => toggle("wallLine")}
                >
                    <Minus size={14} /> Mur droit
                </Button>
            )}
            <Button
                variant={tool === "contour" ? "default" : "outline"}
                size="sm"
                aria-pressed={tool === "contour"}
                onClick={() => toggle("contour")}
            >
                <Spline size={14} /> Modifier le contour
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
                Annuler
            </Button>
            <Button size="sm" onClick={onSave} disabled={saving || changes === 0}>
                <Save size={14} />
                {saving ? "Enregistrement…" : `Enregistrer${changes ? ` (${changes})` : ""}`}
            </Button>
        </>
    )
}
