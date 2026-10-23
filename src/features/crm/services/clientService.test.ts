import { beforeEach, expect, rstest, test } from "@rstest/core"

const mocks = rstest.hoisted(() => {
    const selects: string[] = []
    // Réponses servies dans l'ordre des appels ; la dernière est répétée.
    let responses: { data: unknown; error: { code: string } | null }[] = []

    const from = rstest.fn(() => {
        const builder: Record<string, unknown> = {}
        for (const m of ["order", "range", "or", "eq", "limit", "lt", "update"]) {
            builder[m] = rstest.fn(() => builder)
        }
        builder.select = rstest.fn((select: string) => {
            selects.push(select)
            return builder
        })
        builder.then = (resolve: (v: unknown) => void) =>
            resolve(responses[Math.min(selects.length - 1, responses.length - 1)])
        return builder
    })

    return {
        from,
        selects,
        setResponses: (r: typeof responses) => {
            responses = r
        },
    }
})

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: { from: mocks.from },
}))

const OK = { data: [], error: null }
const MISSING_COLUMN = {
    data: null,
    error: { code: "42703", message: "column client_crm.urgency does not exist" },
}

const listPageArgs = {
    withCount: false,
    offset: 0,
    limit: 20,
    orFilters: [],
}

beforeEach(() => {
    mocks.selects.length = 0
})

/**
 * Le front est déployé avant la migration 008 : la colonne `urgency` n'existe
 * pas encore et PostgREST rejette la requête entière. Sans repli, le board
 * n'affiche plus aucun client.
 */
test("rejoue sans urgency quand la colonne n'existe pas encore", async () => {
    const { fetchClientListPage } = await import("./clientService")
    mocks.setResponses([MISSING_COLUMN, OK])

    const res = await fetchClientListPage(listPageArgs)

    expect(res.error).toBe(null)
    expect(mocks.selects).toHaveLength(2)
    expect(mocks.selects[0]).toContain("urgency")
    expect(mocks.selects[1]).not.toContain("urgency")
})

/**
 * Le repli est mémorisé : rejouer deux requêtes à chaque page coûterait un
 * aller-retour par scroll de colonne Kanban.
 */
test("mémorise le repli pour les requêtes suivantes", async () => {
    const { fetchClientColumnPage } = await import("./clientService")
    mocks.setResponses([OK])

    await fetchClientColumnPage({ colIndex: 0, limit: 20 })

    expect(mocks.selects).toHaveLength(1)
    expect(mocks.selects[0]).not.toContain("urgency")
})

test("updateClientNewsletter : 0 ligne modifiée ⇒ erreur (RLS silencieuse)", async () => {
    const { updateClientNewsletter } = await import("./clientService")
    mocks.setResponses([{ data: [], error: null }])

    await expect(updateClientNewsletter("c1", true)).rejects.toThrow(
        "Mise à jour refusée"
    )
})

test("updateClientNewsletter renvoie la date de bascule", async () => {
    const { updateClientNewsletter } = await import("./clientService")
    mocks.setResponses([
        {
            data: [{ id: "c1", newsletter_updated_at: "2026-10-14T10:00:00Z" }],
            error: null,
        },
    ])

    await expect(updateClientNewsletter("c1", true)).resolves.toBe(
        "2026-10-14T10:00:00Z"
    )
})
