import { useState } from "react"
import { format } from "date-fns"
import { Bomb, Hand, Move, Undo2 } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { useBalleHandpickContext } from "@/features/stock_handpick/hooks/context/StockHandpickProvider"
import { useBalleEmplacementHistory } from "@/features/stock_handpick/hooks/data/useBalleEmplacementHistory"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import { BalleEmplacementHistory } from "./BalleEmplacementHistory"
import { EmplacementPicker } from "./EmplacementPicker"
import { BalleEclaterButton } from "./BalleEclaterButton"
import { BalleMoveDialog } from "./BalleMoveDialog"

interface BalleEmplacementSectionProps {
    balle: BalleHandpick
    /** Emprunter et rendre modifient la balle : droit `inventaire.update`. */
    canBorrow: boolean
}

/**
 * Emprunt et historique d'emplacement d'une balle.
 *
 * Composant séparé de `BalleDetailSheet` : la fiche sort avant tout hook
 * quand aucune balle n'est ouverte, et l'historique se charge à la demande.
 *
 * Emprunter sort la balle de son emplacement. La rendre exige de choisir où
 * la ranger — par défaut, l'emplacement qu'elle a quitté à l'emprunt.
 * Éclater la sort définitivement du stock : plus d'emprunt possible ensuite.
 */
export function BalleEmplacementSection({ balle, canBorrow }: BalleEmplacementSectionProps) {
    const { emplacementOptions, emplacementPath, borrowBalle, returnBalle, eclaterBalle, moveBalles } =
        useBalleHandpickContext()
    const [moveOpen, setMoveOpen] = useState(false)

    const isBorrowed = balle.borrowed_by !== null
    const { events, userNames, loading } = useBalleEmplacementHistory(
        balle.id,
        `${balle.updated_at}|${balle.borrowed_by ?? ""}`,
        [balle.borrowed_by, balle.eclatee_by],
    )

    // Emplacement quitté au dernier emprunt : proposé par défaut au retour.
    const lastBorrow = events.find((event) => event.event === "borrowed")
    const defaultReturnId = lastBorrow?.emplacement_from_id ?? null

    // `undefined` = rien touché : on propose l'emplacement quitté, connu une
    // fois l'historique chargé. `null` = saisie en cours (chemin incomplet) :
    // le retour reste impossible.
    const [picked, setPicked] = useState<string | null | undefined>(undefined)
    const returnTo = picked === undefined ? defaultReturnId : picked
    const [busy, setBusy] = useState(false)

    const run = async (action: () => Promise<boolean>) => {
        setBusy(true)
        try {
            if (await action()) setPicked(undefined)
        } finally {
            setBusy(false)
        }
    }

    const borrowerName = balle.borrowed_by ? userNames.get(balle.borrowed_by) : null
    const eclateurName = balle.eclatee_by ? userNames.get(balle.eclatee_by) : null

    return (
        <div className="space-y-3">
            {balle.is_eclatee ? (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm">
                    <Bomb size={14} className="shrink-0 text-destructive" aria-hidden />
                    <span className="font-semibold text-foreground">Éclatée</span>
                    <span className="truncate text-xs text-muted-foreground">
                        {balle.eclatee_at &&
                            `le ${format(new Date(balle.eclatee_at), "dd/MM/yy à HH:mm")}`}
                        {eclateurName ? ` par ${eclateurName}` : null}
                    </span>
                </div>
            ) : isBorrowed ? (
                <div className="space-y-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-3">
                    <div className="flex items-center gap-2 text-sm">
                        <Hand size={14} className="shrink-0 text-warning" aria-hidden />
                        <span className="font-semibold text-foreground">Empruntée</span>
                        <span className="truncate text-xs text-muted-foreground">
                            {borrowerName ? `par ${borrowerName}` : null}
                            {balle.borrowed_at &&
                                ` · depuis le ${format(new Date(balle.borrowed_at), "dd/MM/yy à HH:mm")}`}
                        </span>
                    </div>

                    {canBorrow && (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                            <div className="flex-1 space-y-1">
                                <span className="text-sm font-medium">Ranger dans</span>
                                <EmplacementPicker
                                    idPrefix={`hp-return-${balle.id}`}
                                    options={emplacementOptions}
                                    value={returnTo}
                                    onChange={setPicked}
                                />
                            </div>
                            <Button
                                size="sm"
                                className="gap-1.5"
                                disabled={busy || !returnTo}
                                onClick={() => {
                                    if (returnTo) void run(() => returnBalle(balle.id, returnTo))
                                }}
                            >
                                <Undo2 size={13} aria-hidden />
                                Rendre
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                canBorrow && (
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={busy}
                            onClick={() => setMoveOpen(true)}
                        >
                            <Move size={13} aria-hidden />
                            Déplacer
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={busy}
                            onClick={() => void run(() => borrowBalle(balle.id))}
                        >
                            <Hand size={13} aria-hidden />
                            Emprunter
                        </Button>
                    </div>
                )
            )}

            {/* Éclatable qu'elle soit rangée ou empruntée : c'est souvent au
                handpick, une fois empruntée, qu'on l'ouvre. */}
            {!balle.is_eclatee && canBorrow && (
                <BalleEclaterButton
                    disabled={busy}
                    place={emplacementPath(balle.emplacement_id)}
                    isBorrowed={isBorrowed}
                    borrowerName={borrowerName ?? null}
                    onConfirm={() => eclaterBalle(balle.id)}
                />
            )}

            <BalleMoveDialog
                open={moveOpen}
                count={1}
                initialEmplacementId={balle.emplacement_id}
                onClose={() => setMoveOpen(false)}
                onConfirm={(emplacementId) => moveBalles([balle.id], emplacementId)}
            />

            <BalleEmplacementHistory
                events={events}
                userNames={userNames}
                loading={loading}
                emplacementPath={emplacementPath}
            />
        </div>
    )
}
