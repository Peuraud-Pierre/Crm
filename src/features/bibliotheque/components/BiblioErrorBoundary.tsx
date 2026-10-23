// ── BiblioErrorBoundary.tsx ───────────────────────────────────────────────────
// RÔLE : Empêche un crash de rendu dans la feature Bibliothèque (bug dans un
// composant, valeur inattendue non prévue par un mapper...) de faire planter
// toute la SPA. Sans ce filet, la seule protection restante est le
// AppErrorBoundary global (src/shared/components/misc/AppErrorBoundary.tsx),
// qui remplace TOUTE l'application par un écran "Recharger la page" — un
// crash localisé à cette feature mérite un fallback local avec un simple
// bouton "Réessayer", comme le fait déjà CrmErrorBoundary pour le CRM
// (src/features/crm/components/_shared/CrmErrorBoundary.tsx, même principe).
//
// Volontairement hors contexte (n'utilise pas useBiblioContext) : monté au-
// dessus de BiblioProvider dans routes/Bibliotheque.tsx pour capturer aussi
// une éventuelle erreur de rendu DANS le provider lui-même.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - routes/Bibliotheque.tsx → enveloppe BiblioProvider + BiblioPage

import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/shared/ui/atoms/button"
import { AlertTriangle, RefreshCcw } from "lucide-react"

// Props reçues par ce composant : "children" désigne tout ce qui est placé
// entre <BiblioErrorBoundary> et </BiblioErrorBoundary> dans le JSX du parent
// (ici, BiblioProvider + BiblioPage).
interface Props {
    children: ReactNode
}

// State = l'état interne du composant (équivalent, pour une classe, du useState) :
//   - hasError : true dès qu'une erreur a été attrapée pendant le rendu des enfants
//   - error : l'erreur elle-même, pour pouvoir afficher son message
interface State {
    hasError: boolean
    error: Error | null
}

// "Error Boundary" = un composant React spécial, écrit obligatoirement sous
// forme de classe (pas de possible en composant fonction), dont le rôle est
// d'attraper les erreurs de rendu survenant dans ses enfants et d'afficher un
// contenu de secours ("fallback") plutôt que de laisser toute l'app planter.
export class BiblioErrorBoundary extends Component<Props, State> {
    // état initial : pas d'erreur au montage
    state: State = { hasError: false, error: null }

    // Méthode spéciale de React (nom imposé) : appelée automatiquement dès
    // qu'une erreur est levée pendant le rendu d'un enfant. Elle doit retourner
    // le nouvel état à appliquer — ici on bascule hasError à true.
    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    // Autre méthode spéciale de React, appelée juste après getDerivedStateFromError :
    // sert aux effets de bord (logging, télémétrie...), jamais à calculer l'état.
    componentDidCatch(error: Error, info: ErrorInfo) {
        // Le AppErrorBoundary global journalise déjà les erreurs React vers Supabase
        // (voir src/shared/components/misc/AppErrorBoundary.tsx) : ce composant se
        // contente de logger localement pour le diagnostic en dev, sans dupliquer
        // cette télémétrie.
        console.error("[Bibliotheque] Erreur capturée:", error.message, info.componentStack)
    }

    // Remet l'état à zéro (pas d'erreur) : appelé au clic sur le bouton "Réessayer"
    // ci-dessous. React relance alors un rendu normal des enfants.
    private reset = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        // Rendu conditionnel : tant qu'aucune erreur n'a été attrapée, on affiche
        // simplement les enfants tels quels (comportement transparent).
        if (!this.state.hasError) return this.props.children
        // Sinon (hasError === true), on affiche l'écran de secours ci-dessous
        // à la place des enfants.
        return (
            <div className="flex flex-col items-center justify-center gap-3 h-full p-8 text-center text-sm text-muted-foreground">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
                <p>Une erreur est survenue dans la bibliothèque de réponses.</p>
                <p className="text-xs opacity-70 break-all max-w-md">
                    {/* ?. (chaînage optionnel) : lit .message seulement si error existe,
                        sinon renvoie undefined sans planter. ?? (opérateur ??) : si le
                        résultat est undefined/null, on affiche "Erreur inconnue" à la place. */}
                    {this.state.error?.message ?? "Erreur inconnue"}
                </p>
                <Button variant="outline" size="sm" onClick={this.reset} className="gap-2">
                    <RefreshCcw className="h-3.5 w-3.5" /> Réessayer
                </Button>
            </div>
        )
    }
}
