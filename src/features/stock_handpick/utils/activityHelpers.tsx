import {
    Package,
    Tag,
    Building2,
    Link2,
    Forklift,
    ArrowLeftRight,
    Map,
    MapPin,
    Plus,
    Pencil,
    Trash2,
} from "lucide-react"
import type { HandpickAction, HandpickEntityType } from "@/features/stock_handpick/types/history.types"

/**
 * Vocabulaire visuel du journal du handpick.
 *
 * Les icônes des concepts communs aux deux stocks sont volontairement les mêmes
 * que celles de `features/stock/utils/activityHelpers` (balle → colis,
 * catégorie → étiquette, fournisseur → immeuble) : le journal se lit
 * identiquement d'un module à l'autre, seuls les concepts propres au handpick
 * (mouvement, zone, emplacement) apportent leurs propres icônes.
 *
 * Les tailles (14 pour l'entité, 10 pour l'action) sont celles qu'attend la
 * ligne partagée : les changer désaligne la pastille d'action.
 */
export const ENTITY_ICON: Record<HandpickEntityType, React.ReactNode> = {
    balle: <Package size={14} />,
    category: <Tag size={14} />,
    fournisseur: <Building2 size={14} />,
    fournisseur_category: <Link2 size={14} />,
    // Même bateau que l'arrivage du stock principal : les deux modules
    // désignent la même chose, une expédition.
    flux: <Forklift size={14} />,
    mouvement: <ArrowLeftRight size={14} />,
    zone: <Map size={14} />,
    emplacement: <MapPin size={14} />,
}

export const ACTION_ICON: Record<HandpickAction, React.ReactNode> = {
    create: <Plus size={10} />,
    update: <Pencil size={10} />,
    delete: <Trash2 size={10} />,
}

export { timeAgo, formatExact } from "@/shared/lib/timeAgo"
