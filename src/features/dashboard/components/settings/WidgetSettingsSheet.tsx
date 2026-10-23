import { useMemo } from "react"
import { Copy, Trash2 } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import type {
    WidgetDef,
    WidgetSetting,
    WidgetSettingOption,
    WidgetSettingValue,
} from "@/shared/types/widget.types"
import { Button } from "@/shared/ui/atoms/button"
import { Separator } from "@/shared/ui/atoms/separator"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/shared/ui/atoms/sheet"
import type { LayoutItem } from "../../types/layout.types"
import { widgetAccent } from "../../widgets/accents"
import { SettingField } from "./SettingField"

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    item: LayoutItem | null
    widget: WidgetDef | null
    onSettingsChange: (patch: Record<string, WidgetSettingValue>) => void
    onDuplicate: () => void
    onRemove: () => void
}

/** Réglages sans groupe déclaré, réunis en tête du panneau. */
const UNGROUPED = "__general"

/**
 * Réglages d'une instance de module.
 *
 * Le panneau ne parle que du module : ce qu'il montre et comment il le
 * montre. La **taille n'y figure pas** — elle appartient au canevas, elle
 * se règle à la poignée, et un compteur de colonnes dans un panneau de
 * réglages ferait passer une propriété de mise en page pour une propriété
 * du module.
 *
 * Quand un module ne déclare aucun réglage, il reste ses deux actions
 * d'instance — dupliquer, retirer. Le panneau n'est donc jamais vide,
 * mais il n'est jamais rempli de faux réglages non plus.
 *
 * Chaque modification s'applique immédiatement : il n'y a pas de bouton
 * « Enregistrer », donc pas de moment où l'on peut perdre un réglage en
 * fermant le panneau.
 */
export function WidgetSettingsSheet({
    open,
    onOpenChange,
    item,
    widget,
    onSettingsChange,
    onDuplicate,
    onRemove,
}: Props) {
    const { allowedRoutes } = useAuth()

    /**
     * Les options d'un `multiselect` dont la source est `routes` : les
     * pages auxquelles ce compte a droit. Elles ne peuvent pas être
     * déclarées dans le registre puisqu'elles dépendent de
     * l'utilisateur — c'est le panneau qui les construit, pour que
     * `SettingField` reste ignorant de l'auth et du routage.
     *
     * Les entrées masquées de la sidebar (le profil, les réglages) sont
     * écartées : un raccourci double la navigation, il ne l'élargit pas.
     *
     * Clé = `MenuItem.title` et non `href` : c'est l'identifiant stable,
     * une URL peut changer.
     */
    const routeOptions = useMemo<WidgetSettingOption[]>(
        () =>
            allowedRoutes
                .filter((entry) => !entry.hideFromSidebar)
                .map((entry) => ({
                    value: entry.title,
                    label: entry.displayName,
                })),
        [allowedRoutes]
    )

    if (!item || !widget) return null

    const groups = groupSettings(widget.settings ?? [])
    const Icon = widget.icon
    const accent = widgetAccent(widget)

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                    <div className="flex items-center gap-3">
                        <span
                            className={`shrink-0 rounded-md p-1.5 ring-1 ${accent.pill}`}
                        >
                            <Icon className="size-4" />
                        </span>
                        <SheetTitle className="min-w-0">
                            {widget.title}
                        </SheetTitle>
                    </div>
                    {widget.description && (
                        <SheetDescription>
                            {widget.description}
                        </SheetDescription>
                    )}
                </SheetHeader>

                <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-6">
                    {groups.map(([group, settings]) => (
                        <Section
                            key={group}
                            title={
                                group === UNGROUPED
                                    ? "Réglages du module"
                                    : group
                            }
                        >
                            {settings.map((setting) => (
                                <SettingField
                                    key={setting.key}
                                    setting={setting}
                                    resolvedOptions={
                                        setting.type === "multiselect" &&
                                        setting.optionsSource === "routes"
                                            ? routeOptions
                                            : undefined
                                    }
                                    value={item.settings[setting.key]}
                                    onChange={(value) =>
                                        onSettingsChange({
                                            [setting.key]: value,
                                        })
                                    }
                                />
                            ))}
                        </Section>
                    ))}

                    <Separator />

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                                onDuplicate()
                                onOpenChange(false)
                            }}
                        >
                            <Copy className="size-4" />
                            Dupliquer
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1 text-destructive hover:text-destructive"
                            onClick={() => {
                                onRemove()
                                onOpenChange(false)
                            }}
                        >
                            <Trash2 className="size-4" />
                            Retirer
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}

interface SectionProps {
    title: string
    children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
    return (
        <section className="flex flex-col gap-4">
            <h3 className="text-3xs font-medium tracking-widest text-muted-foreground uppercase">
                {title}
            </h3>
            {children}
        </section>
    )
}

/**
 * Répartit les réglages par section, les sans-groupe en tête. L'ordre de
 * déclaration est conservé à l'intérieur de chaque section : c'est le
 * widget qui sait dans quel ordre ses réglages se lisent.
 */
function groupSettings(settings: WidgetSetting[]): [string, WidgetSetting[]][] {
    const groups = new Map<string, WidgetSetting[]>()

    for (const setting of settings) {
        const key = setting.group ?? UNGROUPED
        const bucket = groups.get(key)
        if (bucket) bucket.push(setting)
        else groups.set(key, [setting])
    }

    return [...groups.entries()].sort(([a], [b]) =>
        a === UNGROUPED ? -1 : b === UNGROUPED ? 1 : 0
    )
}
