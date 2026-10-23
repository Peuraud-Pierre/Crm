import { Building2 } from "lucide-react"
import { AvailabilityEditor } from "./AvailabilityEditor"
import { useCompanyAvailability } from "../hooks/useCompanyAvailability"

/**
 * Édition des JOURS DE FERMETURE d'ENTREPRISE (globaux). Réservé aux Admins.
 * À l'enregistrement, les fermetures sont appliquées au réglage global Amelia et
 * bloquent les réservations de tous les commerciaux. Les horaires hebdomadaires
 * restent gérés individuellement (onglet « Gérer les disponibilités »).
 */
export function CompanyAvailability() {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-slow">
                <Building2 className="h-4 w-4 text-primary" />
                Ces périodes de fermeture s'appliquent à toute l'entreprise et
                bloquent les réservations de tous les commerciaux dans Amelia.
            </div>
            <AvailabilityEditor
                title="Périodes de fermeture de l'entreprise"
                useController={useCompanyAvailability}
                onlyDaysOff
            />
        </div>
    )
}
