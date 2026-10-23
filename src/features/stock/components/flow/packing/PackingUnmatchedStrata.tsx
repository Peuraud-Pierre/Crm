import type { ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCheck } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { DURATION, EASE } from "@/shared/lib/motion"
import type { PackingGroup } from "@/features/stock/types/packing-list.types"

interface PackingUnmatchedStrataProps {
    groups: PackingGroup[]
    /** Le panneau a-t-il reçu de quoi écrire ? Pilote la légende clavier. */
    editable: boolean
    /** Nombre de propositions confirmables d'un bloc ; le bouton n'apparaît qu'à partir de 2. */
    bulkCount: number
    onBulkRequest: () => void
    /** Boutons montés par le panneau : reprise du classement, annulation. */
    actionsSlot: ReactNode
    renderCard: (group: PackingGroup, index: number) => ReactNode
    reducedMotion: boolean
}

/**
 * La strate « à classer » : le seul vrai travail, et sa barre d'outils.
 *
 * Extraite de `PackingReviewPanel`, qui franchissait le seuil de 400 lignes de
 * `CLAUDE.md` en accueillant l'annulation.
 *
 * La barre survit au dernier libellé classé dès qu'il y a quelque chose à
 * annuler : c'est précisément à ce moment-là qu'on veut pouvoir revenir sur une
 * décision, et la faire disparaître avec la dernière carte retirerait le geste
 * au moment où il sert le plus.
 */
export function PackingUnmatchedStrata({
    groups,
    editable,
    bulkCount,
    onBulkRequest,
    actionsSlot,
    renderCard,
    reducedMotion,
}: PackingUnmatchedStrataProps) {
    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-2">
                {groups.length > 0 && editable ? (
                    <p className="text-2xs text-muted-foreground">
                        <kbd className="rounded border border-border px-1">↑</kbd>{" "}
                        <kbd className="rounded border border-border px-1">↓</kbd> pour naviguer,{" "}
                        <kbd className="rounded border border-border px-1">Entrée</kbd> pour confirmer la
                        proposition — ou ouvrir la liste quand il n'y en a pas.{" "}
                        <kbd className="rounded border border-border px-1">Espace</kbd> ouvre toujours la
                        liste.
                    </p>
                ) : (
                    <span />
                )}
                <div className="flex items-center gap-1.5">
                    {bulkCount > 1 && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5"
                            onClick={onBulkRequest}
                        >
                            <CheckCheck size={13} aria-hidden />
                            Confirmer les {bulkCount} propositions
                        </Button>
                    )}
                    {actionsSlot}
                </div>
            </div>

            {/*
              * Le seul endroit de ce module qui justifie framer-motion : un
              * libellé classé QUITTE cette strate, et le CSS ne peut pas animer
              * un démontage. La carte glisse hors de « à classer », puis
              * réapparaît sous « Classés » avec son entrée CSS habituelle —
              * cette paire EST la confirmation du geste, il n'y a pas d'éclat de
              * succès à inventer.
              */}
            <AnimatePresence initial={false}>
                {groups.map((group, index) => (
                    <motion.div
                        key={group.key}
                        layout={!reducedMotion}
                        exit={
                            reducedMotion
                                ? { opacity: 0 }
                                : { opacity: 0, x: 24, height: 0, marginTop: 0 }
                        }
                        transition={{
                            duration: reducedMotion ? 0 : DURATION.base,
                            ease: EASE.emphasized,
                        }}
                        className="overflow-hidden"
                    >
                        {renderCard(group, index)}
                    </motion.div>
                ))}
            </AnimatePresence>
        </>
    )
}
