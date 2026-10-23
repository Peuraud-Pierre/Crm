import { lazy, Suspense, useEffect, useMemo } from "react"
import { useLocation, useNavigate, useParams } from "react-router"
import { Loader2 } from "lucide-react"
import Matomo from "@/features/matomo/routes/Matomo"
import LeadsStats from "@/features/leads/routes/LeadsStats"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/atoms/tabs"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
    ANALYTICS_PERMISSIONS,
    ANALYTICS_TABS,
    type AnalyticsTab,
} from "../constants"

// Stats CRM chargées en lazy (contexte + charts volumineux) et enveloppées dans
// le CRMProvider requis par AnalyticsTab. Radix ne monte le contenu de l'onglet
// qu'une fois actif → aucun fetch CRM tant que l'onglet n'est pas ouvert.
const CrmStats = lazy(async () => {
    const [{ default: AnalyticsTab }, { CRMProvider }] = await Promise.all([
        import("@/features/crm/AnalyticsTab"),
        import("@/features/crm/context/CRMContext"),
    ])
    return {
        default: () => (
            <CRMProvider>
                <AnalyticsTab />
            </CRMProvider>
        ),
    }
})

interface TabDef {
    value: AnalyticsTab
    label: string
    /** Permission requise : onglet absent du DOM et de l'URL sinon. */
    permission: string
}

const TAB_DEFS: TabDef[] = [
    {
        value: ANALYTICS_TABS.matomo,
        label: "Trafic du site",
        permission: ANALYTICS_PERMISSIONS.matomoView,
    },
    {
        value: ANALYTICS_TABS.leads,
        label: "Statistiques Leads",
        permission: ANALYTICS_PERMISSIONS.leadsView,
    },
    {
        value: ANALYTICS_TABS.crm,
        label: "Activité commerciale",
        permission: ANALYTICS_PERMISSIONS.crmView,
    },
]

/**
 * Page « Analytics » — Matomo, statistiques Leads et activité commerciale CRM,
 * en onglets deep-linkés (/analytics/:tab?, docs/ROUTING.md).
 */
export default function Analytics() {
    const { hasPermission } = useAuth()
    const { tab } = useParams()
    const navigate = useNavigate()
    const location = useLocation()

    const visibleTabs = useMemo(
        () => TAB_DEFS.filter((t) => hasPermission(t.permission)),
        [hasPermission]
    )

    const activeTab = visibleTabs.some((t) => t.value === tab)
        ? (tab as AnalyticsTab)
        : visibleTabs[0]?.value

    // Slug absent, inconnu ou non autorisé → premier onglet visible
    useEffect(() => {
        if (activeTab && tab !== activeTab) {
            // La query string porte les filtres d'un onglet (ex. Matomo
            // `?periode=`) : la canonicalisation du slug ne doit pas la perdre.
            navigate(
                { pathname: `/analytics/${activeTab}`, search: location.search },
                { replace: true }
            )
        }
    }, [tab, activeTab, navigate, location.search])

    // AuthGuardLayout gate déjà la route — défense en profondeur
    if (!activeTab) return null

    const isVisible = (tab: AnalyticsTab) =>
        visibleTabs.some((t) => t.value === tab)

    return (
        <Tabs
            value={activeTab}
            onValueChange={(value) => navigate(`/analytics/${value}`)}
            className="flex flex-col"
        >
            {/* h-auto flex-wrap : TabsList est inline-flex h-10 et ses triggers sont
                whitespace-nowrap — sans wrap, les libellés débordent de l'écran. */}
            <TabsList className="mx-4 mt-4 h-auto w-fit flex-wrap sm:mx-6">
                {visibleTabs.map(({ value, label }) => (
                    <TabsTrigger key={value} value={value}>
                        {label}
                    </TabsTrigger>
                ))}
            </TabsList>

            {isVisible(ANALYTICS_TABS.matomo) && (
                <TabsContent value={ANALYTICS_TABS.matomo} className="w-full">
                    <Matomo />
                </TabsContent>
            )}

            {isVisible(ANALYTICS_TABS.leads) && (
                <TabsContent value={ANALYTICS_TABS.leads} className="w-full">
                    <LeadsStats />
                </TabsContent>
            )}

            {isVisible(ANALYTICS_TABS.crm) && (
                <TabsContent
                    value={ANALYTICS_TABS.crm}
                    className="w-full px-4 sm:px-6"
                >
                    <Suspense
                        fallback={
                            <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span className="text-sm">
                                    Chargement des statistiques CRM…
                                </span>
                            </div>
                        }
                    >
                        <CrmStats />
                    </Suspense>
                </TabsContent>
            )}
        </Tabs>
    )
}
