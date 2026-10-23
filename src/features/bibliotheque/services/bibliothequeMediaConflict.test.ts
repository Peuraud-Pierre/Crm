// ── bibliothequeMediaConflict.test.ts ─────────────────────────────────────────
// Tests unitaires du garde-fou d'atomicité en base (services/bibliothequeMediaConflict.ts),
// extrait de bibliothequeMediaService.ts (qui approchait à nouveau 400 lignes —
// voir Architecture_Feature.pdf §15). Voir 20260720130000_bibliotheque_thematiques_media_unique.sql
// pour le contexte complet (index UNIQUE partiels, non-atomicité du pré-check
// SELECT de resolveAvailableSlug).
//
// Stratégie de mock : identique à bibliothequeMediaService.test.ts — `db` (via
// services/db.ts) et `supabase.storage` sont mockés en interceptant le module
// "@/integrations/supabase/client". `chainable(result)` simule le
// query-builder Supabase (thenable, chaînage de méthodes).

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"

const mocks = rstest.hoisted(() => {
    const fromResults: unknown[] = []
    const from = rstest.fn(() => {
        const result = fromResults.shift() ?? { data: null, error: null }
        return chainable(result)
    })

    const storageMove = rstest.fn()
    const storageFrom = rstest.fn(() => ({
        move: storageMove,
    }))

    function chainable(result: unknown): PromiseLike<unknown> & Record<string, unknown> {
        const obj: Record<string, unknown> = {
            then: (resolve: (v: unknown) => unknown) => resolve(result),
        }
        const handler = () => obj
        for (const method of ["select", "eq", "neq", "in", "order", "limit", "single", "insert", "update", "delete", "upsert"]) {
            obj[method] = handler
        }
        return obj as PromiseLike<unknown> & Record<string, unknown>
    }

    return { from, fromResults, storageMove, storageFrom, chainable }
})

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: mocks.from,
        storage: { from: mocks.storageFrom },
    },
}))

import * as media from "./bibliothequeMediaConflict"
import { BibliothequeServiceError } from "./errors"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.fromResults.length = 0
})

// ── detectMediaConflict (garde-fou atomique — index UNIQUE en base) ──────────
// Le SELECT de resolveAvailableSlug est un pré-check non-atomique, en
// particulier pour un renommage (Storage.move n'a pas d'équivalent à
// upsert: false). Le vrai verrou est l'index UNIQUE partiel en base — ces
// tests vérifient que l'erreur Postgres 23505 qu'il produit est correctement
// reconnue et attribuée au bon champ (image_url vs icon_url).

describe("detectMediaConflict", () => {
    test("reconnaît une violation d'unicité sur image_url via `details`", () => {
        const err = { code: "23505", details: "Key (image_url)=(livraison.png) already exists." }
        expect(media.detectMediaConflict(err)).toEqual({ field: "image" })
    })

    test("reconnaît une violation d'unicité sur icon_url via `details`", () => {
        const err = { code: "23505", details: "Key (icon_url)=(icons/livraison.svg) already exists." }
        expect(media.detectMediaConflict(err)).toEqual({ field: "icon" })
    })

    test("retombe sur `message` si `details` est absent", () => {
        const err = { code: "23505", message: 'duplicate key value violates unique constraint "bibliotheque_thematiques_image_url_uidx" — (image_url)' }
        expect(media.detectMediaConflict(err)).toEqual({ field: "image" })
    })

    test("retourne null pour un code d'erreur différent de 23505 (pas une violation d'unicité)", () => {
        expect(media.detectMediaConflict({ code: "23503", details: "(image_url)" })).toBeNull()
    })

    test("retourne null si le code est 23505 mais ne concerne ni image_url ni icon_url", () => {
        expect(media.detectMediaConflict({ code: "23505", details: "Key (id)=(x) already exists." })).toBeNull()
    })

    test("retourne null pour une valeur non-erreur (undefined, string...)", () => {
        expect(media.detectMediaConflict(undefined)).toBeNull()
        expect(media.detectMediaConflict(null)).toBeNull()
        expect(media.detectMediaConflict("boom")).toBeNull()
    })

    test("déballe une BibliothequeServiceError (insertThematique/patchThematique lèvent désormais ce type) avant d'inspecter code/details", () => {
        const rawConflict = { code: "23505", details: "Key (image_url)=(livraison.png) already exists." }
        const wrapped = new BibliothequeServiceError("insertThematique", rawConflict)
        expect(media.detectMediaConflict(wrapped)).toEqual({ field: "image" })
    })
})

// ── relocateThematiqueMedia (déplacement du fichier déjà téléversé) ──────────

describe("relocateThematiqueMedia", () => {
    test("déplace le fichier vers slug-attempt si ce chemin est libre", async () => {
        mocks.fromResults.push({ data: [], error: null }) // findTakenPaths(livraison-3..10.png) → toutes libres
        mocks.storageMove.mockResolvedValue({ data: {}, error: null })

        const newPath = await media.relocateThematiqueMedia("livraison.png", "Livraison", undefined, "image", 3)

        expect(newPath).toBe("livraison-3.png")
        expect(mocks.storageMove).toHaveBeenCalledWith("livraison.png", "livraison-3.png")
    })

    test("avance au numéro suivant si slug-attempt est déjà pris par une AUTRE thématique", async () => {
        // Une seule requête batchée vérifie livraison-3.png..livraison-10.png
        // d'un coup ; seul livraison-3.png revient comme pris.
        mocks.fromResults.push({ data: [{ image_url: "livraison-3.png" }], error: null })
        mocks.storageMove.mockResolvedValue({ data: {}, error: null })

        const newPath = await media.relocateThematiqueMedia("livraison.png", "Livraison", undefined, "image", 3)

        expect(newPath).toBe("livraison-4.png")
        expect(mocks.from).toHaveBeenCalledTimes(1)
    })

    test("préfixe icons/ et force .svg pour une icône", async () => {
        mocks.fromResults.push({ data: [], error: null })
        mocks.storageMove.mockResolvedValue({ data: {}, error: null })

        const newPath = await media.relocateThematiqueMedia("icons/livraison.svg", "Livraison", "t1", "icon", 2)

        expect(newPath).toBe("icons/livraison-2.svg")
        expect(mocks.storageMove).toHaveBeenCalledWith("icons/livraison.svg", "icons/livraison-2.svg")
    })

    test("propage l'erreur si le déplacement Storage échoue (pas best-effort ici — l'appelant doit savoir que la retry a échoué)", async () => {
        mocks.fromResults.push({ data: [], error: null })
        mocks.storageMove.mockResolvedValue({ data: null, error: new Error("move failed") })

        await expect(
            media.relocateThematiqueMedia("livraison.png", "Livraison", undefined, "image", 2)
        ).rejects.toThrow("move failed")
    })
})
