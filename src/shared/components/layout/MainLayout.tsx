import { Header } from "@/shared/components/layout/Header"
import { Sidebar } from "@/shared/components/layout/Sidebar"
import { useState } from "react"
import { useLocation } from "react-router"
import { menuItems } from "@/shared/components/layout/menuItems"
import { cn } from "@/shared/lib/utils"
import { PrivacyConsentDialog } from "@/shared/components/legal/PrivacyConsentDialog"

interface MainLayoutProps {
    children?: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const { pathname } = useLocation()

    // Match exact OU sous-chemin (ex. titre "CRM" conservé sur /crm/agenda/days).
    const title =
        menuItems.find(
            (item) =>
                item.href === pathname || pathname.startsWith(item.href + "/")
        )?.displayName ?? ""

    return (
        <div className="neon-shell h-svh flex bg-background overflow-hidden">
            {/* Sidebar — drawer sur tous les formats */}
            <div
                className={cn(
                    "fixed inset-y-0 left-0 z-50 shadow-xl transition-transform duration-slow",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <Sidebar onNavigate={() => setSidebarOpen(false)} />
            </div>

            {/* Overlay */}
            {sidebarOpen && (
                <div
                    // eslint-disable-next-line nokk-project/no-restricted-syntax -- scrim/overlay volontairement noir quel que soit le thème (design system §12.4)
                    className="fixed inset-0 z-40 bg-black/50"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Contenu principal */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                <Header
                    title={title}
                    onMenuClick={() => setSidebarOpen(true)}
                />
                {/* `isolate` : crée un contexte d'empilement pour tout le
                    contenu applicatif. Sans lui, un z-index posé dans une
                    feature (ex. les en-têtes collants de l'agenda) concourt
                    directement avec le drawer de la sidebar (z-50) au niveau
                    racine et passe devant. Les portails Radix ne sont pas
                    concernés : ils rendent dans document.body, hors de ce
                    conteneur. */}
                <div className="flex-1 min-h-0 overflow-y-auto isolate">
                    {children}
                </div>
            </div>

            <PrivacyConsentDialog />
        </div>
    )
}
