import { useParams } from "react-router"
import { CommandeProvider } from "../hooks/context/CommandeContext"
import CommandesBoard from "../components/CommandesBoard"

/**
 * Page Commandes boutiques — `/commandes/:detail?` (+ `?vue=`).
 *
 * Page à part et non onglet de /stock : l'outil du service commande et des
 * boutiques. Lié au stock principal par ses catégories (`ReferentialProvider`,
 * monté par le routeur) et par son journal.
 */
export default function Commandes() {
    const { detail } = useParams()
    return (
        <CommandeProvider>
            <CommandesBoard detail={detail} />
        </CommandeProvider>
    )
}
