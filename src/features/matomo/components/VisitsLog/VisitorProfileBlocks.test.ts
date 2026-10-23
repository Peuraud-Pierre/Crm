// Vérifie que buildEnvironmentRows suit la forme réelle de Live.getVisitorProfile :
// chaque dimension dans son propre tableau, aucun champ os/browser sur `devices`.
// Régression visée : « Smartphone — undefined — undefined ».

import { describe, expect, test } from "@rstest/core"
import { buildEnvironmentRows } from "./VisitorProfileBlocks"

describe("buildEnvironmentRows", () => {
    test("n'invente pas d'OS ni de navigateur depuis une entrée devices", () => {
        const rows = buildEnvironmentRows({
            devices: [{ type: "Smartphone" }],
        })
        expect(rows).toHaveLength(1)
        expect(rows[0].text).toBe("Smartphone")
        expect(rows[0].text).not.toContain("undefined")
    })

    test("agrège les trois dimensions dans l'ordre", () => {
        const rows = buildEnvironmentRows({
            devices: [{ type: "Smartphone" }],
            operatingSystems: [{ prettyName: "Android", version: "13" }],
            browsers: [{ prettyName: "Chrome" }],
        })
        expect(rows.map((r) => r.text)).toEqual([
            "Smartphone",
            "Android (13)",
            "Chrome",
        ])
    })

    test("omet la parenthèse quand la version manque et ignore les entrées vides", () => {
        const rows = buildEnvironmentRows({
            devices: [{}],
            browsers: [{ prettyName: "Firefox" }],
        })
        expect(rows.map((r) => r.text)).toEqual(["Firefox"])
    })

    test("tolère un profil absent ou des dimensions manquantes", () => {
        expect(buildEnvironmentRows(null)).toEqual([])
        expect(buildEnvironmentRows({})).toEqual([])
    })

    test("produit des clés uniques même sur des valeurs répétées", () => {
        const rows = buildEnvironmentRows({
            devices: [{ type: "Desktop" }, { type: "Desktop" }],
        })
        expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length)
    })
})
