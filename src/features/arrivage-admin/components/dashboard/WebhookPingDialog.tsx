import { useState } from "react"
import {
    AlertTriangle,
    CheckCircle2,
    Loader2,
    Stethoscope,
    XOctagon,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/atoms/alert"
import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/shared/ui/atoms/dialog"
import { useWebhookPing } from "@/features/arrivage-admin/hooks/data/useWebhookPing"
import type { WebhookPingVerdict } from "@/features/arrivage-admin/types"

const TONE_ICON = {
    success: CheckCircle2,
    warning: AlertTriangle,
    destructive: XOctagon,
} as const

/** Rendu du verdict. Sorti du composant principal pour le garder lisible. */
function VerdictPanel({ verdict }: { verdict: WebhookPingVerdict }) {
    const Icon = TONE_ICON[verdict.tone]

    return (
        <Alert
            variant={verdict.tone === "destructive" ? "destructive" : "default"}
            className={
                verdict.tone === "success"
                    ? "border-success/50 text-success"
                    : verdict.tone === "warning"
                      ? "border-warning/50 text-warning"
                      : undefined
            }
        >
            <Icon className="h-4 w-4" />
            <AlertTitle>
                {verdict.title}
                {verdict.statusCode !== null && ` · HTTP ${verdict.statusCode}`}
            </AlertTitle>
            <AlertDescription className="space-y-2">
                <p>{verdict.detail}</p>
                {verdict.remedy && (
                    <p className="font-medium">{verdict.remedy}</p>
                )}
            </AlertDescription>
        </Alert>
    )
}

/**
 * Bouton « Tester le webhook » et son résultat.
 *
 * Teste le seul segment de la chaîne que l'envoi manuel et le renvoi ciblé
 * n'empruntent pas — trigger Postgres, pg_net, reverse proxy, authentification
 * par token — donc le seul dont la panne passe inaperçue : quand il lâche, les
 * deux autres continuent de fonctionner et aucune erreur n'est journalisée
 * nulle part.
 *
 * Le test ne programme aucune diffusion : la requête porte un nom de table
 * factice, que le service reçoit, authentifie, puis ignore.
 *
 * L'appelant n'a pas à gater par permission : la page entière exige déjà
 * stock.arrivage.newsletter.admin, que les RPC revérifient de leur côté.
 */
export function WebhookPingDialog() {
    const [open, setOpen] = useState(false)
    const { running, verdict, error, run, reset } = useWebhookPing()

    const handleOpenChange = (next: boolean) => {
        setOpen(next)
        // Rouvrir la fenêtre ne doit pas afficher le verdict de la fois
        // précédente comme s'il venait d'être établi.
        if (!next) reset()
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Stethoscope className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Tester le webhook</span>
                </Button>
            </DialogTrigger>

            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tester le déclenchement automatique</DialogTitle>
                </DialogHeader>

                <div className="space-y-3 py-2 text-sm text-muted-foreground">
                    <p>
                        Rejoue l'appel que la base envoie au service à chaque
                        modification du tableau des arrivages, avec les
                        paramètres du webhook lui-même. Vérifie d'un coup le
                        trigger, l'extension pg_net, le reverse proxy et le
                        token d'authentification.
                    </p>
                    <p>
                        Aucun mail n'est envoyé et aucune diffusion n'est
                        programmée.
                    </p>

                    {verdict === null && !running && !error && (
                        <p className="text-xs">
                            Le résultat peut prendre quelques secondes : la base
                            envoie ses requêtes de façon asynchrone.
                        </p>
                    )}
                </div>

                {error && (
                    <Alert variant="destructive">
                        <XOctagon className="h-4 w-4" />
                        <AlertTitle>Test impossible</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {verdict && <VerdictPanel verdict={verdict} />}

                {verdict?.url && (
                    <p className="break-all text-xs text-muted-foreground">
                        URL appelée :{" "}
                        <code className="font-mono">{verdict.url}</code>
                        {verdict.triggerName && ` · trigger ${verdict.triggerName}`}
                    </p>
                )}

                <DialogFooter>
                    <Button onClick={run} disabled={running}>
                        {running && (
                            <Loader2 className="h-4 w-4 animate-spin sm:mr-1" />
                        )}
                        {running
                            ? "Test en cours…"
                            : verdict
                              ? "Relancer le test"
                              : "Lancer le test"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
