import { TruckIcon } from "lucide-react"
import type { Delivery } from "@/features/stock/types/stock.types"

import DeliveryCard from "./LivraisonCard"
import { useDeliveryContext } from "@/features/stock/hooks/context/StockProvider"
import { GESTION_THEME } from "@/features/stock/theme"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

export default function DeliveryBoard() {
    const { filteredDeliveries, setSelectedDelivery, setDeliveryDetailSheetOpen } = useDeliveryContext()

    function openDetail(delivery: Delivery) {
        setSelectedDelivery(delivery)
        setDeliveryDetailSheetOpen(true)
    }

    if (!filteredDeliveries || filteredDeliveries.length === 0) {
        return (
            <EmptyState
                className={GESTION_THEME.board.emptyState}
                icon={TruckIcon}
                title="Aucune livraison enregistrée"
                description="Les livraisons créées apparaîtront ici."
            />
        )
    }

    return (
        <div className={GESTION_THEME.board.grid}>
            {filteredDeliveries.map((delivery: Delivery) => (
                <DeliveryCard
                    key={delivery.id}
                    din={delivery.din}
                    fournisseur={delivery.fournisseur?.name}
                    ballesCount={delivery.balles_count}
                    packing={delivery.packing}
                    deliveryDate={delivery.delivery_date}
                    deliveryType={delivery.delivery_type}
                    onClick={() => openDetail(delivery)}
                />
            ))}
        </div>
    )
}