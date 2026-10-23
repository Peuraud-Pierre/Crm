import type { ReactElement } from "react"
import { useNavigate } from "react-router"
import { BookCheck, Building2, Tags } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { SETTINGS_SECTIONS, type SettingsNavItem } from "@/features/stock/types/stock.types"
import FournisseursMenu from "./menus/fournisseurs/FournisseursMenu"
import CategoriesMenu from "./menus/categories/CategoriesMenu"
import PackingDictionaryMenu from "./menus/packing/PackingDictionaryMenu"
import { cn } from "@/shared/lib/utils"
import { GESTION_THEME } from "@/features/stock/theme"

const SECTION_META: Record<SettingsNavItem, { label: string; icon: LucideIcon }> = {
    fournisseurs: { label: "Fournisseurs",   icon: Building2 },
    categories:   { label: "Catégories",     icon: Tags },
    packing:      { label: "Correspondances", icon: BookCheck },
}

const SECTION_PANELS: Record<SettingsNavItem, () => ReactElement> = {
    fournisseurs: FournisseursMenu,
    categories:   CategoriesMenu,
    packing:      PackingDictionaryMenu,
}

// Même ordre et même défaut que `STOCK_TABS.details`, qui pilote l'URL.
const DEFAULT_SECTION: SettingsNavItem = SETTINGS_SECTIONS[0]

function isSettingsSection(value: string | undefined): value is SettingsNavItem {
    return SETTINGS_SECTIONS.some((section) => section === value)
}

interface SettingsBoardProps {
    /** Segment `detail` de l'URL : /stock/parametres/:section */
    section?: string
}

export default function SettingsBoard({ section }: SettingsBoardProps) {
    const navigate = useNavigate()

    // L'URL est la source de vérité (docs/ROUTING.md) : la section est dérivée,
    // jamais stockée en state, et reste partageable / rechargeable. La
    // canonicalisation (section absente ou inconnue → défaut) est faite par
    // `routes/Stock.tsx` ; ce composant ne redirige jamais de lui-même, il
    // peut être rendu une passe de plus après être devenu inactif.
    const activeSection = isSettingsSection(section) ? section : DEFAULT_SECTION
    const ActivePanel = SECTION_PANELS[activeSection]

    return (
        <div className="flex flex-col gap-5">
            <div className={cn(GESTION_THEME.filterBar.tabToggle, "w-full sm:w-fit")}>
                {SETTINGS_SECTIONS.map((id) => {
                    const { label, icon: Icon } = SECTION_META[id]
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => navigate(`/stock/parametres/${id}`)}
                            aria-current={activeSection === id ? "page" : undefined}
                            className={cn(
                                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-none",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                                activeSection === id
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            <Icon size={16} />
                            {label}
                        </button>
                    )
                })}
            </div>

            <div className={cn("p-4 sm:p-6", GESTION_THEME.settings.content)}>
                {/* Table plutôt qu'une chaîne de ternaires : une section
                    ajoutée sans son panneau devient une erreur de typage. */}
                <ActivePanel />
            </div>
        </div>
    )
}
