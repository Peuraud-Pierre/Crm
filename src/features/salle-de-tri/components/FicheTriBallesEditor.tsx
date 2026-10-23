import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react"
import { Building2, Plus, Tags } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { useReferentialContext } from "@/features/stock"
import { useTriContext } from "@/features/salle-de-tri/hooks/context/TriContext"
import { balleProbleme, newBalle, type BalleDraft } from "@/features/salle-de-tri/utils/triDraft"
import { BalleCard } from "./BalleCard"

interface FicheTriBallesEditorProps {
    balles: BalleDraft[]
    setBalles: Dispatch<SetStateAction<BalleDraft[]>>
    /** Affiche les problèmes bloquants (après une tentative d'enregistrement). */
    showErrors: boolean
}

/**
 * Les balles d'une fiche, une carte chacune, pensées pour recopier une
 * feuille papier au clavier : `Entrée` fait avancer de champ en champ et,
 * depuis la note de la dernière balle, en ouvre une nouvelle (qui reprend
 * fournisseur et catégorie) avec le curseur sur son poids.
 */
export function FicheTriBallesEditor({ balles, setBalles, showErrors }: FicheTriBallesEditorProps) {
    const { categories, fournisseurs } = useReferentialContext()
    const { sorties } = useTriContext()
    const containerRef = useRef<HTMLDivElement>(null)
    // Balle dont le poids doit prendre le focus après le rendu qui la crée :
    // une ref, pas un état — le focus ne doit pas provoquer de rendu.
    const focusKeyRef = useRef<string | null>(null)

    useEffect(() => {
        if (!focusKeyRef.current) return
        containerRef.current?.querySelector<HTMLInputElement>(`[data-poids="${focusKeyRef.current}"]`)?.focus()
        focusKeyRef.current = null
    })

    const categoryOptions = useMemo(
        () => categories
            .filter((c) => c.name)
            .map((c) => ({ value: c.id, label: c.name, icon: Tags }))
            .sort((a, b) => a.label.localeCompare(b.label, "fr")),
        [categories],
    )
    const fournisseurOptions = useMemo(
        () => fournisseurs
            .map((f) => ({ value: f.id, label: f.name, icon: Building2 }))
            .sort((a, b) => a.label.localeCompare(b.label, "fr")),
        [fournisseurs],
    )
    const sortiesActives = useMemo(() => sorties.filter((s) => s.actif), [sorties])

    // Mises à jour fonctionnelles : les cartes, mémoïsées, gardent des
    // rappels stables et ne se redessinent que quand LEUR balle change.
    const patch = useCallback(
        (key: string, partial: Partial<BalleDraft>) =>
            setBalles((prev) => prev.map((b) => (b.key === key ? { ...b, ...partial } : b))),
        [setBalles],
    )

    const remove = useCallback(
        (key: string) => setBalles((prev) => {
            const rest = prev.filter((b) => b.key !== key)
            return rest.length ? rest : [newBalle()]
        }),
        [setBalles],
    )

    const addAfter = useCallback((index: number) => {
        setBalles((prev) => {
            const created = newBalle(prev[index])
            focusKeyRef.current = created.key
            return [...prev.slice(0, index + 1), created, ...prev.slice(index + 1)]
        })
    }, [setBalles])

    // Depuis la dernière balle on en ouvre une ; ailleurs on passe à la
    // suivante — on corrige une feuille, on ne la rallonge pas.
    const next = useCallback((index: number) => {
        const nextKey = containerRef.current
            ?.querySelectorAll<HTMLElement>("[data-balle]")[index + 1]
            ?.dataset.balle
        if (nextKey) containerRef.current?.querySelector<HTMLInputElement>(`[data-poids="${nextKey}"]`)?.focus()
        else addAfter(index)
    }, [addAfter])

    return (
        <div ref={containerRef} className="flex flex-col gap-3">
            {balles.map((balle, index) => (
                <BalleCard
                    key={balle.key}
                    balle={balle}
                    index={index}
                    fournisseurOptions={fournisseurOptions}
                    categoryOptions={categoryOptions}
                    sorties={sortiesActives}
                    probleme={showErrors ? balleProbleme(balle) : null}
                    onPatch={patch}
                    onRemove={remove}
                    onNext={next}
                />
            ))}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="outline" className="h-10 w-full sm:w-auto" onClick={() => addAfter(balles.length - 1)}>
                    <Plus size={16} />
                    Ajouter une balle
                </Button>
                <p className="hidden text-xs text-muted-foreground md:block">
                    <kbd className="rounded border border-border px-1 font-mono">Entrée</kbd> passe au champ suivant
                    et ouvre une nouvelle balle depuis la dernière note · qualité aux touches 1, 2, 3
                </p>
            </div>
        </div>
    )
}
