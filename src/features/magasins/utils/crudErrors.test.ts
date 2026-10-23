import { expect, test } from "@rstest/core"
import { magasinErrorMessage } from "./crudErrors"

test("magasinErrorMessage traduit les codes PostgREST", () => {
    expect(magasinErrorMessage("de la zone", "create", { code: "23505" })).toMatch(/déjà utilisé/)
    expect(magasinErrorMessage("de la zone", "update", { code: "P0001", message: "Un rayon doit être rattaché à une zone" }))
        .toBe("Un rayon doit être rattaché à une zone")
    expect(magasinErrorMessage("de la zone", "create", { code: "P0001", message: "Une étagère doit être rattachée à une zone ou à un rayon" }))
        .toBe("Un portant doit être rattaché à une zone ou à un rayon")
    expect(magasinErrorMessage("du magasin", "delete", { code: "42501" })).toBe(
        "Vous n'avez pas le droit d'effectuer la suppression du magasin.",
    )
    expect(magasinErrorMessage("du magasin", "create", new Error("x"))).toMatch(/Réessayez/)
    // Type d'équipement que la base ne connaît pas encore : migration manquante.
    expect(
        magasinErrorMessage("de l'équipement", "create", {
            code: "23514",
            message: 'new row for relation "equipements_magasin" violates check constraint "equipements_magasin_kind_valid"',
        }),
    ).toMatch(/appliquez la dernière migration/)
    expect(magasinErrorMessage("de la zone", "create", { code: "23514", message: "violates check constraint \"zones_magasin_width_positive\"" })).toMatch(
        /vérifiez le code et les dimensions/,
    )
})

test("une base pas à jour est annoncée comme telle, pas comme une erreur à réessayer", () => {
    // Trigger des étages d'avant le correctif : aucun équipement ne se crée.
    const bug = { code: "42703", message: 'record "new" has no field "parent_id"' }
    // Table ou colonne absente du cache de l'API (migration non passée).
    const table = { code: "PGRST205", message: "Could not find the table 'public.murs_magasin' in the schema cache" }
    const colonne = { code: "PGRST204", message: "Could not find the 'forme' column of 'equipements_magasin' in the schema cache" }
    for (const err of [bug, table, colonne]) {
        expect(magasinErrorMessage("de l'équipement", "create", err)).toMatch(/base de données n'est pas à jour/)
    }
})

