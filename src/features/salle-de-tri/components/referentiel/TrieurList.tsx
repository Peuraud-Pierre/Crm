import { useMemo, useState } from "react"
import { Search, UserRound } from "lucide-react"
import { Input } from "@/shared/ui/atoms/input"
import { cn } from "@/shared/lib/utils"
import { useTriContext } from "@/features/salle-de-tri/hooks/context/TriContext"
import type { Trieur } from "@/features/salle-de-tri/types/tri.types"
import { ReferentielCard } from "./ReferentielCard"
import { ActifSwitch, InlineEdit, RowMenu } from "./RowControls"
import type { ReferentielRights } from "./rights"

/** Au-delà, la liste se filtre : on cherche un nom plutôt qu'on ne le parcourt. */
const SEARCH_FROM = 8

/**
 * Les trieurs : les personnes dont on saisit les feuilles, sans compte sur la
 * console. Actifs d'abord ; un trieur qui part se DÉSACTIVE plutôt qu'il ne
 * se supprime — ses fiches le référencent et ses statistiques restent.
 */
export function TrieurList({ canCreate, canUpdate, canDelete, className }: ReferentielRights & { className?: string }) {
    const { trieurs, fiches, createTrieur, updateTrieur, deleteTrieur } = useTriContext()
    const [editing, setEditing] = useState<string | null>(null)
    const [query, setQuery] = useState("")

    const fichesParTrieur = useMemo(() => {
        const counts = new Map<string, number>()
        for (const f of fiches) counts.set(f.trieur_id, (counts.get(f.trieur_id) ?? 0) + 1)
        return counts
    }, [fiches])

    const visibles = useMemo(() => {
        const q = query.trim().toLowerCase()
        return trieurs
            .filter((t) => !q || t.nom.toLowerCase().includes(q))
            .sort((a, b) => Number(b.actif) - Number(a.actif) || a.nom.localeCompare(b.nom, "fr"))
    }, [trieurs, query])

    const actifs = trieurs.filter((t) => t.actif).length

    return (
        <ReferentielCard
            className={className}
            icon={UserRound}
            title="Trieurs"
            count={trieurs.length}
            description={`${actifs} actif${actifs > 1 ? "s" : ""} · pas besoin de compte pour en saisir les feuilles`}
            add={canCreate ? {
                label: "Ajouter",
                fields: [{ key: "nom", placeholder: "Nom du trieur" }],
                onAdd: async (v) => !!(await createTrieur({ nom: v.nom.trim(), actif: true })),
            } : undefined}
            toolbar={trieurs.length > SEARCH_FROM && (
                <div className="relative w-40 shrink-0">
                    <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher" aria-label="Chercher un trieur" className="h-8 pl-8 text-sm" />
                </div>
            )}
        >
            {visibles.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                    {trieurs.length === 0 ? "Ajoutez les trieurs pour pouvoir saisir leurs feuilles." : "Aucun trieur ne porte ce nom."}
                </p>
            ) : (
                <ul className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
                    {visibles.map((t) => (
                        <TrieurRow
                            key={t.id}
                            trieur={t}
                            fiches={fichesParTrieur.get(t.id) ?? 0}
                            editing={editing === t.id}
                            onEdit={canUpdate ? () => setEditing(t.id) : undefined}
                            onCancel={() => setEditing(null)}
                            onRename={async (nom) => updateTrieur(t.id, { nom })}
                            onToggle={canUpdate ? (actif) => void updateTrieur(t.id, { actif }) : undefined}
                            onDelete={canDelete ? () => deleteTrieur(t.id) : undefined}
                        />
                    ))}
                </ul>
            )}
        </ReferentielCard>
    )
}

interface TrieurRowProps {
    trieur: Trieur
    fiches: number
    editing: boolean
    onEdit?: () => void
    onCancel: () => void
    onRename: (nom: string) => Promise<boolean>
    onToggle?: (actif: boolean) => void
    onDelete?: () => Promise<boolean>
}

function TrieurRow({ trieur, fiches, editing, onEdit, onCancel, onRename, onToggle, onDelete }: TrieurRowProps) {
    return (
        <li className="flex min-h-14 items-center gap-3 px-4 py-2 sm:border-b sm:border-border sm:odd:border-r">
            {editing ? (
                <InlineEdit
                    fields={[{ key: "nom", label: "Nom du trieur", value: trieur.nom }]}
                    onCancel={onCancel}
                    onSave={(v) => onRename(v.nom.trim())}
                />
            ) : (
                <>
                    <span className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        trieur.actif ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )} aria-hidden>
                        {trieur.nom.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className={cn("truncate text-sm font-medium", !trieur.actif && "text-muted-foreground")}>{trieur.nom}</span>
                        <span className="text-xs text-muted-foreground">
                            {fiches === 0 ? "Aucune fiche sur la période" : `${fiches} fiche${fiches > 1 ? "s" : ""} sur la période`}
                        </span>
                    </span>
                    <ActifSwitch actif={trieur.actif} label={trieur.nom} onChange={onToggle} />
                    <RowMenu
                        label={trieur.nom}
                        onEdit={onEdit}
                        remove={onDelete && {
                            hint: "Impossible s'il a déjà des fiches : désactivez-le plutôt, il restera dans l'historique.",
                            onConfirm: onDelete,
                        }}
                    />
                </>
            )}
        </li>
    )
}
