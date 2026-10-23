import { expect, test } from "@rstest/core"
import { lazy } from "react"
import type { WidgetDef } from "@/shared/types/widget.types"
import { LAYOUT_VERSION } from "../constants"
import { collides } from "../layout/gridEngine"
import type { DashboardLayout, LayoutItem } from "../types/layout.types"
import {
    canAdd,
    countInstances,
    createItem,
    defaultLayout,
    duplicateItem,
    initialSettings,
    sanitizeLayout,
} from "./resolveLayout"

const NOOP_COMPONENT = lazy(async () => ({ default: () => null }))

function widget(overrides: Partial<WidgetDef> & { id: string }): WidgetDef {
    return {
        title: overrides.id,
        icon: () => null,
        category: "outils",
        defaultW: 6,
        minW: 3,
        maxW: 12,
        defaultH: 4,
        minH: 2,
        maxH: 8,
        Component: NOOP_COMPONENT,
        ...overrides,
    }
}

const shortcuts = widget({ id: "dashboard.shortcuts", starter: 1 })
const rdv = widget({ id: "crm.rdv", permission: "crm.view", starter: 2 })
const notes = widget({ id: "dashboard.notes" })

function item(overrides: Partial<LayoutItem> & { widgetId: string }): LayoutItem {
    return {
        instanceId: `i-${overrides.widgetId}`,
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        settings: {},
        ...overrides,
    }
}

function layout(items: LayoutItem[]): DashboardLayout {
    return {
        version: LAYOUT_VERSION,
        items,
        bands: { announcements: true },
        density: "comfortable",
    }
}

test("le défaut ne contient que les modules marqués starter, dans leur ordre", () => {
    const result = defaultLayout([notes, rdv, shortcuts])

    expect(result.items.map((i) => i.widgetId)).toEqual([
        "dashboard.shortcuts",
        "crm.rdv",
    ])
})

test("le défaut pose les modules côte à côte, sans chevauchement", () => {
    const [first, second] = defaultLayout([shortcuts, rdv]).items

    expect(first).toMatchObject({ x: 0, y: 0, w: 6, h: 4 })
    expect(second).toMatchObject({ x: 6, y: 0 })
    expect(collides(first, second)).toBe(false)
})

test("un module absent du registre est écarté", () => {
    const result = sanitizeLayout(
        layout([item({ widgetId: "feature.supprimee" })]),
        [shortcuts]
    )

    expect(result.items).toHaveLength(0)
})

test("un module dont la permission a été retirée est écarté sans écriture", () => {
    // `available` ne contient pas `crm.rdv` : c'est le filtre de permission
    // qui l'a déjà retiré en amont.
    const result = sanitizeLayout(
        layout([item({ widgetId: "crm.rdv" }), item({ widgetId: "dashboard.shortcuts" })]),
        [shortcuts]
    )

    expect(result.items.map((i) => i.widgetId)).toEqual(["dashboard.shortcuts"])
})

test("un rectangle hors des bornes déclarées est ramené dedans", () => {
    const result = sanitizeLayout(
        layout([item({ widgetId: "dashboard.shortcuts", w: 1, h: 40, x: 11 })]),
        [shortcuts]
    )

    expect(result.items[0]).toMatchObject({ w: 3, h: 8, x: 9 })
})

test("le rebornage ne laisse pas de chevauchement derrière lui", () => {
    // Deux modules côte à côte dont la largeur minimale a augmenté depuis :
    // une fois élargis, ils ne tiennent plus sur la même ligne.
    const large = widget({ id: "large", minW: 8, maxW: 12 })

    const result = sanitizeLayout(
        layout([
            item({ widgetId: "large", instanceId: "a", x: 0, y: 0, w: 6 }),
            item({ widgetId: "large", instanceId: "b", x: 6, y: 0, w: 6 }),
        ]),
        [large]
    )

    expect(collides(result.items[0], result.items[1])).toBe(false)
})

test("maxInstances écarte les instances excédentaires", () => {
    const unique = widget({ id: "dashboard.shortcuts", maxInstances: 1 })

    const result = sanitizeLayout(
        layout([
            item({ widgetId: "dashboard.shortcuts", instanceId: "a" }),
            item({ widgetId: "dashboard.shortcuts", instanceId: "b", y: 4 }),
        ]),
        [unique]
    )

    expect(result.items.map((i) => i.instanceId)).toEqual(["a"])
})

test("le repli des bandes et la densité traversent la résolution", () => {
    const source: DashboardLayout = {
        ...layout([]),
        bands: { announcements: false },
        density: "compact",
    }

    expect(sanitizeLayout(source, [])).toMatchObject({
        bands: { announcements: false },
        density: "compact",
    })
})

test("un module ajouté se pose dans le premier trou de la page", () => {
    const items = [
        item({ widgetId: "a", instanceId: "a", x: 0, y: 0, w: 6, h: 4 }),
    ]

    expect(createItem(shortcuts, items)).toMatchObject({ x: 6, y: 0 })
})

test("un module ajouté reçoit les valeurs par défaut de ses réglages", () => {
    const withSettings = widget({
        id: "dashboard.notes",
        settings: [
            {
                key: "text",
                label: "Note",
                type: "text",
                maxLength: 100,
                defaultValue: "",
            },
            { key: "dense", label: "Dense", type: "boolean", defaultValue: true },
        ],
    })

    expect(initialSettings(withSettings)).toEqual({ text: "", dense: true })
    expect(createItem(withSettings, []).settings).toEqual({
        text: "",
        dense: true,
    })
})

test("deux instances du même module ont des identifiants distincts", () => {
    const first = createItem(shortcuts, [])
    const second = createItem(shortcuts, [first])

    expect(first.instanceId).not.toBe(second.instanceId)
})

test("dupliquer reprend les réglages et la taille, pas la place", () => {
    const source = item({
        widgetId: "dashboard.notes",
        instanceId: "source",
        w: 4,
        h: 6,
        settings: { text: "à faire" },
    })

    const copy = duplicateItem(source, [source])

    expect(copy).toMatchObject({ w: 4, h: 6, settings: { text: "à faire" } })
    expect(copy.instanceId).not.toBe("source")
    expect(collides(copy, source)).toBe(false)
})

test("canAdd ne bloque que les modules qui déclarent une limite", () => {
    const unique = widget({ id: "dashboard.shortcuts", maxInstances: 1 })
    const items = [item({ widgetId: "dashboard.shortcuts" })]

    expect(countInstances(items, "dashboard.shortcuts")).toBe(1)
    expect(canAdd(items, unique)).toBe(false)
    expect(canAdd(items, shortcuts)).toBe(true)
})

test("sanitizeLayout écarte les noms de module enregistrés", () => {
    // Le renommage d'instance a été retiré de l'interface. Les noms déjà
    // en base ne doivent ni faire échouer la validation, ni réapparaître.
    const w = widget({ id: "a" })
    const layout: DashboardLayout = {
        version: LAYOUT_VERSION,
        items: [
            {
                instanceId: "i1",
                widgetId: "a",
                x: 0,
                y: 0,
                w: 6,
                h: 4,
                title: "Mon nom à moi",
                settings: {},
            },
        ],
        bands: { announcements: true },
        density: "comfortable",
    }

    const result = sanitizeLayout(layout, [w])

    expect(result.items[0]).not.toHaveProperty("title")
})
