import { useRef, useState } from "react"
import { LayoutGrid } from "lucide-react"
import { AnnouncementBand } from "@/features/announcements"
import { ChangelogRail } from "@/features/changelog"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonCard } from "@/shared/ui/molecules/skeleton-presets"
import { WidgetCanvas } from "../components/canvas/WidgetCanvas"
import { WidgetCatalog } from "../components/catalog/WidgetCatalog"
import { WidgetSettingsSheet } from "../components/settings/WidgetSettingsSheet"
import { DashboardToolbar } from "../components/toolbar/DashboardToolbar"
import { EDIT_MIN_WIDTH } from "../constants"
import { BioModeOverlay } from "../decor/BioModeOverlay"
import { useDashboardLayout } from "../hooks/data/useDashboardLayout"
import { useElementWidth } from "../hooks/useElementWidth"
import { getWidget } from "../widgets/registry"

/**
 * Page d'accueil.
 *
 * Trois zones, et une seule est à l'utilisateur :
 *
 * - en haut, les **annonces** — imposées, repliables, jamais déplaçables ;
 * - au centre, le **canevas** — douze colonnes, placement libre ;
 * - en bas, les **nouveautés** — un ourlet d'une ligne, qui ouvre son
 *   lecteur.
 *
 * Le socle d'information a quitté le canevas : il ne se pose plus, il
 * encadre. C'est ce qui permet au centre d'être réellement libre.
 *
 * La page ne défile pas elle-même : c'est le conteneur de `MainLayout`
 * qui s'en charge. Deux ascenseurs imbriqués pour un seul contenu, c'est
 * une molette qui ne sait plus qui elle pilote. Le cadre, lui, est
 * `sticky` — il encadre pendant qu'on parcourt le canevas.
 *
 * D'où le `min-h-full` : l'ascenseur de `MainLayout` n'est pas un
 * conteneur flex, donc le `flex-1` de cette racine n'étire rien et sa
 * hauteur vaut celle de son contenu. Sans lui, dès que le canevas est
 * plus court que l'écran, l'ourlet s'arrête sous le dernier module au
 * lieu du bas de la page — `sticky` n'y peut rien, un élément ne colle
 * jamais plus bas que son bloc conteneur.
 */
export default function Dashboard() {
    const contentRef = useRef<HTMLElement | null>(null)
    const canvasRef = useRef<HTMLDivElement | null>(null)
    const width = useElementWidth(canvasRef)

    const [editRequested, setEditRequested] = useState(false)
    const [catalogOpen, setCatalogOpen] = useState(false)
    const [settingsFor, setSettingsFor] = useState<string | null>(null)

    const {
        layout,
        source,
        loading,
        availableWidgets,
        placeItem,
        addWidget,
        duplicate,
        removeWidget,
        setItemSettings,
        setBand,
        setDensity,
        reset,
    } = useDashboardLayout()

    // Avant la première mesure, on suppose l'édition possible : afficher
    // un bouton désactivé le temps d'une frame serait pris pour un refus.
    const canEdit = width === 0 || width >= EDIT_MIN_WIDTH
    const editing = editRequested && canEdit

    const settingsItem =
        layout.items.find((i) => i.instanceId === settingsFor) ?? null

    return (
        <div className="flex min-h-full flex-1 flex-col bg-background">
            <AnnouncementBand
                expanded={layout.bands.announcements}
                onExpandedChange={(open) => setBand("announcements", open)}
            />

            <main ref={contentRef} className="relative flex-1 p-4 sm:p-6">
                <BioModeOverlay containerRef={contentRef} />

                {/* Toujours monté : c'est cet élément qu'on mesure, et une
                    mesure absente laisserait le canevas à zéro colonne. */}
                <div ref={canvasRef} className="relative">
                    {loading ? (
                        <SkeletonCard label="Chargement du tableau de bord" />
                    ) : layout.items.length === 0 ? (
                        <EmptyState
                            icon={LayoutGrid}
                            title="Votre tableau de bord est vide"
                            description="Ajoutez les modules qui correspondent à votre activité."
                            action={{
                                label: "Ajouter un module",
                                onClick: () => {
                                    setEditRequested(true)
                                    setCatalogOpen(true)
                                },
                            }}
                        />
                    ) : (
                        <WidgetCanvas
                            items={layout.items}
                            width={width}
                            editing={editing}
                            compact={layout.density === "compact"}
                            onPlace={placeItem}
                            onRemove={removeWidget}
                            onDuplicate={duplicate}
                            onOpenSettings={setSettingsFor}
                            onSettingsChange={setItemSettings}
                        />
                    )}
                </div>
            </main>

            {/* Le pied de page : les commandes, puis l'ourlet.
                Les deux collent ensemble, dans un seul conteneur. C'est ce
                qui donne à la pastille le décalage exact — auparavant un
                `bottom-14` codé en dur, qui supposait une hauteur d'ourlet
                et flottait au-dessus de rien quand aucune version n'était
                publiée. */}
            <div className="sticky bottom-0 z-20">
                <div className="pointer-events-none flex justify-end px-4 pb-3 sm:px-6">
                    <DashboardToolbar
                        editing={editing}
                        canEdit={canEdit}
                        density={layout.density}
                        personal={source === "user"}
                        onToggleEditing={() => setEditRequested((p) => !p)}
                        onOpenCatalog={() => setCatalogOpen(true)}
                        onDensityChange={setDensity}
                        onReset={() => void reset()}
                    />
                </div>

                <ChangelogRail />
            </div>

            <WidgetCatalog
                open={catalogOpen}
                onOpenChange={setCatalogOpen}
                available={availableWidgets}
                items={layout.items}
                onAdd={(widget) => {
                    addWidget(widget)
                    setCatalogOpen(false)
                }}
            />

            <WidgetSettingsSheet
                open={settingsFor !== null}
                onOpenChange={(open) => !open && setSettingsFor(null)}
                item={settingsItem}
                widget={
                    settingsItem ? (getWidget(settingsItem.widgetId) ?? null) : null
                }
                onSettingsChange={(patch) =>
                    settingsItem &&
                    setItemSettings(settingsItem.instanceId, patch)
                }
                onDuplicate={() =>
                    settingsItem && duplicate(settingsItem.instanceId)
                }
                onRemove={() =>
                    settingsItem && removeWidget(settingsItem.instanceId)
                }
            />
        </div>
    )
}
