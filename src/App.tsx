import { AppProviders } from "@/app/providers"
import { AuthOutroLayer } from "@/features/auth/components/outro/AuthOutroLayer"
import { router } from "@/app/routes"
import { UpdateBanner } from "@/shared/components/misc/UpdateBanner"
import { RouterProvider } from "react-router/dom"

const App = () => {
    return (
        <AppProviders>
            <RouterProvider router={router} />
            {/* Hors du routeur : le bandeau doit survivre aux changements de
                route, et rester visible quelle que soit la page ouverte. */}
            <UpdateBanner />
            {/* Outro de connexion : hors du routeur pour survivre au passage
                de l'écran de connexion à l'application. */}
            <AuthOutroLayer />
        </AppProviders>
    )
}

export default App
