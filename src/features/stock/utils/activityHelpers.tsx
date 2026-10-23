import {
    Building2, ClipboardList, Container, Package, PackageCheck, Pencil, Plus, Ship, Store, Tag, Trash2, Truck, UserRound,
} from "lucide-react"
import type { ActivityEntityType, ActivityAction } from "@/features/stock/types/history.types"
import { ENTITY_LABEL, ACTION_LABEL } from "@/features/stock/types/history.types"
import { GESTION_THEME } from "@/features/stock/theme"
export { ENTITY_LABEL, ACTION_LABEL }

// Formatage des dates : partagé avec le stock handpick, dont le journal doit
// se lire exactement comme celui-ci.
export { timeAgo, formatExact } from "@/shared/lib/timeAgo"

export const ENTITY_ICON: Record<ActivityEntityType, React.ReactNode> = {
    balle:       <Package size={14} />,
    delivery:    <Truck size={14} />,
    category:    <Tag size={14} />,
    fournisseur: <Building2 size={14} />,
    arrivage:    <Ship size={14} />,
    fiche_tri:          <ClipboardList size={14} />,
    trieur:             <UserRound size={14} />,
    commande:           <Store size={14} />,
    livraison_boutique: <Container size={14} />,
    carton:             <PackageCheck size={14} />,
}

export const ACTION_ICON: Record<ActivityAction, React.ReactNode> = {
    create: <Plus size={10} />,
    update: <Pencil size={10} />,
    delete: <Trash2 size={10} />,
}

export const ACTION_COLORS = GESTION_THEME.activity.actionColors as Record<ActivityAction, string>
export const ENTITY_COLORS = GESTION_THEME.activity.entityColors as Record<ActivityEntityType, string>
