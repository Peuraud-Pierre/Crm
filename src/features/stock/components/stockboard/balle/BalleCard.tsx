import { BaleCard } from "@/shared/ui/organisms/bale-card"
import { GESTION_THEME } from "@/features/stock/theme"
import { BALLE_STATUS_CONFIG } from "@/features/stock/constants"
import type {
    BalleLocation,
    BalleStatus,
} from "@/features/stock/types/stock.types"

interface BalleCardProps {
    bin: string
    weight: number
    category: string
    rawName?: string
    status: BalleStatus
    location: BalleLocation
    date: string
    className?: string
    onClick?: () => void
}

/**
 * Adaptateur du module : il aplatit une balle en champs affichables et choisit
 * l'habillage du statut. Le dessin vit dans `shared/ui/organisms/bale-card`,
 * partagé avec le stock handpick.
 *
 * La prop `type` a disparu : elle était déclarée et jamais lue.
 */
export default function BalleCard({
    bin,
    weight,
    category,
    rawName,
    status,
    location,
    date,
    className,
    onClick,
}: BalleCardProps) {
    const { card } = GESTION_THEME
    // Les statuts hors des cinq habillés (imported, delivered, shipped)
    // retombent sur l'apparence « en stock », comme auparavant.
    const skin = card.status[status as keyof typeof card.status] ?? card.status.stocked

    return (
        <BaleCard
            identity={bin}
            quantity={weight}
            unit="kg"
            category={category}
            rawName={rawName}
            date={date}
            place={location}
            badgeClassName={BALLE_STATUS_CONFIG[status].className}
            surface={{
                surface: card.surface,
                text: card.text,
                mutedText: card.mutedText,
            }}
            skin={skin}
            className={className}
            onClick={onClick}
        />
    )
}
