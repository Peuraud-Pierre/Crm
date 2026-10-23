import { useState } from "react"
import { MapPin, MapPinOff } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { useBalleHandpickContext } from "@/features/stock_handpick/hooks/context/StockHandpickProvider"
import { EmplacementPicker } from "./EmplacementPicker"

interface BalleMoveDialogProps {
    open: boolean
    /** Nombre de balles déplacées : 1 depuis une fiche, N depuis la sélection. */
    count: number
    /** Emplacement proposé à l'ouverture (celui de la balle, pour une seule). */
    initialEmplacementId?: string | null
    onClose: () => void
    /** Vrai si le déplacement a abouti : la fenêtre ne se ferme qu'alors. */
    onConfirm: (emplacementId: string | null) => Promise<boolean>
}

/**
 * Déplacer une ou plusieurs balles vers un même emplacement.
 *
 * « Retirer de l'emplacement » est un choix explicite : le sélecteur renvoie
 * aussi `null` tant que le chemin est incomplet, et un chemin inachevé ne
 * doit jamais sortir des balles de leur rayonnage par erreur.
 */
export function BalleMoveDialog(props: BalleMoveDialogProps) {
    // Monté à l'ouverture seulement : chaque ouverture repart de l'emplacement
    // proposé, sans effet de resynchronisation.
    return (
        <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
            {props.open && <MoveDialogBody {...props} />}
        </Dialog>
    )
}

function MoveDialogBody({ count, initialEmplacementId = null, onClose, onConfirm }: BalleMoveDialogProps) {
    const { emplacementOptions } = useBalleHandpickContext()
    const [mode, setMode] = useState<"place" | "unplace">("place")
    const [target, setTarget] = useState<string | null>(initialEmplacementId)
    const [busy, setBusy] = useState(false)

    const noun = count > 1 ? `ces ${count} balles` : "cette balle"
    const ready = mode === "unplace" || target !== null

    const submit = async () => {
        setBusy(true)
        try {
            if (await onConfirm(mode === "unplace" ? null : target)) onClose()
        } finally {
            setBusy(false)
        }
    }

    return (
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Déplacer {noun}</DialogTitle>
                <DialogDescription>
                    Les balles empruntées ou éclatées sont ignorées : une balle empruntée se range
                    avec « Rendre », depuis sa fiche.
                </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Destination">
                <Button
                    type="button"
                    variant={mode === "place" ? "default" : "outline"}
                    aria-pressed={mode === "place"}
                    className="h-10 gap-1.5"
                    onClick={() => setMode("place")}
                >
                    <MapPin size={14} aria-hidden />
                    Ranger dans…
                </Button>
                <Button
                    type="button"
                    variant={mode === "unplace" ? "default" : "outline"}
                    aria-pressed={mode === "unplace"}
                    className="h-10 gap-1.5"
                    onClick={() => setMode("unplace")}
                >
                    <MapPinOff size={14} aria-hidden />
                    Retirer de l'emplacement
                </Button>
            </div>

            {mode === "place" ? (
                <EmplacementPicker
                    idPrefix="hp-move"
                    options={emplacementOptions}
                    value={target}
                    onChange={setTarget}
                    disabled={busy}
                />
            ) : (
                <p className="text-sm text-muted-foreground">
                    {count > 1 ? "Elles passeront" : "Elle passera"} dans « Non rangées ».
                </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" className="h-10" onClick={onClose} disabled={busy}>
                    Annuler
                </Button>
                <Button type="button" className="h-10" onClick={() => void submit()} disabled={!ready || busy}>
                    {count > 1 ? `Déplacer ${count} balles` : "Déplacer"}
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}
