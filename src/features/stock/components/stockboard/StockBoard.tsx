import { useStockUIContext } from "../../hooks/context/StockProvider"
import BalleBoard from "./balle/BalleBoard"
import FilterBar from "./StockFilterBar"
import BalleCreationSheet from "./balle/BalleCreationSheet"
import DeliveryCreationSheet from "./livraison/LivraisonCreationSheet"
import DeliveryBoard from "./livraison/LivraisonBoard"
import BalleSheet from "./balle/BalleSheet"
import DeliverySheet from "./livraison/LivraisonSheet"

export default function StockBoard() {
    const { viewMode } = useStockUIContext()

    return (
        <div className="flex flex-col h-full gap-4 p-4">
            <FilterBar />
            {viewMode === "balles" ? <BalleBoard /> : <DeliveryBoard />}

            <BalleCreationSheet />
            <DeliveryCreationSheet />
            <BalleSheet />
            <DeliverySheet />
        </div>
    )
}
