import { expect, test } from "@rstest/core"

import { sortItems } from "./sortItems"
import type { DriveItem } from "../types"

const make = (over: Partial<DriveItem>): DriveItem => ({
    id: over.id ?? "x",
    url: "",
    owner: "perso",
    owner_id: "u1",
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
})

const titles = (items: DriveItem[]) => items.map((i) => i.title)

test("les dossiers restent en tête quel que soit le critère", () => {
    const items = [
        make({ id: "1", title: "zebre.pdf", sizeBytes: 900 }),
        make({ id: "2", title: "archives", isFolder: true }),
        make({ id: "3", title: "alpha.pdf", sizeBytes: 100 }),
    ]

    expect(titles(sortItems(items, "name-asc"))[0]).toBe("archives")
    expect(titles(sortItems(items, "name-desc"))[0]).toBe("archives")
    // Un dossier n'a pas de taille : il ne doit pas tomber en fin de liste.
    expect(titles(sortItems(items, "size-desc"))[0]).toBe("archives")
})

test("le tri par nom respecte l'ordre français et les nombres", () => {
    const items = [
        make({ id: "1", title: "Élan" }),
        make({ id: "2", title: "fichier10" }),
        make({ id: "3", title: "fichier2" }),
        make({ id: "4", title: "avion" }),
    ]

    // "Élan" se range sur "E", et fichier2 avant fichier10 (tri numérique).
    expect(titles(sortItems(items, "name-asc"))).toEqual([
        "avion",
        "Élan",
        "fichier2",
        "fichier10",
    ])
})

test("le tri par date et par taille ordonne dans les deux sens", () => {
    const items = [
        make({ id: "1", title: "b", createdAt: "2026-05-01T00:00:00Z", sizeBytes: 50 }),
        make({ id: "2", title: "a", createdAt: "2026-08-01T00:00:00Z", sizeBytes: 900 }),
    ]

    expect(titles(sortItems(items, "date-desc"))).toEqual(["a", "b"])
    expect(titles(sortItems(items, "date-asc"))).toEqual(["b", "a"])
    expect(titles(sortItems(items, "size-desc"))).toEqual(["a", "b"])
    expect(titles(sortItems(items, "size-asc"))).toEqual(["b", "a"])
})

test("sortItems ne mute pas son entrée", () => {
    const items = [make({ id: "1", title: "b" }), make({ id: "2", title: "a" })]
    const before = titles(items)
    sortItems(items, "name-asc")
    expect(titles(items)).toEqual(before)
})
