import { Component, type ErrorInfo, type ReactNode } from "react"
import { toast } from "sonner"
import { Button } from "@/shared/ui/atoms/button"
import { AlertTriangle, RefreshCcw } from "lucide-react"
import { getErrorMessage } from "@/features/crm/utils/errors"

interface Props {
    children: ReactNode
    /** Identifiant lisible (ex: "Customers", "Calendar") inclus dans les logs et la toast. */
    name: string
    /** Rendu personnalisé si fourni ; sinon un panneau d'erreur discret est affiché. */
    fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

/**
 * ErrorBoundary local au CRM. Empêche un crash d'un onglet (Calendrier, Devis…) de
 * faire planter la SPA entière, log l'erreur et expose un bouton "Réessayer".
 *
 * Le wrapper global `AppErrorBoundary` (Supabase logging) reste actif au-dessus :
 * on ne le remplace pas, on filtre simplement les erreurs locales.
 */
export class CrmErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        const msg = getErrorMessage(error)
        console.error(
            `[CRM/${this.props.name}] Erreur capturée:`,
            msg,
            info.componentStack
        )
        toast.error(`Erreur dans "${this.props.name}" — ${msg}`)
    }

    private reset = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (!this.state.hasError) return this.props.children
        const err = this.state.error ?? new Error("Erreur inconnue")
        if (this.props.fallback) return this.props.fallback(err, this.reset)
        return (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
                <p>
                    Une erreur est survenue dans l&apos;onglet{" "}
                    <span className="font-semibold">{this.props.name}</span>.
                </p>
                <p className="text-xs opacity-70 break-all max-w-md">
                    {getErrorMessage(err)}
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={this.reset}
                    className="gap-2"
                >
                    <RefreshCcw className="h-3.5 w-3.5" /> Réessayer
                </Button>
            </div>
        )
    }
}
