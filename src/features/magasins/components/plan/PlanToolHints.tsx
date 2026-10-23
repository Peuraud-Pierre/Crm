import { Button } from "@/shared/ui/atoms/button"
import type { PlanItem, Point } from "@/features/magasins/types/magasin.types"
import { polygonArea } from "@/features/magasins/utils/contour"
import type { PlanEditTool } from "./PlanEditToolbar"

interface PlanToolHintsProps {
    tool: PlanEditTool
    /** Contour affiché de l'étage, pour sa surface. */
    contourPoints: readonly Point[]
    /** L'étage a un contour propre (sinon, le rectangle du magasin). */
    hasContour: boolean
    onResetContour: () => void
    /** Forme libre sélectionnée, hors outil : ses points se retouchent. */
    shapeItem: PlanItem | null
    /** Escalier en attente de fusion : on clique l'autre escalier. */
    mergingFrom?: PlanItem | null
}

const area = (points: readonly Point[]) => polygonArea(points).toLocaleString("fr-FR", { maximumFractionDigits: 1 })

/** Mode d'emploi de l'outil actif du plan, sous la barre d'outils. */
export function PlanToolHints({ tool, contourPoints, hasContour, onResetContour, shapeItem, mergingFrom }: PlanToolHintsProps) {
    if (mergingFrom) {
        return (
            <p className="text-xs font-medium text-primary">
                Cliquez l'escalier à fusionner avec {mergingFrom.path} : ils ne formeront plus qu'un escalier. Échap pour
                annuler.
            </p>
        )
    }
    if (tool === "contour") {
        return (
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <p className="flex-1 font-medium text-primary">
                    Glissez un angle pour le déplacer, tirez un petit rond au milieu d'un mur pour ajouter un angle,
                    double-cliquez un angle pour le retirer. Enregistré à chaque relâcher.
                </p>
                <span className="text-muted-foreground">{area(contourPoints)} m²</span>
                {hasContour && (
                    <Button variant="ghost" size="sm" onClick={onResetContour}>
                        Remettre en rectangle
                    </Button>
                )}
            </div>
        )
    }
    if (tool === "draw") {
        return (
            <p className="text-xs font-medium text-primary">
                Tracez un rectangle sur le plan (cliquer-glisser) : il devient une zone, un rayon ou un portant selon
                l'endroit, à confirmer.
            </p>
        )
    }
    if (tool === "sketch") {
        return (
            <p className="text-xs font-medium text-primary">
                Cliquez chaque angle de votre meuble, là où vous voulez. Fermez en cliquant le premier point, par
                double-clic ou Entrée. Retour arrière retire le dernier point, Échap efface le tracé.
            </p>
        )
    }
    if (tool === "wallLine") {
        return (
            <p className="text-xs font-medium text-primary">
                Mur droit : cliquez son départ puis son arrivée, c'est tout. Maj enfoncée pour le garder horizontal,
                vertical ou à 45°. Échap annule.
            </p>
        )
    }
    if (tool === "wall") {
        return (
            <p className="text-xs font-medium text-primary">
                Cliquez le départ du mur puis chaque angle ; Maj enfoncée pour un mur bien droit. Double-clic ou
                Entrée pour finir, clic sur le premier point pour le refermer. Retour arrière retire le dernier point.
            </p>
        )
    }
    if (shapeItem) {
        return shapeItem.geometry.rotation ? (
            <p className="text-xs text-muted-foreground">
                Pour retoucher les points de {shapeItem.path}, remettez sa rotation à 0°.
            </p>
        ) : (
            <p className="text-xs font-medium text-primary">
                Forme libre {shapeItem.path} : glissez ses angles, tirez le milieu d'un côté pour en ajouter un,
                double-cliquez un angle pour le retirer.
            </p>
        )
    }
    return null
}
