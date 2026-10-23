import { beforeEach, expect, rstest, test } from "@rstest/core"
import { LAYOUT_VERSION } from "../constants"
import type { DashboardLayout } from "../types/layout.types"

/**
 * La couche service du dashboard.
 *
 * Deux choses à vérifier, et une seule est du ressort de ces tests.
 *
 * La première : **une erreur Supabase doit remonter**, jamais être
 * avalée. Le hook l'entoure d'un `try/catch` avec repli et notification,
 * mais ce repli ne sert à rien si le service renvoie tranquillement une
 * liste vide sur un échec — l'utilisateur verrait « aucun gabarit » là où
 * la requête a échoué. C'est le scénario qui avait déjà mordu ailleurs
 * dans ce dépôt (une erreur PostgREST rendue comme un état vide).
 *
 * La seconde : les requêtes doivent viser les bonnes lignes. Un filtre
 * oublié sur `user_id` ne se voit pas en développement, où la RLS couvre
 * la faute.
 *
 * Le client Supabase est simulé par un constructeur de requête qui note
 * ce qu'on lui demande, et rend ce qu'on lui a dit de rendre.
 */

interface Recorded {
    table: string
    op: string
    calls: [string, unknown[]][]
}

const mocks = rstest.hoisted(() => ({
    /** Ce que la prochaine requête doit renvoyer. */
    result: { data: null as unknown, error: null as unknown },
    /** Trace de la dernière requête construite. */
    recorded: null as Recorded | null,
}))

rstest.mock("@/integrations/supabase/client", () => {
    /**
     * Le client de production enchaîne `.from().select().eq().maybeSingle()`
     * : chaque maillon rend le suivant. Le double note l'appel et se rend
     * lui-même, puis se résout comme une promesse sur le résultat armé —
     * ce qui couvre aussi bien les chaînes terminées par `await` que
     * celles terminées par `.maybeSingle()`.
     */
    function makeQuery(table: string): Record<string, unknown> {
        const recorded: Recorded = { table, op: "", calls: [] }
        mocks.recorded = recorded

        const proxy: Record<string, unknown> = new Proxy(
            {},
            {
                get(_target, prop: string) {
                    // Terminer la chaîne : `await query` la résout.
                    if (prop === "then") {
                        return (resolve: (v: unknown) => unknown) =>
                            Promise.resolve(mocks.result).then(resolve)
                    }

                    return (...args: unknown[]) => {
                        recorded.calls.push([prop, args])
                        // Le premier maillon après `from` est l'opération.
                        if (recorded.op === "") recorded.op = prop
                        return proxy
                    }
                },
            }
        )

        return proxy
    }

    return { supabase: { from: makeQuery } }
})

import {
    deleteTemplate,
    deleteUserLayout,
    fetchAllTemplates,
    fetchTemplatesFor,
    fetchUserLayout,
    saveUserLayout,
} from "./dashboardLayoutService"

const LAYOUT: DashboardLayout = {
    version: LAYOUT_VERSION,
    items: [],
    bands: { announcements: true },
    density: "comfortable",
}

/** Arme la réponse de la prochaine requête. */
function resolves(data: unknown) {
    mocks.result = { data, error: null }
}

/** Arme un échec Supabase. */
function fails(message = "PGRST000") {
    mocks.result = { data: null, error: { message } }
}

/** Les arguments du premier appel à `method` sur la dernière requête. */
function argsOf(method: string): unknown[] | undefined {
    return mocks.recorded?.calls.find(([name]: [string, unknown[]]) => name === method)?.[1]
}

beforeEach(() => {
    mocks.recorded = null
    resolves(null)
})

/* ── Lecture de la disposition personnelle ───────────────────────── */

test("la disposition personnelle est lue sur la ligne de l'utilisateur", () => {
    resolves({ layout: LAYOUT })
    void fetchUserLayout("u1")

    expect(mocks.recorded?.table).toBe("user_dashboard_layout")
    expect(argsOf("eq")).toEqual(["user_id", "u1"])
})

test("l'absence de ligne est un état valide, pas une erreur", async () => {
    // Quelqu'un qui n'a jamais personnalisé sa page suit le gabarit de son
    // rôle : `null` est la réponse normale, pas un échec.
    resolves(null)

    await expect(fetchUserLayout("u1")).resolves.toBe(null)
})

test("un échec de lecture remonte au lieu de passer pour une page vierge", async () => {
    // Le piège : renvoyer `null` sur erreur ferait croire au hook que
    // l'utilisateur n'a pas de disposition, et écraserait sa vraie page
    // par le gabarit du rôle au premier geste.
    fails()

    await expect(fetchUserLayout("u1")).rejects.toBeDefined()
})

/* ── Écriture ────────────────────────────────────────────────────── */

test("enregistrer écrit sur la clé de l'utilisateur, en upsert", async () => {
    resolves(null)
    await saveUserLayout("u1", LAYOUT)

    expect(mocks.recorded?.table).toBe("user_dashboard_layout")
    const [row, options] = argsOf("upsert") ?? []
    expect(row).toMatchObject({ user_id: "u1" })
    // Sans `onConflict`, une seconde écriture violerait la clé primaire
    // au lieu de remplacer la disposition.
    expect(options).toEqual({ onConflict: "user_id" })
})

test("un échec d'écriture remonte", async () => {
    fails()

    await expect(saveUserLayout("u1", LAYOUT)).rejects.toBeDefined()
})

test("réinitialiser supprime la seule ligne de l'utilisateur", async () => {
    resolves(null)
    await deleteUserLayout("u1")

    expect(mocks.recorded?.op).toBe("delete")
    // Le filtre compte : sans lui, la requête effacerait la table entière
    // pour peu que la RLS soit permissive.
    expect(argsOf("eq")).toEqual(["user_id", "u1"])
})

/* ── Gabarits ────────────────────────────────────────────────────── */

test("sans rôle ni service, aucune requête n'est émise", async () => {
    // Interroger la table avec un filtre vide ramènerait tous les
    // gabarits de l'organisation pour n'en utiliser aucun.
    const result = await fetchTemplatesFor(null, null)

    expect(result).toEqual([])
    expect(mocks.recorded).toBe(null)
})

test("les deux gabarits applicables sont demandés en une requête", async () => {
    resolves([])
    await fetchTemplatesFor("role-1", "svc-1")

    expect(mocks.recorded?.table).toBe("dashboard_layout_templates")
    expect(argsOf("or")).toEqual(["role_id.eq.role-1,service_id.eq.svc-1"])
})

test("avec un rôle seul, le filtre ne porte que sur lui", async () => {
    resolves([])
    await fetchTemplatesFor("role-1", null)

    expect(argsOf("or")).toEqual(["role_id.eq.role-1"])
})

test("une table de gabarits vide donne une liste vide", async () => {
    resolves(null)

    await expect(fetchAllTemplates()).resolves.toEqual([])
})

test("un échec de lecture des gabarits remonte", async () => {
    fails()

    await expect(fetchTemplatesFor("role-1", null)).rejects.toBeDefined()
    fails()
    await expect(fetchAllTemplates()).rejects.toBeDefined()
})

test("supprimer un gabarit cible son identifiant", async () => {
    resolves(null)
    await deleteTemplate("tpl-1")

    expect(mocks.recorded?.op).toBe("delete")
    expect(argsOf("eq")).toEqual(["id", "tpl-1"])
})

test("un échec de suppression remonte", async () => {
    fails()

    await expect(deleteTemplate("tpl-1")).rejects.toBeDefined()
})
