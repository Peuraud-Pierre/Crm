import { useMemo } from "react"
import { Building2 } from "lucide-react"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import { useDeliveryContext, useReferentialContext } from "@/features/stock/hooks/context/StockProvider"

export default function FournisseurSelectControlled() {
    const { fournisseurs } = useReferentialContext()
    const { deliveryCreationFormData, setDeliveryCreationFormData } = useDeliveryContext()

    const options = useMemo(
        () => fournisseurs?.map(f => ({ value: f.id, label: f.name, icon: Building2 })) ?? [],
        [fournisseurs]
    )

    return (
        <SearchSelect
            options={options}
            value={deliveryCreationFormData?.fournisseur_id ?? ""}
            onChange={(id) => setDeliveryCreationFormData({ ...deliveryCreationFormData, fournisseur_id: id })}
            placeholder="Rechercher un fournisseur..."
            variant="input"
            size="md"
            showValidation
            required
            label="Fournisseur"
            tooltip="Sélectionnez le partenaire à l'origine de la marchandise."
            tooltipSide="right"
            emptyMessage="Aucun résultat"
            className="max-w-md"
        />
    )
}
