import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ListTree } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"
import { useTriContext } from "@/features/salle-de-tri/hooks/context/TriContext"
import type { TriSortie } from "@/features/salle-de-tri/types/tri.types"
import { useSortieColor } from "../RepartitionBar"
import { ReferentielCard } from "./ReferentielCard"
import { ActifSwitch, InlineEdit, RowMenu } from "./RowControls"
import type { ReferentielRights } from "./rights"

const upper = (raw: string) => raw.toUpperCase().replace(/\s/g, "")

/**
 * Les types de sortie (MAG, KS, SO3, EXPORT…). Leur ORDRE est celui des
 * colonnes de répartition à la saisie et fixe leur couleur partout : les
 * flèches le changent. Un type utilisé se désactive plutôt qu'il ne se
 * supprime.
 */
export function SortieList({ canCreate, canUpdate, canDelete, className }: ReferentielRights & { className?: string }) {
    const { sorties, createSortie, updateSortie, deleteSortie } = useTriContext()
    const color = useSortieColor()
    const [editing, setEditing] = useState<string | null>(null)
    const [moving, setMoving] = useState(false)

    // L'ordre du référentiel tel que la base le rend (ordre, puis code).
    const ordered = useMemo(() => [...sorties], [sorties])

    /** Échange deux voisins, puis renumérote 1…n ce qui a bougé. */
    const move = async (index: number, delta: -1 | 1) => {
        const target = index + delta
        if (target < 0 || target >= ordered.length) return
        const next = [...ordered]
        ;[next[index], next[target]] = [next[target], next[index]]
        setMoving(true)
        try {
            for (const [i, s] of next.entries()) {
                if (s.ordre !== i + 1 && !(await updateSortie(s.id, { ordre: i + 1 }))) break
            }
        } finally {
            setMoving(false)
        }
    }

    return (
        <ReferentielCard
            className={className}
            icon={ListTree}
            title="Types de sortie"
            count={sorties.length}
            description="Colonnes de la répartition, dans cet ordre ; l'ordre fixe aussi leur couleur."
            add={canCreate ? {
                label: "Ajouter",
                fields: [
                    { key: "code", placeholder: "Code", className: "w-24", format: upper },
                    { key: "libelle", placeholder: "Libellé" },
                ],
                onAdd: async (v) =>
                    !!(await createSortie({ code: v.code, libelle: v.libelle.trim(), ordre: sorties.length + 1, actif: true })),
            } : undefined}
        >
            {ordered.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Ajoutez au moins un type pour pouvoir répartir les balles.</p>
            ) : (
                <ol className="flex flex-col divide-y divide-border">
                    {ordered.map((s, i) => (
                        <li key={s.id} className="flex min-h-14 items-center gap-2 px-4 py-2">
                            {editing === s.id ? (
                                <InlineEdit
                                    fields={[
                                        { key: "code", label: "Code", value: s.code, className: "w-24", format: upper },
                                        { key: "libelle", label: "Libellé", value: s.libelle },
                                    ]}
                                    onCancel={() => setEditing(null)}
                                    onSave={(v) => updateSortie(s.id, { code: v.code, libelle: v.libelle.trim() })}
                                />
                            ) : (
                                <SortieRow
                                    sortie={s}
                                    color={color(s.id)}
                                    first={i === 0}
                                    last={i === ordered.length - 1}
                                    moving={moving}
                                    onMove={canUpdate ? (delta) => void move(i, delta) : undefined}
                                    onToggle={canUpdate ? (actif) => void updateSortie(s.id, { actif }) : undefined}
                                    onEdit={canUpdate ? () => setEditing(s.id) : undefined}
                                    onDelete={canDelete ? () => deleteSortie(s.id) : undefined}
                                />
                            )}
                        </li>
                    ))}
                </ol>
            )}
        </ReferentielCard>
    )
}

interface SortieRowProps {
    sortie: TriSortie
    color: string
    first: boolean
    last: boolean
    moving: boolean
    onMove?: (delta: -1 | 1) => void
    onToggle?: (actif: boolean) => void
    onEdit?: () => void
    onDelete?: () => Promise<boolean>
}

function SortieRow({ sortie, color, first, last, moving, onMove, onToggle, onEdit, onDelete }: SortieRowProps) {
    return (
        <>
            {onMove && (
                <span className="flex shrink-0 flex-col">
                    <Button type="button" variant="ghost" size="sm" className="h-5 w-6 p-0 text-muted-foreground" disabled={first || moving}
                        onClick={() => onMove(-1)} aria-label={`Monter ${sortie.code}`}>
                        <ArrowUp size={12} />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-5 w-6 p-0 text-muted-foreground" disabled={last || moving}
                        onClick={() => onMove(1)} aria-label={`Descendre ${sortie.code}`}>
                        <ArrowDown size={12} />
                    </Button>
                </span>
            )}
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
            <span className={cn("flex min-w-0 flex-1 items-baseline gap-2", !sortie.actif && "opacity-60")}>
                <span className="font-mono text-sm font-semibold">{sortie.code}</span>
                <span className="truncate text-sm text-muted-foreground">{sortie.libelle}</span>
            </span>
            <ActifSwitch actif={sortie.actif} label={sortie.code} onChange={onToggle} />
            <RowMenu
                label={sortie.code}
                onEdit={onEdit}
                remove={onDelete && {
                    hint: "Impossible s'il est utilisé par une fiche : désactivez-le plutôt, il disparaîtra de la saisie.",
                    onConfirm: onDelete,
                }}
            />
        </>
    )
}
