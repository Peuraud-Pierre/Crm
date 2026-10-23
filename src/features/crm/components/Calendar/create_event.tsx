import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/shared/ui/atoms/dialog"
import { Button } from "@/shared/ui/atoms/button"
import { CalendarClock } from "lucide-react"
import { cn } from "@/shared/lib/utils"

// Import de tes sous-composants, du hook et de tes constantes
import {
    useCreateEventLogic,
    EVENT_TYPES,
    TIME_SLOTS,
    START_HOUR,
    END_HOUR,
    HOUR_HEIGHT,
    TIME_GRID_ARRAY,
    safeDate,
} from "@/features/crm/types/calendar"

import { EventFormPanel } from "./CreationSplit/EventFormPanel"
import { EventGridPanel } from "./CreationSplit/EventGridPanel"

export default function CreateEvent({ update }: { update: boolean }) {
    const logic = useCreateEventLogic({ update })
    // Un RDV (tout sauf « Non Disponible ») doit porter un client.
    const missingClient =
        logic.formData.nom !== "Non Disponible" && !logic.formData.participants

    return (
        <Dialog open={true} onOpenChange={logic.handleClose}>
            <DialogContent
                className={cn(
                    // transition-all retiré : ça transitionnait aussi `transform` en
                    // continu, en plus de l'animation d'entrée `animate-in` (keyframes)
                    // qui anime la même propriété — les deux mécanismes se marchaient
                    // dessus pendant l'ouverture.
                    "max-w-[1400px] w-[98vw] p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-border/50 rounded-3xl shadow-2xl",
                    // Le bug de centrage (translate natif vs transform animé) est fixé une
                    // fois pour toutes dans l'atom Dialog partagé (shared/ui/atoms/dialog.tsx).
                    // On garde juste ici la neutralisation du léger glissement résiduel
                    // (slide-in-from-left-1/2 / top-[48%]) : fade + zoom seuls, pas de slide.
                    "data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0"
                )}
            >
                {/* HEADER */}
                <DialogHeader className="px-6 py-4 border-b border-border flex flex-row items-center justify-between bg-card/40">
                    <DialogTitle className="text-xl font-bold flex items-center gap-3 text-foreground">
                        <CalendarClock className="w-6 h-6 text-primary" />
                        {update
                            ? "Modifier l'événement"
                            : "Planifier un nouveau rendez-vous"}
                    </DialogTitle>
                </DialogHeader>

                {/* CORPS (SCINDÉ EN 2) — colonne empilée sur mobile (formulaire
                    puis grille horaire), côte à côte à partir de lg. */}
                <div className="flex flex-col lg:flex-row h-[85vh] sm:h-[75vh] min-h-[500px]">
                    <EventFormPanel
                        logic={logic}
                        EVENT_TYPES={EVENT_TYPES}
                        TIME_SLOTS={TIME_SLOTS}
                    />

                    <EventGridPanel
                        logic={logic}
                        safeDate={safeDate}
                        START_HOUR={START_HOUR}
                        END_HOUR={END_HOUR}
                        HOUR_HEIGHT={HOUR_HEIGHT}
                        TIME_GRID_ARRAY={TIME_GRID_ARRAY}
                    />
                </div>

                {/* FOOTER */}
                <DialogFooter className="px-6 py-4 border-t bg-muted gap-3 z-50 sm:items-center">
                    {/* Seule raison qui grise « Confirmer » : la dire, plutôt
                        qu'un bouton inerte sans explication. */}
                    {missingClient && (
                        <p className="text-sm text-muted-foreground sm:mr-auto">
                            Choisissez un client pour confirmer le RDV.
                        </p>
                    )}
                    <Button
                        variant="ghost"
                        className="h-11 px-6"
                        onClick={logic.handleClose}
                    >
                        Annuler
                    </Button>
                    <Button
                        // Un créneau occupé n'empêche pas l'enregistrement : deux
                        // RDV peuvent avoir lieu en même temps (avertissement
                        // « Occupé » dans le formulaire).
                        disabled={missingClient}
                        loading={logic.isChecking || logic.isSubmitting}
                        className={cn(
                            "h-11 px-8 rounded-xl font-bold shadow-lg transition-transform active:scale-95",
                            logic.currentTypeConfig.btnColor
                        )}
                        onClick={logic.handleSubmit}
                    >
                        {logic.isChecking || logic.isSubmitting
                            ? null
                            : update
                              ? "Mettre à jour"
                              : "Confirmer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
