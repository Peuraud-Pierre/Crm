import { useParams } from "react-router"
import { TriProvider } from "../hooks/context/TriContext"
import TriBoard from "../components/TriBoard"

/**
 * Page Salle de tri — `/salle-de-tri/:detail?`.
 *
 * Page à part et non onglet de /stock : c'est l'outil du responsable de la
 * salle de tri, isolé de la gestion globale de l'entrepôt. Il en partage
 * les référentiels (`ReferentialProvider`, monté par le routeur) et le
 * journal (`activity_log`, consultable dans Stock → Historique).
 */
export default function SalleTri() {
    const { detail } = useParams()
    return (
        <TriProvider>
            <TriBoard detail={detail} />
        </TriProvider>
    )
}
