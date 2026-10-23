import { useEffect, useMemo } from "react"
import { useNavigate, useParams } from "react-router"
import { Bell, Plug, ShieldCheck } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import {
    SETTINGS_PERMISSIONS,
    SETTINGS_SECTIONS,
    type SettingsSection,
} from "../constants"
import {
    SettingsNav,
    type SettingsNavItem,
} from "../components/SettingsNav"
import { SecuritySection } from "../components/security/SecuritySection"
import { PreferencesSection } from "../components/preferences/PreferencesSection"
import { IntegrationsSection } from "../components/integrations/IntegrationsSection"
import { SkeletonGroup } from "@/shared/ui/molecules/skeleton-presets"

interface SectionDef extends SettingsNavItem {
    /** Code requis pour voir la section — absente du DOM sinon. */
    permission?: string
}

const SECTION_DEFS: SectionDef[] = [
    {
        value: SETTINGS_SECTIONS.security,
        label: "Sécurité",
        description: "Mot de passe, 2FA, conditions",
        icon: ShieldCheck,
    },
    {
        value: SETTINGS_SECTIONS.preferences,
        label: "Préférences",
        description: "Apparence et notifications",
        icon: Bell,
    },
    {
        value: SETTINGS_SECTIONS.integrations,
        label: "Intégrations",
        description: "Calendrier et newsletter",
        icon: Plug,
        permission: SETTINGS_PERMISSIONS.newsletterView,
    },
]

/**
 * Page « Paramètres » — réglages du compte, en sections deep-linkées
 * (/settings/:section?) présentées par un sommaire latéral.
 */
export default function Settings() {
    const { user, hasPermission } = useAuth()
    const { section } = useParams()
    const navigate = useNavigate()

    const visibleSections = useMemo(
        () =>
            SECTION_DEFS.filter(
                (s) => !s.permission || hasPermission(s.permission)
            ),
        [hasPermission]
    )

    const activeSection = visibleSections.some((s) => s.value === section)
        ? (section as SettingsSection)
        : visibleSections[0]?.value

    // Slug absent, inconnu ou non autorisé → première section visible
    useEffect(() => {
        if (activeSection && section !== activeSection) {
            navigate(`/settings/${activeSection}`, { replace: true })
        }
    }, [section, activeSection, navigate])

    if (!user) {
        return (
            <SkeletonGroup className="flex-1 space-y-6 p-4 sm:p-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64 w-full" />
            </SkeletonGroup>
        )
    }

    // AuthGuardLayout gate déjà la route — défense en profondeur
    if (!activeSection) return null

    const activeDef = visibleSections.find((s) => s.value === activeSection)

    return (
        <div className="flex-1 space-y-6 p-4 sm:p-6">
            <header>
                <h1 className="text-xl font-bold tracking-tight">Paramètres</h1>
                <p className="text-sm text-muted-foreground">
                    {activeDef?.description}
                </p>
            </header>

            <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
                <SettingsNav
                    items={visibleSections}
                    active={activeSection}
                    onSelect={(value) => navigate(`/settings/${value}`)}
                />

                <div className="min-w-0 flex-1">
                    {activeSection === SETTINGS_SECTIONS.security ? (
                        <SecuritySection user={user} />
                    ) : activeSection === SETTINGS_SECTIONS.preferences ? (
                        <PreferencesSection />
                    ) : (
                        <IntegrationsSection />
                    )}
                </div>
            </div>
        </div>
    )
}
