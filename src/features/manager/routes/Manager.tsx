import { useEffect, useMemo } from "react"
import { useNavigate, useParams } from "react-router"
import { AnnouncementsAdmin } from "@/features/announcements"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { ChangelogAdmin, ChangelogProvider } from "@/features/changelog"
import { DashboardTemplatesAdmin } from "@/features/dashboard"
import { MaintenanceAdmin } from "@/features/maintenance"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/shared/ui/atoms/tabs"
import { GenTypes } from "../components/GenTypes/GenTypes"
import {
    MANAGER_PERMISSIONS,
    MANAGER_TABS,
    type ManagerTab,
} from "../constants"

interface TabDef {
    value: ManagerTab
    label: string
    permission: string
}

const TAB_DEFS: TabDef[] = [
    {
        value: MANAGER_TABS.changelog,
        label: "Changelog",
        permission: MANAGER_PERMISSIONS.changelog,
    },
    {
        value: MANAGER_TABS.maintenance,
        label: "Maintenance",
        permission: MANAGER_PERMISSIONS.maintenance,
    },
    {
        value: MANAGER_TABS.announcements,
        label: "Annonces",
        permission: MANAGER_PERMISSIONS.announcements,
    },
    {
        value: MANAGER_TABS.dashboardTemplates,
        label: "Tableaux de bord",
        permission: MANAGER_PERMISSIONS.dashboardTemplates,
    },
    {
        value: MANAGER_TABS.genTypes,
        label: "Gen Types",
        permission: MANAGER_PERMISSIONS.genTypes,
    },
]

/**
 * Console d'administration — route `/manager/:tab?`.
 *
 * Suit le modèle canonique de `docs/ROUTING.md` (référence :
 * `administration/routes/Administration.tsx`) : l'URL est la seule source
 * de vérité, `activeTab` est un dérivé de rendu, et un unique `useEffect`
 * sert de garde de redirection.
 *
 * Trois défauts de la version précédente sont corrigés :
 *   - l'onglet actif vivait dans un `useState`, donc ni partageable, ni
 *     rechargeable, ni atteignable par un lien ;
 *   - l'onglet par défaut était `"changelog"` en dur : un utilisateur ne
 *     détenant que `manager.annonce` arrivait sur une page vide ;
 *   - la page montait `CustomerDetailDialog` et consommait le contexte
 *     CRM, sans aucun rapport avec l'administration.
 *
 * Le contenu de chaque onglet appartient désormais à sa propre feature :
 * cette page n'est plus qu'un aiguillage.
 */
export default function Manager() {
    const { user, hasPermission } = useAuth()
    const { tab } = useParams()
    const navigate = useNavigate()

    const visibleTabs = useMemo(
        () => TAB_DEFS.filter((t) => hasPermission(t.permission)),
        [hasPermission]
    )

    // Onglet par défaut = premier onglet VISIBLE, pas un slug figé.
    const activeTab = visibleTabs.some((t) => t.value === tab)
        ? tab
        : visibleTabs[0]?.value

    useEffect(() => {
        if (activeTab && tab !== activeTab) {
            navigate(`/manager/${activeTab}`, { replace: true })
        }
    }, [tab, activeTab, navigate])

    if (!user) {
        return (
            <div className="p-6 text-center text-muted-foreground">
                Veuillez vous connecter pour accéder au panneau Manager.
            </div>
        )
    }

    if (visibleTabs.length === 0) {
        return (
            <div className="p-6 text-center text-muted-foreground">
                Vous n'avez accès à aucune section de la console.
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6">
            <Tabs
                value={activeTab}
                onValueChange={(value) => navigate(`/manager/${value}`)}
                className="space-y-6"
            >
                {/* `indicator` reste désactivé : cette liste est en
                    flex-wrap, où la pastille ne suivrait pas le passage à
                    la ligne (elle ne translate qu'en X). Voir
                    docs/PLAN_ASSAINISSEMENT.md. */}
                <TabsList className="h-auto flex-wrap">
                    {visibleTabs.map((t) => (
                        <TabsTrigger key={t.value} value={t.value}>
                            {t.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {hasPermission(MANAGER_PERMISSIONS.changelog) && (
                    <TabsContent value={MANAGER_TABS.changelog}>
                        {/* Provider local : la liste, le formulaire et le
                            gestionnaire de catégories partagent un état,
                            mais seulement dans cet onglet. */}
                        <ChangelogProvider>
                            <ChangelogAdmin />
                        </ChangelogProvider>
                    </TabsContent>
                )}

                {hasPermission(MANAGER_PERMISSIONS.maintenance) && (
                    <TabsContent value={MANAGER_TABS.maintenance}>
                        <MaintenanceAdmin />
                    </TabsContent>
                )}

                {hasPermission(MANAGER_PERMISSIONS.announcements) && (
                    <TabsContent value={MANAGER_TABS.announcements}>
                        <AnnouncementsAdmin />
                    </TabsContent>
                )}

                {hasPermission(MANAGER_PERMISSIONS.dashboardTemplates) && (
                    <TabsContent value={MANAGER_TABS.dashboardTemplates}>
                        <DashboardTemplatesAdmin />
                    </TabsContent>
                )}

                {hasPermission(MANAGER_PERMISSIONS.genTypes) && (
                    <TabsContent value={MANAGER_TABS.genTypes}>
                        <GenTypes />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    )
}
