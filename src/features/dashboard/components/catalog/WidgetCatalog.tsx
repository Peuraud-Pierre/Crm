import { useMemo, useState } from "react"
import { LayoutGrid, Plus, Search } from "lucide-react"
import { menuItems } from "@/shared/components/layout/menuItems"
import { cn } from "@/shared/lib/utils"
import type { WidgetCategory, WidgetDef } from "@/shared/types/widget.types"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/shared/ui/atoms/sheet"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import type { LayoutItem } from "../../types/layout.types"
import { canAdd, countInstances } from "../../widgets/resolveLayout"

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Modules que cet utilisateur a le droit de voir. */
    available: WidgetDef[]
    items: LayoutItem[]
    onAdd: (widget: WidgetDef) => void
}

/** Libellés des types de module, en second niveau. */
const CATEGORY_LABEL: Record<WidgetCategory, string> = {
    activite: "Mon activité",
    metier: "Suivi des activités",
    outils: "Outils",
}

/** Ordre des types dans une feature — du plus personnel au moins. */
const CATEGORY_ORDER: WidgetCategory[] = ["activite", "metier", "outils"]

/**
 * Groupe d'accueil des modules qui n'appartiennent à aucune feature :
 * raccourcis, bloc-notes, notifications. Ils ne montrent aucune donnée
 * métier, donc aucune feature ne les possède.
 */
const TOOLS_GROUP = "__outils"

interface FeatureGroup {
    key: string
    label: string
    widgets: WidgetDef[]
}

/**
 * Catalogue des modules ajoutables.
 *
 * Deux niveaux : **la feature d'abord, le type ensuite**. On cherche un
 * module en pensant « où » (quel domaine) avant de penser « quoi » — et
 * dix modules répartis en trois types seulement obligeaient à parcourir
 * les trois pour trouver ceux du stock.
 *
 * Les libellés de feature viennent de `menuItems.ts` (`displayName`), et
 * leur ordre aussi : c'est déjà celui de la sidebar, donc celui que
 * l'utilisateur connaît. Aucune table de correspondance à maintenir en
 * double — ajouter une feature au menu suffit.
 *
 * La liste est **déjà** filtrée par permission en amont
 * (`listAvailableWidgets`) : un module qu'on n'a pas le droit de voir
 * n'apparaît pas ici, pas même grisé — savoir qu'il existe est déjà une
 * information.
 *
 * Un module déjà posé reste proposé : rien n'interdit d'en placer deux
 * instances avec des réglages différents, et c'est même ce qui rend la
 * personnalisation utile. Seuls ceux qui déclarent une limite sont
 * grisés, avec la raison affichée — les faire disparaître donnerait
 * l'impression d'un catalogue instable.
 */
export function WidgetCatalog({
    open,
    onOpenChange,
    available,
    items,
    onAdd,
}: Props) {
    const [query, setQuery] = useState("")

    const matches = useMemo(() => {
        const needle = query.trim().toLowerCase()
        if (needle === "") return available

        return available.filter(
            (w) =>
                w.title.toLowerCase().includes(needle) ||
                (w.description ?? "").toLowerCase().includes(needle)
        )
    }, [available, query])

    const groups = useMemo(() => groupByFeature(matches), [matches])

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="flex w-full flex-col sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>Ajouter un module</SheetTitle>
                    <SheetDescription>
                        Seuls les modules auxquels vous avez accès sont
                        proposés.
                    </SheetDescription>
                </SheetHeader>

                <div className="relative px-4">
                    <Search className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher un module"
                        aria-label="Rechercher un module"
                        className="pl-9"
                    />
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-6">
                    {groups.length === 0 ? (
                        <EmptyState
                            size="sm"
                            variant={query.trim() === "" ? "default" : "search"}
                            icon={LayoutGrid}
                            title={
                                query.trim() === ""
                                    ? "Aucun module disponible"
                                    : "Aucun module ne correspond"
                            }
                            description={
                                query.trim() === ""
                                    ? "Vos accès ne donnent encore droit à aucun module."
                                    : "Essayez un autre mot."
                            }
                        />
                    ) : (
                        groups.map((group) => (
                            <FeatureSection
                                key={group.key}
                                group={group}
                                items={items}
                                onAdd={onAdd}
                            />
                        ))
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}

interface SectionProps {
    group: FeatureGroup
    items: LayoutItem[]
    onAdd: (widget: WidgetDef) => void
}

function FeatureSection({ group, items, onAdd }: SectionProps) {
    const sections = byCategory(group.widgets)

    // Le sous-intertitre n'apparaît que si la feature mélange plusieurs
    // types : un intertitre unique au-dessus d'un seul groupe ne
    // distingue rien de rien.
    const showHeadings = sections.length > 1

    return (
        <section className="flex flex-col gap-2">
            <h3 className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                {group.label}
            </h3>

            {sections.map(([category, widgets], index) => (
                <div key={category} className="flex flex-col gap-2">
                    {showHeadings && (
                        <h4
                            className={cn(
                                "text-3xs font-medium tracking-widest text-muted-foreground/80 uppercase",
                                index > 0 && "mt-1"
                            )}
                        >
                            {CATEGORY_LABEL[category]}
                        </h4>
                    )}

                    {widgets.map((widget) => (
                        <CatalogEntry
                            key={widget.id}
                            widget={widget}
                            items={items}
                            onAdd={onAdd}
                        />
                    ))}
                </div>
            ))}
        </section>
    )
}

interface EntryProps {
    widget: WidgetDef
    items: LayoutItem[]
    onAdd: (widget: WidgetDef) => void
}

function CatalogEntry({ widget, items, onAdd }: EntryProps) {
    const placed = countInstances(items, widget.id)
    const addable = canAdd(items, widget)
    const Icon = widget.icon

    return (
        <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="font-medium">{widget.title}</p>
                    {placed > 0 && (
                        <Badge variant="secondary">
                            {placed === 1
                                ? "Sur la page"
                                : `${placed} sur la page`}
                        </Badge>
                    )}
                </div>
                {widget.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        {widget.description}
                    </p>
                )}
                {!addable && (
                    <p className="mt-1 text-xs text-muted-foreground">
                        Ce module ne se pose qu'une fois.
                    </p>
                )}
            </div>

            <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={!addable}
                onClick={() => onAdd(widget)}
                aria-label={`Ajouter ${widget.title}`}
            >
                <Plus className="size-4" />
            </Button>
        </div>
    )
}

/**
 * Répartit les modules par feature, dans l'ordre de `menuItems.ts`, ceux
 * qui n'en ont pas réunis en fin de liste sous « Outils ».
 *
 * Un `featureKey` qui ne correspond à aucune entrée de menu (feature
 * retirée du menu, faute de frappe) retombe dans « Outils » plutôt que de
 * faire disparaître le module : mieux vaut un module mal rangé qu'un
 * module introuvable.
 */
function groupByFeature(widgets: WidgetDef[]): FeatureGroup[] {
    const labels = new Map(menuItems.map((m) => [m.title, m.displayName]))
    const order = new Map(menuItems.map((m, index) => [m.title, index]))

    const buckets = new Map<string, WidgetDef[]>()

    for (const widget of widgets) {
        const key =
            widget.featureKey && labels.has(widget.featureKey)
                ? widget.featureKey
                : TOOLS_GROUP

        const bucket = buckets.get(key)
        if (bucket) bucket.push(widget)
        else buckets.set(key, [widget])
    }

    return [...buckets.entries()]
        .map(([key, list]) => ({
            key,
            label: key === TOOLS_GROUP ? "Outils" : (labels.get(key) ?? key),
            widgets: list,
        }))
        .sort((a, b) => {
            // « Outils » ferme toujours la marche : ce sont les modules
            // qu'on ajoute en dernier, une fois le métier en place.
            if (a.key === TOOLS_GROUP) return 1
            if (b.key === TOOLS_GROUP) return -1
            return (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0)
        })
}

/** Les modules d'une feature, groupés par type, dans l'ordre canonique. */
function byCategory(widgets: WidgetDef[]): [WidgetCategory, WidgetDef[]][] {
    return CATEGORY_ORDER.map(
        (category) =>
            [category, widgets.filter((w) => w.category === category)] as [
                WidgetCategory,
                WidgetDef[],
            ]
    ).filter(([, list]) => list.length > 0)
}
