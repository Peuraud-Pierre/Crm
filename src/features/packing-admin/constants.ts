import { AlertTriangle, FlaskConical, Gauge, PackageSearch } from "lucide-react"
import type { ComponentType } from "react"
import type { ModuleTabsTheme } from "@/shared/ui/organisms/module-tabs"
import type { TabDef, TabbedModuleConfig } from "@/shared/types/tabbed-module.types"
import type { PackingAdminTab } from "./types"

/**
 * Registre des codes de permission de la feature. Tout `hasPermission(...)` passe
 * par ces constantes, jamais par un littéral en dur.
 *
 * `admin` ouvre la page ; `view` est ce que la RLS exige pour LIRE quoi que ce
 * soit. La migration 20260921120000 accorde les deux au même public — mais un
 * profil bricolé à la main pourrait n'avoir que `admin`, et la console doit alors
 * le dire au lieu de paraître vide.
 */
export const PACKING_ADMIN_PERMISSIONS = {
    admin: "stock.packing.admin",
    view: "stock.packing.view",
} as const

export const ROUTE_BASE = "/packing-admin"

export const DEFAULT_TAB: PackingAdminTab = "pilotage"

/**
 * Onglets. Aucun ne déclare `details` : le segment de détail des imports est un
 * id libre, et `details` est réservé aux sous-sections fermées (cf. le docblock
 * de `TabDef`). Aucune permission par onglet non plus — la route les garde tous
 * de la même façon.
 */
export const PACKING_ADMIN_TABS: readonly TabDef<PackingAdminTab>[] = [
    { id: "pilotage", section: "pilotage" },
    { id: "imports", section: "imports" },
    { id: "ecarts", section: "ecarts" },
    { id: "simulation", section: "simulation" },
]

export const PACKING_ADMIN_MODULE: TabbedModuleConfig<PackingAdminTab> = {
    routeBase: ROUTE_BASE,
    tabs: PACKING_ADMIN_TABS,
    defaultTab: DEFAULT_TAB,
}

export const TAB_META: Record<
    PackingAdminTab,
    { label: string; description: string; icon: ComponentType<{ className?: string; size?: number }> }
> = {
    pilotage: {
        label: "Pilotage",
        description: "Santé du service, précision du modèle et courbe d'apprentissage.",
        icon: Gauge,
    },
    imports: {
        label: "Imports",
        description: "Historique des imports et détail d'un conteneur.",
        icon: PackageSearch,
    },
    ecarts: {
        label: "Écarts",
        description: "Où le modèle se trompe, et quelles correspondances sont contredites.",
        icon: AlertTriangle,
    },
    simulation: {
        label: "Simulation",
        description: "Essayer d'autres seuils sans rien changer en production.",
        icon: FlaskConical,
    },
}

/**
 * Thème des onglets. Copie tokens-only de `GESTION_THEME.tabs` plutôt qu'un
 * import depuis `features/stock` : une feature ne dépend pas du thème d'une
 * autre. Uniquement des tokens `@theme`, aucune valeur arbitraire.
 */
export const PACKING_ADMIN_TABS_THEME: ModuleTabsTheme = {
    list: "flex w-full h-auto p-1.5 bg-card rounded-xl border border-border",
    trigger:
        "flex-1 flex flex-col items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-3 h-auto rounded-lg text-muted-foreground hover:text-foreground transition-colors duration-base ease-emphasized border-none",
}

/** Période de sondage de l'état du service (ms). */
export const STATUS_POLL_MS = 30_000

/**
 * Nombre minimal de conteneurs validés avant de TRACER une courbe.
 *
 * En dessous, on montre les points bruts et on le dit. Une droite à deux points
 * se lit comme une tendance alors qu'elle n'en est pas une, et c'est précisément
 * le chiffre sur lequel on juge la feature : il ne doit pas être flatté.
 */
export const MIN_CURVE_POINTS = 3

/** Conteneurs rejoués par défaut. Borné côté service à 200. */
export const REPLAY_LIMIT = 50

export const IMPORTS_PAGE_SIZE = 25

/** Fenêtre d'analyse des écarts du modèle (jours). */
export const MISTAKES_WINDOW_DAYS = 30

/** Au-delà, une packing coincée « en traitement » est signalée. */
export const STALLED_IMPORT_MINUTES = 10

export const IMPORT_STATUS_LABELS: Record<string, string> = {
    en_traitement: "En traitement",
    a_verifier: "À vérifier",
    validee: "Validée",
    echec: "Échec",
}
