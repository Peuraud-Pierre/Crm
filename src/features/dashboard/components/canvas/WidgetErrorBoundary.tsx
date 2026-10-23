import { Component, type ErrorInfo, type ReactNode } from "react"
import { TriangleAlert } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"

interface Props {
    /** Nom affiché dans le message — le titre du module. */
    title: string
    children: ReactNode
}

interface State {
    error: Error | null
}

/**
 * Isole un module en panne.
 *
 * Sans cette barrière, une exception dans n'importe quel widget démonte
 * l'arbre React jusqu'à la route et vide la page d'accueil — celle que
 * tout le monde traverse à l'ouverture. Un module cassé doit rester un
 * incident local.
 *
 * Une classe est nécessaire : React n'expose pas les limites d'erreur
 * aux composants de fonction.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
    state: State = { error: null }

    static getDerivedStateFromError(error: Error): State {
        return { error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(
            `[dashboard] le module « ${this.props.title} » a échoué :`,
            error,
            info.componentStack
        )
    }

    render() {
        if (!this.state.error) return this.props.children

        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <TriangleAlert className="size-6 text-warning" />
                <div className="space-y-1">
                    <p className="text-sm font-medium">
                        Ce module n'a pas pu s'afficher
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Les autres modules de la page fonctionnent normalement.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => this.setState({ error: null })}
                >
                    Réessayer
                </Button>
            </div>
        )
    }
}
