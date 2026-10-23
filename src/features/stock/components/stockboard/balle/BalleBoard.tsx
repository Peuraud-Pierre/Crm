import { useState, useEffect } from "react"
import { PackageX } from "lucide-react"
import type { Balle } from "@/features/stock/types/stock.types"
import BalleCard from "./BalleCard"

import { useBalleContext } from "@/features/stock/hooks/context/StockProvider"
import { GESTION_THEME } from "@/features/stock/theme"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { LoadMore } from "@/shared/ui/molecules/load-more"
import { BALLE_INITIAL_LIMIT as INITIAL_LIMIT, BALLE_LOAD_MORE_INCREMENT as LOAD_MORE_INCREMENT } from "@/features/stock/constants"

export default function BalleBoard() {
    const { filteredBalles, setSelectedBalle, setBalleDetailSheetOpen } = useBalleContext()

    function openDetail(balle: Balle) {
        setSelectedBalle(balle)
        setBalleDetailSheetOpen(true)
    }
    const [visibleCount, setVisibleCount] = useState(INITIAL_LIMIT)

    // Réinitialiser la limite si les filtres changent (reset dérivé des filtres)
    useEffect(() => {
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setVisibleCount(INITIAL_LIMIT)
    }, [filteredBalles])

    if (!filteredBalles || filteredBalles.length === 0) {
        return (
            <EmptyState
                className={GESTION_THEME.board.emptyState}
                icon={PackageX}
                title="Aucune balle en stock"
                description="Les balles créées apparaîtront ici."
            />
        )
    }

    // On découpe le tableau pour n'afficher que la portion souhaitée
    const visibleBalles = filteredBalles.slice(0, visibleCount)
    const hasMore = visibleCount < filteredBalles.length

    const handleLoadMore = () => {
        setVisibleCount((prev) => prev + LOAD_MORE_INCREMENT)
    }

    return (
        <div className="flex flex-col items-center w-full space-y-8">
            <div className={GESTION_THEME.board.grid}>
                {visibleBalles.map((balle: Balle) => (
                    <BalleCard
                        key={balle.id || balle.bin}
                        bin={balle.bin}
                        weight={balle.packing}
                        category={balle.category?.name || "Sans catégorie"}
                        rawName={balle.raw_name}
                        location={balle.location || "warehouse"}
                        status={balle.status || "stocked"}
                        date={balle.import_date}
                        onClick={() => openDetail(balle)}
                    />
                ))}
            </div>

            {hasMore && (
                <LoadMore
                    onClick={handleLoadMore}
                    className={GESTION_THEME.board.loadMore}
                    remaining={filteredBalles.length - visibleCount}
                />
            )}
        </div>
    )
}
