import { useEffect } from "react"
import { useNavigate } from "react-router"
import { OUTRO_EXIT_MS, authOutro } from "./outroStore"

/**
 * Relais de l'outro, rendu par PublicOnlyLayout à la place de la redirection
 * immédiate quand l'utilisateur vient de se connecter : l'écran de connexion
 * reste monté le temps que sa feuille sorte, puis la surcouche reprend le
 * logo à sa place exacte et seulement alors on navigue. Naviguer plus tôt
 * démonterait l'écran (et le logo) avant que la surcouche ne l'ait mesuré.
 */
export function OutroHandoff({ to }: { to: string }) {
    const navigate = useNavigate()

    useEffect(() => {
        authOutro.exit()
        const id = setTimeout(() => {
            authOutro.takeOver()
            void navigate(to, { replace: true })
        }, OUTRO_EXIT_MS)
        return () => clearTimeout(id)
    }, [navigate, to])

    return null
}
