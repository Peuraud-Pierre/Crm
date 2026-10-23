import { useState, type ReactNode } from "react"
import { LayoutList, Loader2 } from "lucide-react"
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import {
    SortableContext,
    arrayMove,
    rectSortingStrategy,
    sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { Button } from "@/shared/ui/atoms/button"
import {
    SkeletonCard,
    SkeletonStatTiles,
} from "@/shared/ui/molecules/skeleton-presets"
import type { SectionKey, SectionLayoutItem } from "./types/analytics"
import { AnalyticsProvider, useAnalytics } from "./context/AnalyticsContext"
import { useAnalyticsClients } from "./hooks/data/useAnalyticsClients"
import { useAnalyticsLayout } from "./hooks/data/useAnalyticsLayout"
import { SortableSection } from "./components/Analytics/SortableSection"
import { AnalyticsHeader } from "./components/Analytics/Header"
import { AnalyticsKPIs } from "./components/Analytics/Kpis"
import { EventsPalier, TARGET_IDS as PALIER_TARGET_IDS } from "./components/Analytics/Widget/EventsPalier"
import { WidgetRdvPerformance } from "./components/Analytics/Widget/RDVPerformance"
import { WidgetRevenue } from "./components/Analytics/Widget/Revenue"
import { WidgetShowNoShow } from "./components/Analytics/Widget/ShowNoShow"
import { WidgetProvenance } from "./components/Analytics/Widget/Provenance"
import { WidgetProduitsRecherches } from "./components/Analytics/Widget/ProduitsRecherches"
import { WidgetProduitsRechercheEvolution } from "./components/Analytics/Widget/ProduitsRechercheEvolution"
import { WidgetRdvByType } from "./components/Analytics/Widget/RdvByType"
import { WidgetActivitesByType } from "./components/Analytics/Widget/ActivityType"
import { WidgetActivitesByOwner } from "./components/Analytics/Widget/ActivityOwner"
import { WidgetRdvByPerson } from "./components/Analytics/Widget/RDVByPerson"
import { WidgetFunnel } from "./components/Analytics/Widget/Tunneldevente"

// Registre module → composant, consulté par l'ordre persisté
// (useAnalyticsLayout) pour savoir quoi rendre à chaque position. Le Header
// n'y figure pas : il est toujours rendu en premier, fixe (voir plus bas).
const SECTION_REGISTRY: Record<SectionKey, () => ReactNode> = {
    eventsPalier: () => <EventsPalier />,
    rdvPerformance: () => <WidgetRdvPerformance />,
    revenue: () => <WidgetRevenue />,
    showNoShow: () => <WidgetShowNoShow />,
    provenance: () => <WidgetProvenance />,
    produitsRecherches: () => <WidgetProduitsRecherches />,
    produitsRechercheEvolution: () => <WidgetProduitsRechercheEvolution />,
    rdvByType: () => <WidgetRdvByType />,
    activitesByType: () => <WidgetActivitesByType />,
    activitesByOwner: () => <WidgetActivitesByOwner />,
    rdvByPerson: () => <WidgetRdvByPerson />,
    funnel: () => <WidgetFunnel />,
}

function AnalyticsContent() {
    const { isWidgetsLoaded, widgets, selectedCommercial } = useAnalytics()
    const { isFetching: isLoadingAllClients, clients } = useAnalyticsClients()
    const { layout, reorder } = useAnalyticsLayout()
    // Le glisser-déposer n'est actif qu'en mode édition, activé par un
    // bouton explicite — évite qu'un clic/tap malheureux sur un module
    // (graphes, cartes) déclenche un déplacement involontaire.
    const [isEditingLayout, setIsEditingLayout] = useState(false)

    // Un module de contenu n'est affiché (et donc réordonnable/redimensionnable)
    // que s'il est effectivement visible — même logique de garde que
    // l'ex-Charts.tsx (widgets[id].visible) et EventsPalier (réservé à 3
    // commerciaux ciblés).
    const isVisible = (key: SectionKey) => {
        if (key === "eventsPalier") return PALIER_TARGET_IDS.has(selectedCommercial)
        return widgets[key]?.visible ?? false
    }
    const visibleLayout = layout.filter((item) => isVisible(item.id))

    // Mêmes réglages que le réordonnancement des sections d'article
    // (ArticleEditor) : seuil en distance à la souris, délai au doigt pour
    // ne pas déclencher un drag pendant le défilement sur mobile, clavier
    // pour la poignée accessible.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 200, tolerance: 6 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = layout.findIndex((item) => item.id === active.id)
        const newIndex = layout.findIndex((item) => item.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return
        reorder(arrayMove(layout, oldIndex, newIndex))
    }

    const toggleSize = (id: SectionKey) => {
        reorder(
            layout.map((item) =>
                item.id === id
                    ? { ...item, size: item.size === "full" ? "half" : "full" }
                    : item
            )
        )
    }

    if (!isWidgetsLoaded) return null //
    // Premier chargement : useAnalyticsClients n'a pas encore peuplé
    // la liste — on affiche un loader plein écran. Les rafraîchissements
    // suivants (clients déjà en mémoire) restent silencieux pour ne pas faire
    // clignoter l'UI à chaque changement de filtre.
    if (isLoadingAllClients && clients.length === 0) {
        return (
            // Squelette de forme approchante plutôt qu'un spinner : la bande
            // de KPI et les cartes de graphiques arrivent à la même place, donc
            // le contenu réel ne décale rien (DESIGN_SYSTEM.md §13.8).
            <div className="space-y-6 pb-12">
                <SkeletonStatTiles label="Chargement des données analytiques…" />
                <div className="grid gap-4 lg:grid-cols-2">
                    <SkeletonCard lines={6} />
                    <SkeletonCard lines={6} />
                </div>
            </div>
        ) //
    }

    const gridClass = (size: SectionLayoutItem["size"]) =>
        size === "full" ? "col-span-1 xl:col-span-2" : undefined

    return (
        <div className="space-y-6 pb-12 w-full overflow-x-hidden relative">
            {isLoadingAllClients && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 text-2xs text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded-md border animate-in fade-in duration-base">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Mise à jour…</span>
                </div>
            )}
            {/* Toujours en premier, jamais réordonnable : sa racine est
                sticky (barre de filtres) — un glisser-déposer couvrant le
                Header cassait cet ancrage (transform CSS sur un ancêtre
                casse position:sticky). */}
            <AnalyticsHeader />

            {/* Bloc autonome, jamais réordonné : sa grille interne de
                tuiles (CA/devis/leads/RDV) doit garder sa largeur pleine
                page d'origine — la faire passer par la grille de
                disposition partagée changeait sa taille. */}
            <AnalyticsKPIs />

            <div className="flex justify-end">
                <Button
                    variant={isEditingLayout ? "default" : "outline"}
                    size="sm"
                    className="gap-2"
                    onClick={() => setIsEditingLayout((v) => !v)}
                >
                    <LayoutList className="h-4 w-4" />
                    {isEditingLayout ? "Terminé" : "Modifier l'emplacement"}
                </Button>
            </div>

            {isEditingLayout ? (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={visibleLayout.map((item) => item.id)}
                        strategy={rectSortingStrategy}
                    >
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
                            {visibleLayout.map(({ id, size }) => (
                                <SortableSection
                                    key={id}
                                    id={id}
                                    className={gridClass(size)}
                                    size={size}
                                    onToggleSize={() => toggleSize(id)}
                                >
                                    {SECTION_REGISTRY[id]()}
                                </SortableSection>
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
                    {visibleLayout.map(({ id, size }) => (
                        <div key={id} className={gridClass(size)}>
                            {SECTION_REGISTRY[id]()}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function AnalyticsTab() {
    return (
        <AnalyticsProvider>
            <AnalyticsContent />
        </AnalyticsProvider>
    )
}
