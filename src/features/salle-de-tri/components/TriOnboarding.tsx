import { ArrowRight, CheckCircle2, Circle, ClipboardList, Layers, UserRound, type LucideIcon } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"

interface TriOnboardingProps {
    sortiesActives: number
    trieursActifs: number
    /** Ouvre l'onglet « Trieurs et types ». */
    onReferentiel: () => void
    /** Absent : pas le droit de créer. */
    onCreate?: () => void
}

/**
 * Premier lancement : tant qu'il manque des types de sortie ou des trieurs,
 * une fiche ne peut pas être saisie. Plutôt qu'un formulaire qui ne peut pas
 * aboutir, la page dit quoi préparer, dans l'ordre, et où.
 */
export function TriOnboarding({ sortiesActives, trieursActifs, onReferentiel, onCreate }: TriOnboardingProps) {
    const pret = sortiesActives > 0 && trieursActifs > 0
    const etapes: { icon: LucideIcon; titre: string; detail: string; fait: boolean; action?: { label: string; onClick: () => void } }[] = [
        {
            icon: Layers,
            titre: "Les types de sortie",
            detail: sortiesActives > 0
                ? `${sortiesActives} type${sortiesActives > 1 ? "s" : ""} actif${sortiesActives > 1 ? "s" : ""} : MAG, KS… — où partent les kilos d'une balle.`
                : "Où partent les kilos d'une balle (MAG, KS, SO3, EXPORT…).",
            fait: sortiesActives > 0,
            action: sortiesActives > 0 ? undefined : { label: "Ajouter les types", onClick: onReferentiel },
        },
        {
            icon: UserRound,
            titre: "Les trieurs",
            detail: trieursActifs > 0
                ? `${trieursActifs} trieur${trieursActifs > 1 ? "s" : ""} actif${trieursActifs > 1 ? "s" : ""}.`
                : "Les personnes dont vous recopiez les feuilles. Pas besoin de compte sur la console.",
            fait: trieursActifs > 0,
            action: trieursActifs > 0 ? undefined : { label: "Ajouter les trieurs", onClick: onReferentiel },
        },
        {
            icon: ClipboardList,
            titre: "La première fiche",
            detail: "Recopiez une feuille : trieur, horaires, puis une carte par balle ouverte.",
            fait: false,
            action: pret && onCreate ? { label: "Nouvelle fiche", onClick: onCreate } : undefined,
        },
    ]

    return (
        <section className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:p-8" aria-labelledby="tri-onboarding-titre">
            <div className="flex flex-col gap-1.5">
                <h3 id="tri-onboarding-titre" className="text-lg font-bold tracking-tight">Préparer la salle de tri</h3>
                <p className="text-sm text-muted-foreground">
                    Deux listes à remplir une fois, et les feuilles des trieurs se saisissent en quelques minutes.
                </p>
            </div>
            <ol className="flex flex-col gap-3">
                {etapes.map((e, i) => {
                    const courante = !e.fait && etapes.slice(0, i).every((x) => x.fait)
                    return (
                        <li
                            key={e.titre}
                            className={cn(
                                "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center",
                                courante ? "border-primary/40 bg-primary/5" : "border-border",
                            )}
                        >
                            <span className="flex min-w-0 flex-1 items-start gap-3">
                                {e.fait
                                    ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success" aria-label="Fait" />
                                    : <Circle size={20} className={cn("mt-0.5 shrink-0", courante ? "text-primary" : "text-muted-foreground/50")} aria-label="À faire" />}
                                <span className="flex min-w-0 flex-col gap-0.5">
                                    <span className={cn("flex items-center gap-2 font-semibold", e.fait && "text-muted-foreground")}>
                                        <e.icon size={14} aria-hidden />
                                        {i + 1}. {e.titre}
                                    </span>
                                    <span className="text-sm text-muted-foreground">{e.detail}</span>
                                </span>
                            </span>
                            {e.action && (
                                <Button
                                    variant={courante ? "default" : "outline"}
                                    className="h-10 w-full shrink-0 gap-1.5 sm:w-auto"
                                    onClick={e.action.onClick}
                                >
                                    {e.action.label}
                                    <ArrowRight size={14} />
                                </Button>
                            )}
                        </li>
                    )
                })}
            </ol>
        </section>
    )
}
