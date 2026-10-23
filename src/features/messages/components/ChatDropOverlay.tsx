import { Upload } from "lucide-react"

/**
 * Voile de dépôt couvrant la zone de conversation.
 *
 * Le retour visuel se limitait à un anneau, qui ne disait ni où déposer ni ce
 * qui allait se passer — et deux zones concurrentes s'allumaient en même
 * temps. Le libellé dit « ajoutés au message » : depuis l'introduction du
 * panier, les fichiers ne partent plus tout seuls.
 */
export function ChatDropOverlay() {
    return (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm animate-in fade-in duration-fast">
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/60 bg-card px-8 py-6 text-center shadow-raised">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                    <Upload className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-sm font-semibold text-foreground">
                    Déposez vos fichiers
                </span>
                <span className="max-w-56 text-xs text-muted-foreground">
                    Ils seront ajoutés au message. Vous pourrez les relire avant
                    de les envoyer.
                </span>
            </div>
        </div>
    )
}
