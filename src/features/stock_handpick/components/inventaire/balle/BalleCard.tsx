import { Check, Lock } from "lucide-react"
import { BaleCard } from "@/shared/ui/organisms/bale-card"
import { cn } from "@/shared/lib/utils"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import {
    BALLE_LOCATION_LABELS,
    BALLE_STATUS_CONFIG,
    QUANTITY_UNIT_LABELS,
    UUID_DISPLAY_LENGTH,
} from "@/features/stock_handpick/constants"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"

interface BalleCardProps {
    balle: BalleHandpick
    /** Chemin lisible de l'emplacement, résolu par le contexte. */
    emplacementPath: string | null
    onClick: () => void
    /**
     * Mode sélection : `selected` / `idle` (cochable), `locked` (empruntée ou
     * éclatée, non déplaçable). Absent hors mode sélection.
     */
    selection?: "selected" | "idle" | "locked"
}

/**
 * Adaptateur du module : il aplatit une balle handpick en champs affichables.
 * Le dessin vit dans `shared/ui/organisms/bale-card`, partagé avec le stock
 * principal — les deux inventaires se lisent désormais de la même façon.
 *
 * Deux substitutions par rapport au stock principal : une balle handpick n'a
 * pas de code lisible, son identifiant tronqué tient lieu de BIN ; et sa
 * quantité peut être en pièces autant qu'en kilos.
 *
 * Le fournisseur a quitté la carte — la tuile carrée ne tient pas quatre
 * lignes. Il reste dans la vue tableau et sur la fiche de détail.
 */
export function BalleCard({ balle, emplacementPath, onClick, selection }: BalleCardProps) {
    const status = BALLE_STATUS_CONFIG[balle.status]
    const unit =
        balle.packing_mode === "pieces"
            ? QUANTITY_UNIT_LABELS.pieces
            : QUANTITY_UNIT_LABELS.kg

    // L'adresse précise si la balle est rangée, sinon son macro-état.
    const place = balle.is_eclatee
        ? "Éclatée"
        : balle.borrowed_by
        ? "Empruntée"
        : emplacementPath ??
          (balle.location ? BALLE_LOCATION_LABELS[balle.location] : "Non rangée")

    const card = (
        <BaleCard
            identity={balle.id.slice(0, UUID_DISPLAY_LENGTH)}
            quantity={balle.packing}
            unit={unit}
            category={balle.category?.name ?? "Sans catégorie"}
            rawName={balle.raw_name}
            date={balle.import_date}
            place={place}
            badgeClassName={status.className}
            surface={{
                surface: HANDPICK_THEME.card.surface,
                text: HANDPICK_THEME.card.text,
                mutedText: HANDPICK_THEME.card.mutedText,
            }}
            skin={status.card}
            onClick={onClick}
        />
    )

    if (!selection) return card

    // Coche posée par-dessus la carte partagée : `BaleCard` reste le même
    // dessin dans les deux stocks, la sélection est propre à ce module.
    return (
        <div
            className={cn(
                "relative rounded-xl",
                selection === "selected" && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                selection === "locked" && "opacity-50",
            )}
        >
            {card}
            <span
                aria-hidden
                className={cn(
                    "pointer-events-none absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2",
                    selection === "selected"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background/90 text-muted-foreground",
                )}
            >
                {selection === "selected" && <Check size={14} />}
                {selection === "locked" && <Lock size={12} />}
            </span>
            <span className="sr-only">
                {selection === "selected"
                    ? "Sélectionnée"
                    : selection === "locked"
                      ? "Non déplaçable (empruntée ou éclatée)"
                      : "Non sélectionnée"}
            </span>
        </div>
    )
}
