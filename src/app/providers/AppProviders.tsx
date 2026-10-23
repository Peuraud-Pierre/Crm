import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/features/auth/hooks/useAuth/AuthProvider"
import { MaintenanceProvider } from "@/features/maintenance"
import { SessionKeyProvider } from "@/shared/lib/SessionKeyContext"
import { Toaster as Sonner } from "@/shared/ui/atoms/sonner"
import { TooltipProvider } from "@/shared/ui/atoms/tooltip"
import { InstallPrompt } from "@/shared/components/pwa/InstallPrompt"
import { PushPermissionPrompt } from "@/shared/components/pwa/PushPermissionPrompt"
import { ThemeProvider } from "@/app/providers/ThemeProvider"
import { UserPreferencesProvider } from "@/features/profile/hooks/context/UserPreferencesProvider"

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 10,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            refetchInterval: false,
        },
    },
})

export function AppProviders({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider>
            <SessionKeyProvider>
                <QueryClientProvider client={queryClient}>
                    <TooltipProvider>
                        <AuthProvider>
                            {/* Sous AuthProvider (useAuth) et ThemeProvider
                                (useTheme) : source unique des préférences,
                                dont le thème appliqué au démarrage. */}
                            <UserPreferencesProvider>
                                {/* Ni les annonces ni le changelog ne sont
                                    chargés ici : ces deux providers globaux
                                    faisaient télécharger leurs tables à
                                    chaque utilisateur dès l'ouverture, y
                                    compris sur les pages qui n'en affichent
                                    rien. Leurs consommateurs (widgets du
                                    dashboard, console Manager) les demandent
                                    désormais eux-mêmes. Seule la maintenance
                                    reste globale : elle garde toute
                                    l'application. */}
                                <MaintenanceProvider>
                                    <Sonner />
                                    {children}
                                    <InstallPrompt />
                                    <PushPermissionPrompt />
                                </MaintenanceProvider>
                            </UserPreferencesProvider>
                        </AuthProvider>
                    </TooltipProvider>
                </QueryClientProvider>
            </SessionKeyProvider>
        </ThemeProvider>
    )
}
