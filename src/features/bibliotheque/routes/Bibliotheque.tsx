// ── Bibliotheque.tsx ──────────────────────────────────────────────────────────
// Point d'entrée de la feature : composant exporté par défaut, chargé par le
// routeur de l'application.
//
// Architecture en deux niveaux :
//   1. Bibliotheque (export default) : monte le BiblioProvider qui initialise
//      le contexte (chargement Supabase, état global de la page).
//   2. BiblioPage (interne) : lit le contexte et gère les quatre états d'affichage :
//        - Chargement en cours
//        - Erreur de chargement (Supabase a répondu par une erreur)
//        - Aucune thématique (écran vide avec bouton de création)
//        - Interface complète (toolbar + sidebar + colonne principale)
//      Tous les dialogs sont montés ici, en dehors du layout, pour qu'ils
//      soient toujours disponibles quelle que soit la vue active.

import { BiblioProvider, useBiblioContext } from "@/features/bibliotheque/context/BiblioContext"
import { BiblioToolbar } from "@/features/bibliotheque/components/BiblioToolbar"
import { BiblioSidebar } from "@/features/bibliotheque/components/BiblioSidebar"
import { BiblioMainColumn } from "@/features/bibliotheque/components/BiblioMainColumn"
import { BriefPanel } from "@/features/bibliotheque/components/BriefPanel"
import { SearchResults } from "@/features/bibliotheque/components/SearchResults"
import { QRDetailPanel } from "@/features/bibliotheque/components/QRDetailPanel"
import { QRFormDialog } from "@/features/bibliotheque/components/QRFormDialog"
import { DeleteQRDialog, DeleteThematiqueDialog } from "@/features/bibliotheque/components/DeleteDialogs"
import { BriefEditDialog, ChiffresEditDialog } from "@/features/bibliotheque/components/BriefChiffresDialogs"
import { ThematiqueFormDialog } from "@/features/bibliotheque/components/ThematiqueFormDialog"
import { FormatEditDialog } from "@/features/bibliotheque/components/FormatEditDialog"
import { FormatViewDialog } from "@/features/bibliotheque/components/FormatViewDialog"
import { BiblioErrorBoundary } from "@/features/bibliotheque/components/BiblioErrorBoundary"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"
import { Plus, MessageSquareDashed, AlertTriangle, RefreshCw } from "lucide-react"

// ── Composant interne ──────────────────────────────────────────────────────────
// Séparé de Bibliotheque() pour pouvoir appeler useBiblioContext(),
// qui exige d'être à l'intérieur d'un BiblioProvider.

function BiblioPage() {
    // Déstructuration imbriquée : useBiblioContext() renvoie un objet organisé
    // en groupes (data / nav / dialogs / handlers, voir useBiblioPage.ts). On
    // "pioche" directement les champs utiles dans chaque groupe en une seule
    // ligne, plutôt que de stocker tout l'objet puis d'écrire ctx.data.loading, etc.
    const { data: { loading, loadError, refetch, thematiques }, nav: { ui, searchQuery, activeId }, dialogs: { openCreateThematique } } = useBiblioContext()

    // ── État 1 : chargement en cours ───────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {ui.loadingText}
            </div>
        )
    }

    // ── État 2 : erreur de chargement ──────────────────────────────────────────
    // Sans cet état, une erreur Supabase (réseau, table manquante, RLS…) serait
    // indiscernable d'une base vide et afficherait le mauvais écran.
    if (loadError) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                    <p className="text-sm font-medium text-foreground">
                        {ui.loadErrorTitle}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {ui.loadErrorHint}
                    </p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={refetch}>
                    <RefreshCw className="w-3.5 h-3.5" />
                    {ui.retry}
                </Button>
            </div>
        )
    }

    // ── État 3 : base vide (aucune thématique) ─────────────────────────────────
    // On monte quand même ThematiqueFormDialog pour permettre la création
    // de la première thématique via le bouton affiché.
    if (thematiques.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <MessageSquareDashed className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                    <p className="text-sm font-medium text-foreground">
                        {ui.noTopics}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {ui.noTopicsHint}
                    </p>
                </div>
                <Button size="sm" className="gap-1.5" onClick={openCreateThematique}>
                    <Plus className="w-3.5 h-3.5" /> {ui.newTopic}
                </Button>
                <ThematiqueFormDialog />
            </div>
        )
    }

    // ── État 4 : interface complète ────────────────────────────────────────────
    // searchQuery.trim() est truthy dès qu'il y a du texte non vide
    const isSearching = Boolean(searchQuery.trim())

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 flex-1 min-h-0 px-4 lg:px-6 pb-4 lg:pb-6">
                {/* Colonne gauche : BiblioToolbar est monté une seule fois ici, partagé
                    entre vue normale et vue recherche, pour ne jamais démonter l'<input>
                    de recherche (et donc perdre le focus au premier caractère tapé) quand
                    isSearching bascule et fait basculer le corps de la colonne. */}
                {/* Sous lg : empilé — la sidebar prend 2/5 de la hauteur, chaque colonne
                    garde son propre scroll interne (280px de large ne rentrent pas
                    à côté du contenu sur un écran mobile). */}
                <aside className={cn("flex flex-col min-h-0 basis-2/5 lg:basis-auto lg:shrink-0 pt-4", isSearching ? "lg:w-biblio-search lg:border-r border-border" : "lg:w-biblio-sidebar")}>
                    <BiblioToolbar />
                    {isSearching ? <SearchResults /> : <BiblioSidebar />}
                </aside>

                {/* Colonne droite — pt-4 pour aligner avec le padding-top de la colonne gauche */}
                <div className="flex-1 min-w-0 pt-0 lg:pt-4 flex flex-col min-h-0">
                    {isSearching ? <QRDetailPanel /> : (activeId ? <BiblioMainColumn /> : <BriefPanel />)}
                </div>
            </div>

            {/* Dialogs — montés ici pour être disponibles dans toutes les vues.
                Ils sont invisibles (open=false) tant que dialog.mode ne correspond pas. */}
            <QRFormDialog />
            <DeleteQRDialog />
            <ThematiqueFormDialog />
            <DeleteThematiqueDialog />
            <BriefEditDialog />
            <ChiffresEditDialog />
            <FormatEditDialog />
            <FormatViewDialog />
        </div>
    )
}

// ── Export principal ───────────────────────────────────────────────────────────
// BiblioProvider initialise useBiblioPage() (et donc useBibli()) une seule fois
// pour toute la page, puis met les valeurs à disposition via le contexte.

export default function Bibliotheque() {
    return (
        <BiblioErrorBoundary>
            <BiblioProvider>
                <BiblioPage />
            </BiblioProvider>
        </BiblioErrorBoundary>
    )
}
