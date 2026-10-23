import {
    Plus,
    Wrench,
    ArrowUp,
    Trash,
    Bug,
    Zap,
    Shield,
    Star,
    Settings,
    type LucideIcon,
} from "lucide-react"

/**
 * Mapping des noms d'icônes (kebab-case) vers les composants Lucide.
 * On importe uniquement les icônes utilisées pour éviter d'embarquer
 * toute la bibliothèque (~1500 icônes).
 *
 * Ajouter ici toute nouvelle icône utilisée dans les catégories changelog.
 */
const ICON_MAP: Record<string, LucideIcon> = {
    plus: Plus,
    wrench: Wrench,
    "arrow-up": ArrowUp,
    trash: Trash,
    bug: Bug,
    zap: Zap,
    shield: Shield,
    star: Star,
    settings: Settings,
}

/**
 * Résout une icône Lucide depuis un nom string (kebab-case).
 * Retourne le composant LucideIcon ou null si non trouvé / null.
 */
export function getCategoryIcon(iconName: string | null): LucideIcon | null {
    if (!iconName) return null
    return ICON_MAP[iconName.toLowerCase()] ?? null
}
