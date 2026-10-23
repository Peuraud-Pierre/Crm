import { useState } from "react"
import { MapPin, Plus, Ruler, Store } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { BoardHeader } from "@/shared/ui/molecules/board-header"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { cn } from "@/shared/lib/utils"
import { MAGASIN_THEME } from "@/features/magasins/theme"
import type { useMagasins } from "@/features/magasins/hooks/data/useMagasins"
import { MagasinFormSheet } from "./MagasinFormSheet"

interface MagasinsBoardProps {
    data: ReturnType<typeof useMagasins>
    canCreate: boolean
    onOpen: (id: string) => void
}

/** Liste des magasins : une carte par magasin, qui ouvre son plan. */
export function MagasinsBoard({ data, canCreate, onOpen }: MagasinsBoardProps) {
    const [creating, setCreating] = useState(false)
    // Chaque ouverture remonte la sheet : son formulaire repart du magasin.
    const [formKey, setFormKey] = useState(0)
    const toggleForm = (open: boolean) => {
        if (open) setFormKey((k) => k + 1)
        setCreating(open)
    }
    const { magasins, loading, error } = data
    const actifs = magasins.filter((m) => m.is_active).length

    return (
        <div className="flex flex-col gap-5 p-4">
            <BoardHeader
                title="Magasins"
                theme={MAGASIN_THEME.section}
                description={loading ? "Chargement…" : `${actifs} magasin${actifs > 1 ? "s" : ""} actif${actifs > 1 ? "s" : ""}`}
                action={canCreate ? { label: "Nouveau magasin", onClick: () => toggleForm(true), icon: Plus } : undefined}
            />

            {loading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-32 rounded-xl" />
                    ))}
                </div>
            ) : error ? (
                <EmptyState variant="error" title={error} action={{ label: "Réessayer", onClick: () => void data.refetch() }} />
            ) : magasins.length === 0 ? (
                <EmptyState
                    icon={Store}
                    title="Aucun magasin"
                    description="Créez un magasin pour dessiner son plan et gérer ses emplacements."
                    action={canCreate ? { label: "Créer un magasin", onClick: () => toggleForm(true), icon: Plus } : undefined}
                    className={MAGASIN_THEME.board.emptyState}
                />
            ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {magasins.map((m) => (
                        <li key={m.id}>
                            <button
                                type="button"
                                onClick={() => onOpen(m.id)}
                                className={cn(
                                    "flex h-full w-full flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    !m.is_active && "opacity-60",
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <Store size={18} className="shrink-0 text-primary" />
                                    <span className="truncate font-semibold text-foreground">{m.nom}</span>
                                    <Badge variant="secondary" className="ml-auto shrink-0">
                                        {m.code}
                                    </Badge>
                                </div>
                                {(m.adresse || m.ville) && (
                                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                        <MapPin size={14} className="shrink-0" />
                                        <span className="truncate">{[m.adresse, m.ville].filter(Boolean).join(", ")}</span>
                                    </p>
                                )}
                                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <Ruler size={14} className="shrink-0" />
                                    {m.largeur.toLocaleString("fr-FR")} × {m.profondeur.toLocaleString("fr-FR")} m
                                </p>
                                {!m.is_active && <Badge variant="outline" className="w-fit">Inactif</Badge>}
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <MagasinFormSheet
                key={formKey}
                open={creating}
                magasin={null}
                onClose={() => toggleForm(false)}
                onSubmit={async (input) => {
                    const created = await data.create(input)
                    if (created) onOpen(created.id)
                    return created !== null
                }}
            />
        </div>
    )
}
