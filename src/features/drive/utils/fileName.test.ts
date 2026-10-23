import { expect, test } from "@rstest/core"
import { splitFileName } from "./fileName"

test("splitFileName : extension isolée du radical", () => {
    expect(splitFileName("rapport.pdf")).toEqual({
        base: "rapport",
        ext: ".pdf",
    })
    expect(splitFileName("photo de vacances.JPEG")).toEqual({
        base: "photo de vacances",
        ext: ".JPEG",
    })
})

// Un dossier n'a pas d'extension, même si son nom contient un point.
test("splitFileName : un dossier garde son nom entier", () => {
    expect(splitFileName("Archives 2026", true)).toEqual({
        base: "Archives 2026",
        ext: "",
    })
    expect(splitFileName("v1.2", true)).toEqual({ base: "v1.2", ext: "" })
})

// Le point initial d'un fichier caché fait partie du nom : le traiter comme
// une extension laisserait un champ de saisie vide.
test("splitFileName : fichier caché sans suffixe", () => {
    expect(splitFileName(".env")).toEqual({ base: ".env", ext: "" })
    expect(splitFileName(".gitignore")).toEqual({
        base: ".gitignore",
        ext: "",
    })
})

test("splitFileName : sans point, ou point final", () => {
    expect(splitFileName("notes")).toEqual({ base: "notes", ext: "" })
    expect(splitFileName("sauvegarde.")).toEqual({
        base: "sauvegarde.",
        ext: "",
    })
    expect(splitFileName("")).toEqual({ base: "", ext: "" })
})

// Un fichier caché AVEC extension garde bien son suffixe protégé.
test("splitFileName : fichier caché avec extension", () => {
    expect(splitFileName(".env.local")).toEqual({
        base: ".env",
        ext: ".local",
    })
})

// Extension composée : seul le dernier segment est protégé, ce qui suffit —
// le radical proposé contient le reste et reste modifiable.
test("splitFileName : extension composée, dernier segment seulement", () => {
    expect(splitFileName("archive.tar.gz")).toEqual({
        base: "archive.tar",
        ext: ".gz",
    })
})
