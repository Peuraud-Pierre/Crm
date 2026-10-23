import { Check, Loader2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { staggerStyle } from "@/shared/lib/motion"

interface PackingImportProgressProps {
    /**
     * `sending` : la requête vers le service d'import est en vol.
     * `processing` : le service a accepté le fichier et termine en asynchrone
     * (statut `en_traitement` en base).
     */
    phase: "sending" | "processing"
    fileName?: string | null
}

const STEPS = [
    { label: "Envoi et lecture du fichier" },
    { label: "Correspondance des catégories" },
    { label: "Vérification par vos soins" },
] as const

/**
 * Progression de l'import. Trois étapes et non une barre : on ne connaît pas
 * de pourcentage honnête, mais on sait dire OÙ on en est — et que la dernière
 * étape sera humaine.
 */
export function PackingImportProgress({ phase, fileName }: PackingImportProgressProps) {
    const active = phase === "sending" ? 0 : 1

    return (
        <div
            className="flex flex-col gap-5 rounded-xl border border-border bg-muted/30 px-4 py-5 sm:px-5 sm:py-6"
            aria-live="polite"
        >
            {fileName && (
                <p className="truncate text-sm font-medium text-foreground">
                    {fileName}
                </p>
            )}

            <ol className="flex flex-col gap-3">
                {STEPS.map((step, index) => {
                    const done = index < active
                    const current = index === active
                    return (
                        <li
                            key={step.label}
                            style={staggerStyle(index, { step: 60 })}
                            className={cn(
                                "flex items-center gap-3 text-sm",
                                "animate-in fade-in slide-in-from-left-2 fill-mode-backwards duration-base ease-emphasized motion-reduce:animate-none",
                                done || current ? "text-foreground" : "text-muted-foreground",
                            )}
                            aria-current={current ? "step" : undefined}
                        >
                            <span
                                className={cn(
                                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-slow ease-decel motion-reduce:transition-none",
                                    done && "border-success bg-success-light text-success",
                                    current && "border-primary text-primary",
                                    !done && !current && "border-border",
                                )}
                            >
                                {done ? (
                                    // La coche « arrive » — d'où l'overshoot, réservé
                                    // aux apparitions (DESIGN_SYSTEM.md §13.3).
                                    <Check
                                        size={12}
                                        className="animate-in zoom-in-50 duration-fast ease-overshoot motion-reduce:animate-none"
                                        aria-hidden
                                    />
                                ) : current ? (
                                    <Loader2 size={12} className="animate-spin" aria-hidden />
                                ) : (
                                    <span className="text-2xs">{index + 1}</span>
                                )}
                            </span>
                            {step.label}
                        </li>
                    )
                })}
            </ol>

            {phase === "processing" && (
                <p className="text-xs text-muted-foreground">
                    Le traitement continue même si vous fermez ce panneau : la packing list passera
                    « À vérifier » dès qu'elle sera prête.
                </p>
            )}
        </div>
    )
}
