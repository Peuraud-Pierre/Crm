import { useEffect, useMemo, type ReactNode } from "react"
import { useNavigate, useParams } from "react-router"
import { isDev } from "@/shared/lib/env"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { resolveTabState, tabPath } from "@/shared/lib/tabbedModule"
import type { TabDef, TabbedModuleConfig } from "@/shared/types/tabbed-module.types"

/**
 * Template de page des modules à onglets (`docs/ROUTING.md`).
 *
 * Il porte les trois choses que `stock` et `stock_handpick` recopiaient : le
 * filtrage des onglets visibles, la canonicalisation de l'URL, et l'unique
 * effet de garde qui la corrige.
 *
 * **Toute la canonicalisation est faite ici, jamais dans un onglet.** Radix
 * Tabs rend le contenu une passe de plus après qu'il est devenu inactif ; un
 * onglet qui se redirige lui-même le fait alors avec un `detail` déjà périmé,
 * et l'utilisateur oscille entre deux onglets — panne observée en août 2026,
 * sans erreur ni log. La règle qui la rend impossible : un seul `useEffect`, et
 * il est dans ce fichier.
 *
 * La correction d'URL est en `replace` (elle ne doit pas s'empiler dans
 * l'historique), la navigation d'onglet en `push` (le bouton retour doit
 * refaire le chemin inverse). Confondre les deux ne casse rien de visible
 * immédiatement, d'où un test dédié.
 *
 * Le contenu est rendu par un render-prop plutôt que par une config : le
 * composant d'onglets d'une feature peut ainsi appeler ses propres hooks — le
 * stock principal vide son champ de recherche au changement d'onglet, ce qui
 * demande un contexte React et n'est pas exprimable dans un objet statique.
 */

export interface TabbedModuleState<Id extends string> {
    activeTab: Id
    detail?: string
    /** Onglets autorisés, calculés une seule fois ici. */
    visibleTabs: TabDef<Id>[]
    /** Navigue vers un onglet, en `push`. */
    goToTab: (id: Id) => void
}

interface TabbedModuleRouteProps<Id extends string> {
    config: TabbedModuleConfig<Id>
    children: (state: TabbedModuleState<Id>) => ReactNode
}

export default function TabbedModuleRoute<Id extends string>({
    config,
    children,
}: TabbedModuleRouteProps<Id>) {
    const { section, detail } = useParams()
    const navigate = useNavigate()
    const { hasPermission } = useAuth()

    // Onglets encore en chantier : masqués hors dev. Les autres sont gardés par
    // permission (accordée depuis /administration), plus par un flag de build :
    // un utilisateur habilité y accède en production.
    const visibleTabs = useMemo(
        () =>
            config.tabs.filter(
                (tab) =>
                    (!tab.devOnly || isDev) &&
                    (!tab.permission || hasPermission(tab.permission)),
            ),
        [config.tabs, hasPermission],
    )

    const { activeTab, canonicalSection, canonicalDetail } = resolveTabState({
        config,
        visibleTabs,
        section,
        detail,
    })

    useEffect(() => {
        if (section !== canonicalSection || detail !== canonicalDetail) {
            navigate(tabPath(config.routeBase, canonicalSection, canonicalDetail), {
                replace: true,
            })
        }
    }, [section, detail, canonicalSection, canonicalDetail, config.routeBase, navigate])

    const goToTab = (id: Id) => {
        navigate(tabPath(config.routeBase, tabSectionOf(config, id)))
    }

    return (
        <div className="h-full p-5">
            {children({ activeTab, detail: canonicalDetail, visibleTabs, goToTab })}
        </div>
    )
}

function tabSectionOf<Id extends string>(config: TabbedModuleConfig<Id>, id: Id): string {
    return config.tabs.find((tab) => tab.id === id)?.section ?? id
}
