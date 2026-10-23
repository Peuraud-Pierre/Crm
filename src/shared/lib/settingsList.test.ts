import { expect, test } from "@rstest/core"
import { applySelection, parseList, serializeList } from "./settingsList"

test("une valeur absente ou vide donne une liste vide", () => {
    expect(parseList(undefined)).toEqual([])
    expect(parseList("")).toEqual([])
    expect(parseList("   ")).toEqual([])
})

test("une valeur non textuelle est ignorée", () => {
    // Le JSON vient de la base : il a pu être écrit par une version
    // antérieure du module.
    expect(parseList(42)).toEqual([])
    expect(parseList(null)).toEqual([])
    expect(parseList(true)).toEqual([])
})

test("l'ordre de saisie est conservé et les doublons écartés", () => {
    expect(parseList("stock, crm ,stock,projects")).toEqual([
        "stock",
        "crm",
        "projects",
    ])
})

test("serializeList est stable par aller-retour", () => {
    expect(serializeList(parseList("stock,crm"))).toBe("stock,crm")
    expect(serializeList(["a", "", "  ", "a", "b"])).toBe("a,b")
})

test("une sélection vide laisse tout, dans l'ordre d'origine", () => {
    const items = [{ id: "a" }, { id: "b" }]
    expect(applySelection(items, [], (i) => i.id)).toBe(items)
})

test("la sélection impose son ordre", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }]
    expect(applySelection(items, ["c", "a"], (i) => i.id)).toEqual([
        { id: "c" },
        { id: "a" },
    ])
})

test("une clé qui ne correspond à rien est ignorée en silence", () => {
    // Cas réel : un raccourci dont la permission a été retirée.
    const items = [{ id: "a" }]
    expect(applySelection(items, ["disparu", "a"], (i) => i.id)).toEqual([
        { id: "a" },
    ])
})
