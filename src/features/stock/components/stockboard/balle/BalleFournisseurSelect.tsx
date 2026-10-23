import { useMemo } from "react"
import { Building2 } from "lucide-react"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import { useBalleContext, useReferentialContext } from "@/features/stock/hooks/context/StockProvider"

export default function FournisseurSelect() {
    const { balleCreationFormData, setBalleCreationFormData } = useBalleContext()
    const { fournisseurs } = useReferentialContext()

    const options = useMemo(
        () => fournisseurs?.map(f => ({ value: f.id, label: f.name, icon: Building2 })) ?? [],
        [fournisseurs]
    )

    return (
        <SearchSelect
            options={options}
            value={balleCreationFormData?.fournisseur_id ?? ""}
            onChange={(id) => setBalleCreationFormData({ ...balleCreationFormData, fournisseur_id: id })}
            placeholder="Rechercher un fournisseur..."
            variant="input"
            size="md"
            showValidation
            label="Fournisseur"
            tooltip="Sélectionnez le partenaire à l'origine de la marchandise pour l'identification de la livraison (DIN)."
            emptyMessage="Aucun fournisseur trouvé"
            className="max-w-md"
        />
    )
}
