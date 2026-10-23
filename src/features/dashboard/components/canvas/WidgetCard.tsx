import { Suspense, memo, useCallback, useMemo } from "react"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Wrench } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useMaintenanceContext } from "@/features/maintenance"
import { isRouteAllowed } from "@/shared/lib/routeAccess"
import { cn } from "@/shared/lib/utils"
import type {
    WidgetDef,
    WidgetSettingValue,
} from "@/shared/types/widget.types"
import { SkeletonCard } from "@/shared/ui/molecules/skeleton-presets"
import { canvasHeight, rectStyle } from "../../layout/geometry"
import type { ResizeEdge } from "../../layout/gridEngine"
import { widgetAccent } from "../../widgets/accents"
import type { LayoutItem } from "../../types/layout.types"
import { ResizeHandles } from "./ResizeHandles"
import { WidgetCardHeader } from "./WidgetCardHeader"
import { WidgetErrorBoundary } from "./WidgetErrorBoundary"

interface Props {
    item: LayoutItem
    widget: WidgetDef
    /**
     * Géométrie en **unités de grille**, passée en nombres et non en
     * objet de style. La carte est mémoïsée : un objet reconstruit à
     * chaque rendu du canevas suffirait à annuler la mémoïsation, alors
     * que quatre nombres se comparent à l'identique.
     */
    x: number
    y: number
    w: number
    h: number
    /**
     * Hauteur transmise **au module** pour dimensionner ce qu'il charge.
     *
     * Distincte de `h`, qui est la hauteur affichée : pendant un geste,
     * `h` suit l'aperçu et change à chaque case franchie, alors que
     * celle-ci reste celle qui est enregistrée. Sans cette séparation,
     * étirer une poignée de trois à huit unités déclenchait une requête
     * réseau par case, dans chaque module dont le nombre de lignes en
     * dépend — pour un contenu qui n'est même pas cliquable en édition.
     */
    dataHeight: number
    editing: boolean
    compact: boolean
    colWidth: number
    /** Ce module est celui qu'on est en train de manipuler. */
    active: boolean
    /** Empilement en colonne unique : la carte suit le flux du document. */
    stacked?: boolean
    /** Ce module est en cours de redimensionnement. */
    resizing?: boolean
    /**
     * Ce module vient d'être lâché : il se pose sans transition.
     *
     * Sans ce drapeau il serait indistinguable d'un voisin qui se range —
     * or les deux n'appellent pas le même traitement, et c'est la seule
     * information que le rendu n'a pas déjà.
     */
    settling?: boolean
    /** Un geste est en cours ailleurs : cette carte ne réagit plus. */
    frozen?: boolean
    // Les gestionnaires reçoivent l'identifiant plutôt que d'être liés
    // par une closure côté canevas : une closure par carte et par rendu
    // aurait la même conséquence qu'un objet de style reconstruit.
    onResizeStart: (instanceId: string, edge: ResizeEdge) => void
    onResizeMove: (edge: ResizeEdge, dCols: number, dRows: number) => void
    onResizeEnd: () => void
    onResizeStep: (instanceId: string, dw: number, dh: number) => void
    onRemove: (instanceId: string) => void
    onDuplicate: (instanceId: string) => void
    onOpenSettings: (instanceId: string) => void
    onSettingsChange: (
        instanceId: string,
        patch: Record<string, WidgetSettingValue>
    ) => void
}

/**
 * Habillage commun d'un module.
 *
 * Au repos, le chrome s'efface : un titre discret, et rien d'autre tant
 * que la souris n'est pas dessus. C'est le contenu qu'on vient lire, pas
 * les boutons qui l'entourent. En mode édition il apparaît en entier —
 * poignée, menu, coin de redimensionnement.
 *
 * Le widget lui-même ne connaît rien de tout cela : il reçoit ses
 * réglages, sa hauteur et la densité.
 */
function WidgetCardBase({
    item,
    widget,
    x,
    y,
    w,
    h,
    dataHeight,
    editing,
    compact,
    colWidth,
    active,
    stacked = false,
    resizing = false,
    settling = false,
    frozen = false,
    onResizeStart,
    onResizeMove,
    onResizeEnd,
    onResizeStep,
    onRemove,
    onDuplicate,
    onOpenSettings,
    onSettingsChange,
}: Props) {
    const { isFeatureDown } = useMaintenanceContext()
    const { allowedRoutes } = useAuth()
    const featureDown = isFeatureDown(widget.featureKey)
    const { instanceId } = item

    /**
     * Empilé, la carte suit le flux du document : seule sa hauteur est
     * imposée, et en `minHeight` — un module de N unités occupe aussi les
     * N-1 gouttières qu'il enjambe sur le canevas, et le contenu doit
     * pouvoir s'étendre au-delà quand plus rien n'est aligné sur une
     * grille.
     */
    const style = useMemo(
        () =>
            stacked
                ? { minHeight: canvasHeight(h) }
                : rectStyle({ x, y, w, h }, colWidth),
        [stacked, x, y, w, h, colWidth]
    )

    const handleRemove = useCallback(
        () => onRemove(instanceId),
        [onRemove, instanceId]
    )
    const handleDuplicate = useCallback(
        () => onDuplicate(instanceId),
        [onDuplicate, instanceId]
    )
    const handleOpenSettings = useCallback(
        () => onOpenSettings(instanceId),
        [onOpenSettings, instanceId]
    )
    const handleSettingsChange = useCallback(
        (patch: Record<string, WidgetSettingValue>) =>
            onSettingsChange(instanceId, patch),
        [onSettingsChange, instanceId]
    )
    const handleResizeStart = useCallback(
        (edge: ResizeEdge) => onResizeStart(instanceId, edge),
        [onResizeStart, instanceId]
    )
    const handleResizeStep = useCallback(
        (dw: number, dh: number) => onResizeStep(instanceId, dw, dh),
        [onResizeStep, instanceId]
    )

    /**
     * « Voir tout » ne s'affiche que si la page cible s'ouvre vraiment.
     *
     * La permission d'un module et celle de sa page sont deux codes
     * distincts : `stock.arrivage.view` laisse voir le module Arrivages,
     * mais c'est `stock.view` qui ouvre `/stock`. Proposer la flèche à
     * quelqu'un qui n'a que le premier code, c'est promettre un écran
     * NotFound. Le contrôle est ici, une fois, plutôt que répété dans
     * chaque module — il couvre aussi ceux qui n'existent pas encore.
     */
    const canOpen =
        widget.href !== undefined && isRouteAllowed(widget.href, allowedRoutes)

    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({ id: item.instanceId, disabled: !editing })

    const Icon = widget.icon
    const accent = widgetAccent(widget)

    /**
     * Titre affiché : celui que l'instance s'est donné, sinon celui du
     * module. Sert aux modules qu'on pose plusieurs fois et qu'il faut
     * pouvoir distinguer — deux blocs-notes, par exemple.
     *
     * Volontairement lu dans les **réglages** et non dans `item.title` :
     * ce champ-là est `@deprecated`, écarté par `sanitizeLayout`, et
     * conservé au schéma seulement pour que les dispositions déjà en base
     * passent la validation. Le ressusciter ferait cohabiter deux sources
     * pour la même chose. Les réglages sont déjà le mécanisme par
     * instance ; ce code n'a d'effet que pour un module qui déclare un
     * réglage `title`.
     */
    const custom = item.settings.title
    const title =
        typeof custom === "string" && custom.trim() !== ""
            ? custom.trim()
            : widget.title

    return (
        <div
            ref={setNodeRef}
            style={{
                ...style,
                // Arrondi : dnd-kit produit un delta fractionnaire, et une
                // carte translatée d'un demi-pixel rend ses bordures et son
                // texte sur deux pixels physiques — le même flou que la
                // géométrie de `rectStyle` corrige au repos.
                //
                // Le `transform` de la carte n'appartient qu'à dnd-kit : sa
                // position de grille passe par `left`/`top` (voir
                // `layout/geometry.ts`, qui documente pourquoi les composer
                // ici casse le déplacement).
                transform: transform
                    ? CSS.Translate.toString({
                          ...transform,
                          x: Math.round(transform.x),
                          y: Math.round(transform.y),
                      })
                    : undefined,
                // Promotion GPU le temps du geste seulement : laissée en
                // permanence sur trente cartes, elle coûte plus de mémoire
                // vidéo qu'elle ne fait gagner de fluidité.
                willChange: active ? "transform, width, height" : undefined,
            }}
            className={cn(
                "group",
                stacked ? "relative" : "absolute",
                // Pendant un geste, les voisins ne sont plus que du décor :
                // ils glissent, ils ne se survolent pas.
                frozen && "pointer-events-none",
                // Le replacement d'un voisin s'anime ; le déplacement en
                // cours, non — une carte qui traîne derrière le pointeur
                // donne l'impression que la page résiste. Le
                // redimensionnement, lui, avance par cases : sans
                // transition, chaque case franchie est un à-coup.
                //
                // **La carte qu'on vient de lâcher ne s'anime pas non
                // plus.** L'aperçu l'a déjà montrée à sa place pendant
                // tout le geste, et le pointeur l'y a menée : rejouer ce
                // trajet au relâchement ne fait que retarder la fin d'un
                // mouvement que l'utilisateur a déjà terminé. Elle se pose,
                // point. Le glissement reste là où il dit quelque chose —
                // sur les voisines, qui se réorganisent d'elles-mêmes et
                // dont il faut pouvoir suivre le déplacement.
                !active &&
                    !settling &&
                    "transition-[left,top,width,height] duration-fast ease-emphasized motion-reduce:transition-none",
                resizing &&
                    "transition-[left,top,width,height] duration-fast ease-decel motion-reduce:transition-none",
                // La carte saisie se décolle : un peu plus grande, au
                // premier plan, et le curseur ne la lâche pas.
                isDragging && "z-20 scale-102 cursor-grabbing motion-reduce:scale-100"
            )}
        >
            <div
                className={cn(
                    "flex h-full flex-col overflow-hidden rounded-lg border bg-gradient-to-br from-card to-muted/30",
                    editing
                        ? "border-primary/30 shadow-raised"
                        : "border-border/60 shadow-surface",
                    isDragging && "shadow-raised"
                )}
            >
                {/* Le filet d'identité. C'est le seul endroit du canevas
                    où passe une couleur pleine : deux pixels suffisent à
                    distinguer neuf modules empilés, là où neuf cartes
                    blanches sur fond blanc n'en distinguaient aucun. */}
                <span
                    aria-hidden="true"
                    className={cn("h-0.5 shrink-0", accent.rule)}
                />

                <WidgetCardHeader
                    title={title}
                    icon={Icon}
                    accentPill={accent.pill}
                    editing={editing}
                    href={canOpen ? widget.href : undefined}
                    dragHandle={{ ...attributes, ...listeners }}
                    onOpenSettings={handleOpenSettings}
                    onDuplicate={handleDuplicate}
                    onRemove={handleRemove}
                />

                <div
                    className={cn(
                        "min-h-0 flex-1 overflow-auto",
                        // Pendant l'édition, le contenu n'est pas cliquable :
                        // on agence la page, on ne s'en sert pas.
                        editing && "pointer-events-none select-none"
                    )}
                >
                    {featureDown ? (
                        // La feature est coupée : on l'annonce plutôt que
                        // de laisser le module échouer sur des requêtes qui
                        // n'aboutiront pas.
                        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                            <Wrench className="size-5 text-warning" />
                            <p className="text-sm font-medium">
                                Module en maintenance
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Il redeviendra disponible à la fin de
                                l'intervention.
                            </p>
                        </div>
                    ) : (
                        <WidgetErrorBoundary title={title}>
                            <Suspense
                                fallback={
                                    <div className="p-4">
                                        <SkeletonCard
                                            label={`Chargement de ${title}`}
                                        />
                                    </div>
                                }
                            >
                                <widget.Component
                                    settings={item.settings}
                                    height={dataHeight}
                                    compact={compact}
                                    onSettingsChange={handleSettingsChange}
                                />
                            </Suspense>
                        </WidgetErrorBoundary>
                    )}
                </div>
            </div>

            {editing && (
                <ResizeHandles
                    label={title}
                    colWidth={colWidth}
                    onStart={handleResizeStart}
                    onMove={onResizeMove}
                    onEnd={onResizeEnd}
                    onStep={handleResizeStep}
                />
            )}
        </div>
    )
}

/**
 * Mémoïsée : sur un canevas de quinze modules, un geste recalcule la
 * disposition à chaque case franchie, et sans cela les quinze cartes —
 * donc les quinze modules et tout leur contenu — se re-rendaient à chaque
 * fois.
 *
 * Trois conditions devaient être réunies pour que ce soit utile, et
 * aucune n'était vraie avant : le moteur de grille réutilise désormais
 * l'objet d'un module que le geste ne déplace pas (`layout/gridEngine.ts`),
 * la géométrie arrive en nombres plutôt qu'en objet de style, et les
 * gestionnaires sont stables de bout en bout — du hook de disposition
 * jusqu'ici. Retirer l'une des trois suffit à annuler l'effet sans que
 * rien ne le signale.
 */
export const WidgetCard = memo(WidgetCardBase)
