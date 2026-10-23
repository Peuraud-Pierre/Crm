import { expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"

/**
 * Garde-fou de montage du Toaster.
 *
 * Depuis la consolidation vers Sonner, `<Sonner />` dans `AppProviders` est le
 * SEUL point de montage des toasts de toute l'application : le retirer les
 * ferait disparaître partout, silencieusement, sans qu'aucun test n'échoue
 * (les ~60 appels `toast.*` continuent de s'exécuter sans rien afficher).
 *
 * Tous les providers sont neutralisés : ce test ne vérifie que la présence du
 * Toaster dans l'arbre, pas leur comportement.
 */
const passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>
const nothing = () => null

rstest.mock("@/app/providers/ThemeProvider", () => ({ ThemeProvider: passthrough }))
rstest.mock("@/shared/lib/SessionKeyContext", () => ({ SessionKeyProvider: passthrough }))
rstest.mock("@/shared/ui/atoms/tooltip", () => ({ TooltipProvider: passthrough }))
rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({ AuthProvider: passthrough }))
rstest.mock("@/features/profile/hooks/context/UserPreferencesProvider", () => ({
    UserPreferencesProvider: passthrough,
}))
rstest.mock("@/features/maintenance", () => ({
    MaintenanceProvider: passthrough,
}))
rstest.mock("@/shared/components/pwa/InstallPrompt", () => ({ InstallPrompt: nothing }))
rstest.mock("@/shared/components/pwa/PushPermissionPrompt", () => ({
    PushPermissionPrompt: nothing,
}))
rstest.mock("@/shared/ui/atoms/sonner", () => ({
    Toaster: () => <div data-testid="toaster" />,
}))

const { AppProviders } = await import("./AppProviders")

test("monte le Toaster et rend ses enfants", () => {
    render(
        <AppProviders>
            <p>contenu</p>
        </AppProviders>
    )

    expect(screen.getByTestId("toaster")).toBeTruthy()
    expect(screen.getByText("contenu")).toBeTruthy()
})
