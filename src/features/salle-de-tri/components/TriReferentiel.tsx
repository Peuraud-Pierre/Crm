import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { TRI_PERMISSIONS } from "@/features/salle-de-tri/constants"
import { SortieList } from "./referentiel/SortieList"
import { TrieurList } from "./referentiel/TrieurList"

/**
 * Référentiel propre à la salle de tri : les trieurs et les types de sortie,
 * côte à côte sur grand écran, empilés en mobile. Il vit dans la page et non
 * dans Paramètres : le responsable de la salle de tri le gère sans avoir
 * besoin des droits sur les référentiels de l'entrepôt.
 */
export function TriReferentiel() {
    const { hasPermission } = useAuth()
    const rights = {
        canCreate: hasPermission(TRI_PERMISSIONS.create),
        canUpdate: hasPermission(TRI_PERMISSIONS.update),
        canDelete: hasPermission(TRI_PERMISSIONS.delete),
    }
    return (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <TrieurList {...rights} className="lg:col-span-2" />
            <SortieList {...rights} />
        </div>
    )
}
