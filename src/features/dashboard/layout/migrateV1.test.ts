import { expect, rstest, test } from "@rstest/core"
import { LAYOUT_VERSION } from "../constants"
import { collides } from "./gridEngine"
import { migrateV1, readStoredLayout } from "./migrateV1"

/** Une disposition v1 réaliste : les deux imposés, puis deux modules. */
const V1 = {
    version: 1,
    items: [
        {
            instanceId: "required-announcements.carousel",
            widgetId: "announcements.carousel",
            span: 12,
            rows: 3,
            settings: {},
        },
        {
            instanceId: "required-changelog.timeline",
            widgetId: "changelog.timeline",
            span: 12,
            rows: 5,
            settings: {},
        },
        {
            instanceId: "a",
            widgetId: "crm.today-events",
            span: 6,
            rows: 3,
            settings: {},
        },
        {
            instanceId: "b",
            widgetId: "tickets.mine",
            span: 6,
            rows: 3,
            settings: {},
        },
    ],
}

test("les deux modules imposés quittent le canevas", () => {
    const result = migrateV1(V1)

    expect(result?.items.map((i) => i.widgetId)).toEqual([
        "crm.today-events",
        "tickets.mine",
    ])
})

test("le flux v1 est rejoué en coordonnées, sans chevauchement", () => {
    const items = migrateV1(V1)?.items ?? []

    // Deux modules de 6 colonnes tiennent côte à côte sur la première ligne.
    expect(items[0]).toMatchObject({ x: 0, y: 0, w: 6 })
    expect(items[1]).toMatchObject({ x: 6, y: 0, w: 6 })
    expect(collides(items[0], items[1])).toBe(false)
})

test("la hauteur double : le pas de ligne est passé de 120 à 60 px", () => {
    expect(migrateV1(V1)?.items[0]).toMatchObject({ h: 6 })
})

test("la migration produit une disposition complète du format courant", () => {
    const result = migrateV1(V1)

    expect(result).toMatchObject({
        version: LAYOUT_VERSION,
        bands: { announcements: true },
        density: "comfortable",
    })
})

test("readStoredLayout accepte le format courant tel quel", () => {
    const v2 = {
        version: LAYOUT_VERSION,
        items: [
            {
                instanceId: "a",
                widgetId: "tickets.mine",
                x: 0,
                y: 0,
                w: 6,
                h: 4,
                settings: {},
            },
        ],
    }

    expect(readStoredLayout(v2)?.items).toHaveLength(1)
    // Les valeurs par défaut sont posées à la lecture.
    expect(readStoredLayout(v2)?.density).toBe("comfortable")
})

test("readStoredLayout migre le format 1", () => {
    expect(readStoredLayout(V1)?.version).toBe(LAYOUT_VERSION)
})

test("une version future est ignorée plutôt que mal interprétée", () => {
    const warnSpy = rstest.spyOn(console, "warn").mockImplementation(() => {})

    expect(
        readStoredLayout({ version: LAYOUT_VERSION + 1, items: [] })
    ).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`version ${LAYOUT_VERSION + 1}, inconnue`)
    )
    warnSpy.mockRestore()
})

test("une valeur inexploitable retourne null sans lever", () => {
    expect(readStoredLayout(null)).toBeNull()
    expect(readStoredLayout("nope")).toBeNull()
    expect(readStoredLayout({ items: [] })).toBeNull()
    expect(migrateV1({ version: 1, items: [{ widgetId: "x" }] })).toBeNull()
})
