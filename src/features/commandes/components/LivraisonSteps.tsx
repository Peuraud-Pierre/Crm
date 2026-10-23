import type { ReactNode } from "react"
import { Check, PackagePlus, Printer, ScanLine, Send } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { LivraisonBoutique } from "@/features/commandes/types/commande.types"

const STEPS = [
    { label: "Remplir", icon: PackagePlus },
    { label: "Étiqueter", icon: Printer },
    { label: "Expédier", icon: Send },
    { label: "Réception", icon: ScanLine },
] as const

/**
 * Étape courante d'une livraison (0 à 4, 4 = terminée). « Étiqueter » n'est
 * pas un état en base : dès qu'il y a des cartons, c'est l'étape à faire
 * avant l'expédition.
 */
export function etapeLivraison(l: Pick<LivraisonBoutique, "statut" | "nb_cartons">): number {
    switch (l.statut) {
        case "planifiee":
        case "preparation":
            return l.nb_cartons === 0 ? 0 : 1
        case "expediee":
        case "en_reception":
            return 3
        default:
            return 4
    }
}

interface LivraisonStepsProps {
    livraison: LivraisonBoutique
    /** Consigne et bouton de l'étape courante. */
    children?: ReactNode
}

/**
 * Le fil d'une livraison : où elle en est, et ce qu'il reste à faire. La
 * consigne de l'étape courante est posée juste dessous, avec son bouton —
 * on ne cherche pas l'action dans la barre d'outils.
 */
export function LivraisonSteps({ livraison, children }: LivraisonStepsProps) {
    const courante = etapeLivraison(livraison)
    const litige = livraison.statut === "litige"
    return (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-3 sm:p-4" aria-label="Avancement de la livraison">
            <ol className="flex items-center">
                {STEPS.map((s, i) => {
                    const fait = i < courante
                    const actif = i === courante
                    return (
                        <li key={s.label} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
                            <span className="flex flex-col items-center gap-1">
                                <span className={cn(
                                    "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                                    fait && (litige && i === STEPS.length - 1 ? "border-destructive bg-destructive text-destructive-foreground" : "border-success bg-success text-success-foreground"),
                                    actif && "border-primary bg-primary text-primary-foreground shadow-md",
                                    !fait && !actif && "border-border bg-background text-muted-foreground",
                                )} aria-current={actif ? "step" : undefined}>
                                    {fait ? <Check size={16} /> : <s.icon size={16} />}
                                </span>
                                <span className={cn("text-xs font-medium", actif ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
                            </span>
                            {i < STEPS.length - 1 && (
                                <span className={cn("mx-1 mb-5 h-0.5 flex-1 rounded-full", i < courante ? "bg-success" : "bg-border")} aria-hidden />
                            )}
                        </li>
                    )
                })}
            </ol>
            {children}
        </section>
    )
}
