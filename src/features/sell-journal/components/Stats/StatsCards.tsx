import { Euro, Receipt, ShoppingCart } from "lucide-react"
import { StatTile } from "@/shared/components/misc/StatTile"
import type { JournalEntry } from "@/features/journal/hooks/Journal_hook/useJournalEntry"

export function StatsCards({ entries }: { entries: JournalEntry[] }) {
    const totalCA = entries.reduce((s, e) => s + Number(e.sales), 0)
    const panierMoyen = entries.length ? Math.round(totalCA / entries.length) : 0

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
                index={0}
                icon={Euro}
                label="Chiffre d'affaire"
                value={`${totalCA.toLocaleString()} €`}
            />
            <StatTile
                index={1}
                icon={ShoppingCart}
                tone="success"
                label="Nombre de ventes"
                value={entries.length}
            />
            <StatTile
                index={2}
                icon={Receipt}
                tone="warning"
                label="Panier moyen"
                value={`${panierMoyen.toLocaleString()} €`}
            />
        </div>
    )
}
