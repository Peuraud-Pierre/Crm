import { useNavigate } from "react-router"
import { Building2, Tags } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import {
    HANDPICK_ROUTE_BASE,
    HANDPICK_SETTINGS_SECTIONS,
    type HandpickSettingsSection,
} from "@/features/stock_handpick/types/ui.types"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import FournisseursMenu from "./menus/fournisseurs/FournisseursMenu"
import CategoriesMenu from "./menus/categories/CategoriesMenu"

const SECTION_META: Record<HandpickSettingsSection, { label: string; icon: LucideIcon }> = {
    fournisseurs: { label: "Usines", icon: Building2 },
    categories:   { label: "Catégories",   icon: Tags },
}

// Même ordre et même défaut que `STOCK_HANDPICK_TABS.details`, qui pilote l'URL.
const DEFAULT_SECTION: HandpickSettingsSection = HANDPICK_SETTINGS_SECTIONS[0]

function isSettingsSection(value: string | undefined): value is HandpickSettingsSection {
    return HANDPICK_SETTINGS_SECTIONS.some((section) => section === value)
}

interface SettingsBoardProps {
    /** Segment `detail` de l'URL : /stock-handpick/parametres/:section */
    section?: string
}

export default function SettingsBoard({ section }: SettingsBoardProps) {
    const navigate = useNavigate()

    // L'URL est la source de vérité (docs/ROUTING.md) : la section est dérivée,
    // jamais stockée en state. La canonicalisation (section absente ou inconnue
    // → défaut) est faite par `routes/StockHandpick.tsx` ; ce composant ne
    // redirige JAMAIS de lui-même — Radix Tabs peut le rendre une passe de plus
    // après qu'il est devenu inactif, et la redirection partirait alors d'une
    // section périmée.
    const activeSection = isSettingsSection(section) ? section : DEFAULT_SECTION

    return (
        <div className="flex flex-col gap-5">
            <div className={cn(HANDPICK_THEME.filterBar.tabToggle, "w-full sm:w-fit")}>
                {HANDPICK_SETTINGS_SECTIONS.map((id) => {
                    const { label, icon: Icon } = SECTION_META[id]
                    const active = activeSection === id
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => navigate(`${HANDPICK_ROUTE_BASE}/parametres/${id}`)}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-none",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                                active
                                    ? HANDPICK_THEME.filterBar.tabActive
                                    : HANDPICK_THEME.filterBar.tabInactive,
                            )}
                        >
                            <Icon size={16} />
                            {label}
                        </button>
                    )
                })}
            </div>

            <div className={cn("p-4 sm:p-6", HANDPICK_THEME.settings.content)}>
                {activeSection === "fournisseurs" ? <FournisseursMenu /> : <CategoriesMenu />}
            </div>
        </div>
    )
}
