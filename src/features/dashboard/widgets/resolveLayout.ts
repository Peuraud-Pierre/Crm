import { sizeBounds, type WidgetDef } from "@/shared/types/widget.types"
import { LAYOUT_VERSION } from "../constants"
import {
    clampRect,
    firstFreeSpot,
    normalize,
    type Rect,
} from "../layout/gridEngine"
import type { DashboardLayout, LayoutItem } from "../types/layout.types"

/**
 * Résolution d'une disposition en une page réellement affichable.
 *
 * Entre ce qui est enregistré et ce qui est rendu, trois choses ont pu
 * changer, et aucune ne doit casser la page.
 */

function newInstanceId(widgetId: string): string {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${widgetId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Disposition par défaut : les modules que les features ont marqués
 * `starter`, dans leur ordre déclaré et dans leur taille déclarée.
 *
 * C'est ce que voit quelqu'un sans disposition personnelle et dont le
 * rôle n'a pas de gabarit. Filtrée par `available`, donc déjà réduite à
 * ce à quoi la personne a droit.
 */
export function defaultLayout(available: WidgetDef[]): DashboardLayout {
    const items: LayoutItem[] = []

    const starters = available
        .filter((w) => w.starter !== undefined)
        .sort((a, b) => (a.starter ?? 0) - (b.starter ?? 0))

    for (const widget of starters) {
        const { x, y } = firstFreeSpot(items, widget.defaultW, widget.defaultH)

        items.push({
            instanceId: `default-${widget.id}`,
            widgetId: widget.id,
            x,
            y,
            w: widget.defaultW,
            h: widget.defaultH,
            settings: {},
        })
    }

    return {
        version: LAYOUT_VERSION,
        items,
        bands: { announcements: true },
        density: "comfortable",
    }
}

/**
 * Rend exploitable une disposition venant de la base.
 *
 * 1. **Un widget a disparu du registre** (feature retirée, identifiant
 *    renommé) → l'entrée est ignorée.
 * 2. **Une permission a été retirée** → l'entrée est ignorée, sans qu'il
 *    faille nettoyer la base. C'est le même filtre `available` qui sert
 *    au catalogue, donc les deux ne peuvent pas diverger.
 * 3. **Les bornes de taille ont changé** → le rectangle est ramené dans
 *    l'intervalle déclaré, puis `normalize` défait les chevauchements que
 *    ce rebornage a pu créer.
 *
 * Aucun module n'est ré-injecté : le socle d'information commun a quitté
 * le canevas pour devenir les deux zones fixes de la page.
 */
export function sanitizeLayout(
    layout: DashboardLayout,
    available: WidgetDef[]
): DashboardLayout {
    const byId = new Map(available.map((w) => [w.id, w]))
    const placed = new Map<string, number>()

    const items: LayoutItem[] = []

    for (const item of layout.items) {
        const widget = byId.get(item.widgetId)
        if (!widget) continue

        // Un module peut être posé plusieurs fois — sauf s'il déclare une
        // limite, auquel cas les instances excédentaires sont écartées.
        const count = placed.get(widget.id) ?? 0
        if (widget.maxInstances !== undefined && count >= widget.maxInstances) {
            continue
        }
        placed.set(widget.id, count + 1)

        // Le renommage d'instance a été retiré : un module qui ne
        // porte plus le nom du registre ment sur ce qu'il montre, et
        // personne n'a jamais eu besoin de le renommer. Les noms déjà
        // enregistrés sont écartés ici, et disparaissent de la base à la
        // première écriture — sans migration ni rejet de ligne.
        const { title: _renommage, ...rest } = item
        void _renommage

        items.push({
            ...rest,
            ...clampRect(item, sizeBounds(widget)),
        })
    }

    return { ...layout, version: LAYOUT_VERSION, items: normalize(items) }
}

/**
 * Crée une entrée pour un module ajouté depuis le catalogue, posée dans
 * le premier emplacement libre — donc dans un trou de la page si elle en
 * a un, et non systématiquement tout en bas.
 */
export function createItem(
    widget: WidgetDef,
    items: LayoutItem[]
): LayoutItem {
    const { x, y } = firstFreeSpot(items, widget.defaultW, widget.defaultH)

    return {
        instanceId: newInstanceId(widget.id),
        widgetId: widget.id,
        x,
        y,
        w: widget.defaultW,
        h: widget.defaultH,
        settings: initialSettings(widget),
    }
}

/** Copie d'une instance existante, réglages compris, posée à côté. */
export function duplicateItem(
    source: LayoutItem,
    items: LayoutItem[]
): LayoutItem {
    const { x, y } = firstFreeSpot(items, source.w, source.h)

    return {
        ...source,
        instanceId: newInstanceId(source.widgetId),
        x,
        y,
    }
}

/** Valeurs par défaut des réglages déclarés par le widget. */
export function initialSettings(widget: WidgetDef): LayoutItem["settings"] {
    const settings: LayoutItem["settings"] = {}

    for (const setting of widget.settings ?? []) {
        settings[setting.key] = setting.defaultValue
    }

    return settings
}

/** Nombre d'instances d'un module déjà posées sur la page. */
export function countInstances(items: LayoutItem[], widgetId: string): number {
    return items.filter((i) => i.widgetId === widgetId).length
}

/**
 * Ce module peut-il encore être ajouté ? Sert à griser une entrée du
 * catalogue plutôt qu'à la masquer : on explique la limite, on ne fait
 * pas disparaître le module sans raison visible.
 */
export function canAdd(items: LayoutItem[], widget: WidgetDef): boolean {
    if (widget.maxInstances === undefined) return true
    return countInstances(items, widget.id) < widget.maxInstances
}

/** Rectangle courant d'une entrée — pour l'appel à `place`. */
export function rectOf(item: LayoutItem): Rect {
    return { x: item.x, y: item.y, w: item.w, h: item.h }
}
