import { useEffect } from "react"
import { useNavigate, useParams } from "react-router"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/shared/ui/atoms/tabs"
import {
    ARRIVAGE_ADMIN_TABS,
    BASE_PATH,
    DEFAULT_TAB,
    type ArrivageAdminTab,
} from "@/features/arrivage-admin/constants"
import { DashboardTab } from "@/features/arrivage-admin/components/dashboard/DashboardTab"
import { SubscribersTab } from "@/features/arrivage-admin/components/subscribers/SubscribersTab"
import { LogsTab } from "@/features/arrivage-admin/components/logs/LogsTab"

/**
 * Page « Newsletter Arrivages » — onglets deep-linkés
 * (/arrivage-admin/:tab?/:detail?) suivant le modèle canonique de
 * docs/ROUTING.md : l'onglet actif est un dérivé de rendu, un unique
 * `useEffect` sert de garde contre un slug inconnu.
 *
 * `detail` porte l'id d'un envoi et est transmis à l'onglet propriétaire, qui
 * en dérive l'ouverture de sa sheet — jamais un `useState` parallèle.
 *
 * Les trois onglets partagent la permission de la route
 * (stock.arrivage.newsletter.admin), il n'y a donc pas de filtrage de
 * visibilité ici — le gating fin porte sur les actions d'envoi, dans les
 * composants qui les proposent.
 *
 * Pas de `<h1>` : le header applicatif affiche déjà « Newsletter Arrivages »,
 * dérivé de `menuItems` par préfixe de chemin (MainLayout).
 */
export default function ArrivageAdmin() {
    const { tab, detail } = useParams()
    const navigate = useNavigate()

    const activeTab: ArrivageAdminTab = ARRIVAGE_ADMIN_TABS.some(
        t => t.value === tab
    )
        ? (tab as ArrivageAdminTab)
        : DEFAULT_TAB

    // Slug absent ou inconnu → onglet par défaut, sans entrée d'historique.
    useEffect(() => {
        if (tab !== activeTab) {
            navigate(`${BASE_PATH}/${activeTab}`, { replace: true })
        }
    }, [tab, activeTab, navigate])

    const activeDef = ARRIVAGE_ADMIN_TABS.find(t => t.value === activeTab)

    return (
        <div className="flex-1 space-y-4 p-4 sm:space-y-6 sm:p-6">
            <Tabs
                value={activeTab}
                onValueChange={value => navigate(`${BASE_PATH}/${value}`)}
                className="space-y-4 sm:space-y-6"
            >
                <div className="space-y-2">
                    <TabsList indicator className="flex h-auto w-full flex-row bg-card p-1 shadow-sm">
                        {ARRIVAGE_ADMIN_TABS.map(({ value, label, icon: Icon }) => (
                            <TabsTrigger
                                key={value}
                                value={value}
                                className="flex flex-1 flex-col items-center gap-1 py-3 transition-colors"
                            >
                                <Icon className="h-4 w-4" />
                                {/* Libellé masqué sur mobile : l'icône suffit et
                                    les trois onglets tiennent sur une ligne. */}
                                <span className="hidden text-xs sm:inline">
                                    {label}
                                </span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <p className="text-sm text-muted-foreground">
                        {activeDef?.description}
                    </p>
                </div>

                <TabsContent value="dashboard">
                    <DashboardTab />
                </TabsContent>
                <TabsContent value="abonnes">
                    <SubscribersTab />
                </TabsContent>
                <TabsContent value="logs">
                    <LogsTab detail={detail} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
