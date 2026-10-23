import { expect, test } from "@rstest/core"
import type {
    ChangelogCategory,
    ChangelogItemWithCategory,
    ChangelogVersionWithItems,
} from "../types/changelog.types"
import {
    countDescriptions,
    filterVersionByCategory,
    groupItemsByCategory,
    versionMatchesSearch,
} from "./groupItems"

function category(id: string, position: number, name = id): ChangelogCategory {
    return {
        id,
        name,
        // eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier (colonne changelog_categories.color) dans une fixture de test : non tokenisable (design system §12.4)
        color: "#123456",
        icon: null,
        position,
        created_at: "2026-01-01T00:00:00.000Z",
    }
}

function item(
    id: string,
    cat: ChangelogCategory,
    title: string,
    description: string | null,
    position = 0
): ChangelogItemWithCategory {
    return {
        id,
        version_id: "v1",
        category_id: cat.id,
        title,
        description,
        position,
        created_at: "2026-01-01T00:00:00.000Z",
        category: cat,
    }
}

const fixes = category("fixes", 1, "Correctifs")
const features = category("features", 0, "Fonctionnalités")

test("les catégories sortent dans l'ordre de leur position", () => {
    const groups = groupItemsByCategory([
        item("i1", fixes, "A", "desc"),
        item("i2", features, "B", "desc"),
    ])

    expect(groups.map((g) => g.category.id)).toEqual(["features", "fixes"])
})

test("un titre répété regroupe ses descriptions au lieu de se dupliquer", () => {
    const groups = groupItemsByCategory([
        item("i1", fixes, "CRM", "corrige X"),
        item("i2", fixes, "CRM", "corrige Y"),
        item("i3", fixes, "Stock", "corrige Z"),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].titleGroups).toHaveLength(2)
    expect(groups[0].titleGroups[0]).toEqual({
        title: "CRM",
        descriptions: ["corrige X", "corrige Y"],
    })
})

test("l'ordre des titres est celui de leur première apparition", () => {
    const groups = groupItemsByCategory([
        item("i1", fixes, "Zèbre", "d"),
        item("i2", fixes, "Alpha", "d"),
        item("i3", fixes, "Zèbre", "d2"),
    ])

    expect(groups[0].titleGroups.map((t) => t.title)).toEqual([
        "Zèbre",
        "Alpha",
    ])
})

test("countDescriptions ignore les descriptions nulles", () => {
    const groups = groupItemsByCategory([
        item("i1", fixes, "CRM", "corrige X"),
        item("i2", fixes, "CRM", null),
    ])

    expect(countDescriptions(groups[0].titleGroups)).toBe(1)
})

const version: ChangelogVersionWithItems = {
    id: "v1",
    version: "2.1.0",
    deployment_date: "2026-08-01T00:00:00.000Z",
    status: "published",
    summary: "Résumé de la version",
    created_by: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    items: [
        item("i1", fixes, "CRM", "corrige la fiche client"),
        item("i2", features, "Stock", null),
    ],
}

test("la recherche couvre le numéro, le résumé, les titres et les descriptions", () => {
    expect(versionMatchesSearch(version, "2.1")).toBe(true)
    expect(versionMatchesSearch(version, "résumé")).toBe(true)
    expect(versionMatchesSearch(version, "stock")).toBe(true)
    expect(versionMatchesSearch(version, "fiche client")).toBe(true)
    expect(versionMatchesSearch(version, "introuvable")).toBe(false)
})

test("filtrer par catégorie ne garde que les éléments concernés", () => {
    const filtered = filterVersionByCategory(version, "fixes")

    expect(filtered.items).toHaveLength(1)
    expect(filtered.items[0].category_id).toBe("fixes")
    // La version elle-même n'est pas altérée.
    expect(version.items).toHaveLength(2)
})

test("filtrer sans catégorie rend la version telle quelle", () => {
    expect(filterVersionByCategory(version, null)).toBe(version)
})
