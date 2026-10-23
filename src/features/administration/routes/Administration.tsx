import { useEffect, useMemo } from "react"
import { useNavigate, useParams } from "react-router"
import { Briefcase, KeyRound, Shield, Users } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/shared/ui/atoms/tabs"
import { ADMIN_PERMISSIONS, ADMIN_TABS, type AdminTab } from "../constants"
import { UsersTab } from "../components/users/UsersTab"
import { RolesTab } from "../components/roles-services/RolesTab"
import { ServicesTab } from "../components/roles-services/ServicesTab"
import { PermissionsTab } from "../components/permissions/PermissionsTab"
import { useAssignmentCounts } from "../hooks/data/useAssignmentCounts"
import { usePermissions } from "../hooks/data/usePermissions"

interface TabDef {
    value: AdminTab
    label: string
    /** Sous-titre du header quand l'onglet est actif. */
    description: string
    icon: typeof Users
    /** Code requis pour voir l'onglet — absent du DOM sinon. */
    permission: string
}

const TAB_DEFS: TabDef[] = [
    {
        value: ADMIN_TABS.users,
        label: "Utilisateurs",
        description:
            "Créez, invitez et gérez les comptes — la fiche d'un utilisateur porte son profil et ses permissions.",
        icon: Users,
        permission: ADMIN_PERMISSIONS.usersView,
    },
    {
        value: ADMIN_TABS.roles,
        label: "Rôles",
        description:
            "Les rôles regroupent des permissions héritées par leurs utilisateurs.",
        icon: Shield,
        permission: ADMIN_PERMISSIONS.rolesServicesView,
    },
    {
        value: ADMIN_TABS.services,
        label: "Services",
        description:
            "Les services accordent des permissions à leurs membres, en complément du rôle.",
        icon: Briefcase,
        permission: ADMIN_PERMISSIONS.rolesServicesView,
    },
    {
        value: ADMIN_TABS.permissions,
        label: "Permissions",
        description:
            "Le catalogue complet : qui détient quoi, et les permissions attribuées à personne.",
        icon: KeyRound,
        permission: ADMIN_PERMISSIONS.rolesServicesView,
    },
]

/**
 * Page « Administration » — gestion des accès : utilisateurs, rôles,
 * services et catalogue de permissions, en onglets deep-linkés
 * (/administration/:tab?).
 */
export default function Administration() {
    const { hasPermission } = useAuth()
    const { tab } = useParams()
    const navigate = useNavigate()

    // Remonté ici (le shell vit pour toute la session de la page) : évite
    // que chaque bascule d'onglet Rôles/Services/Permissions redéclenche
    // son propre fetch du catalogue de permissions et des effectifs.
    const { byRole, byService, loading: countsLoading } = useAssignmentCounts()
    const {
        permissions,
        assignments,
        loading: permissionsLoading,
        refetch: refetchPermissions,
        assignToEntity,
    } = usePermissions()

    const visibleTabs = useMemo(
        () => TAB_DEFS.filter((t) => hasPermission(t.permission)),
        [hasPermission]
    )

    const activeTab = visibleTabs.some((t) => t.value === tab)
        ? (tab as AdminTab)
        : visibleTabs[0]?.value

    // Slug absent, inconnu ou non autorisé → premier onglet visible
    useEffect(() => {
        if (activeTab && tab !== activeTab) {
            navigate(`/administration/${activeTab}`, { replace: true })
        }
    }, [tab, activeTab, navigate])

    // AuthGuardLayout gate déjà la route — défense en profondeur
    if (!activeTab) return null

    const activeDef = visibleTabs.find((t) => t.value === activeTab)

    return (
        <div className="flex-1 p-4 sm:p-6 space-y-6">
            <header>
                <h1 className="text-xl font-bold tracking-tight">
                    Administration
                </h1>
                <p className="text-sm text-muted-foreground">
                    {activeDef?.description}
                </p>
            </header>

            <Tabs
                value={activeTab}
                onValueChange={(value) => navigate(`/administration/${value}`)}
                className="space-y-6"
            >
                <TabsList indicator className="flex h-auto w-full flex-row bg-card p-1 shadow-sm">
                    {visibleTabs.map(({ value, label, icon: Icon }) => (
                        <TabsTrigger
                            key={value}
                            value={value}
                            className="flex flex-1 flex-col items-center gap-1 py-3"
                        >
                            <Icon className="h-4 w-4" />
                            <span className="hidden text-xs sm:inline">
                                {label}
                            </span>
                        </TabsTrigger>
                    ))}
                </TabsList>

                {visibleTabs.map(({ value }) => (
                    <TabsContent key={value} value={value}>
                        {value === ADMIN_TABS.users ? (
                            <UsersTab />
                        ) : value === ADMIN_TABS.roles ? (
                            <RolesTab
                                counts={byRole}
                                countsLoading={countsLoading}
                                permissions={permissions}
                            />
                        ) : value === ADMIN_TABS.services ? (
                            <ServicesTab
                                counts={byService}
                                countsLoading={countsLoading}
                                permissions={permissions}
                            />
                        ) : (
                            <PermissionsTab
                                permissions={permissions}
                                assignments={assignments}
                                loading={permissionsLoading}
                                refetch={refetchPermissions}
                                assignToEntity={assignToEntity}
                            />
                        )}
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    )
}
