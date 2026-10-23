import { beforeEach, expect, rstest, test } from "@rstest/core"

const mocks = rstest.hoisted(() => {
    let response: { data: unknown; error: { message: string } | null } = {
        data: [],
        error: null,
    }
    const order = rstest.fn(() => builderPromise)
    const select = rstest.fn(() => ({ order }))
    const from = rstest.fn(() => ({ select }))
    const builderPromise = {
        then: (resolve: (v: unknown) => void) => resolve(response),
    }
    return {
        from,
        select,
        order,
        setResponse: (r: typeof response) => {
            response = r
        },
    }
})

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: { from: mocks.from },
}))

beforeEach(() => {
    mocks.from.mockClear()
    mocks.select.mockClear()
    mocks.order.mockClear()
})

test("mappe snapshot_month/product_name/total_entries vers month/product/total, triés par mois", async () => {
    const { listProduitRechercheMonthlyStats } = await import(
        "./produitRechercheMonthlyStatsService"
    )
    mocks.setResponse({
        data: [
            {
                snapshot_month: "2026-08-01",
                product_name: "Sweat",
                total_entries: 5,
            },
            {
                snapshot_month: "2026-09-01",
                product_name: "Jeans",
                total_entries: 3,
            },
        ],
        error: null,
    })

    const result = await listProduitRechercheMonthlyStats()

    expect(mocks.from).toHaveBeenCalledWith(
        "crm_produit_recherche_monthly_stats"
    )
    expect(mocks.select).toHaveBeenCalledWith(
        "snapshot_month, product_name, total_entries"
    )
    expect(mocks.order).toHaveBeenCalledWith("snapshot_month", {
        ascending: true,
    })
    expect(result).toEqual([
        { month: "2026-08-01", product: "Sweat", total: 5 },
        { month: "2026-09-01", product: "Jeans", total: 3 },
    ])
})

test("propage l'erreur Supabase", async () => {
    const { listProduitRechercheMonthlyStats } = await import(
        "./produitRechercheMonthlyStatsService"
    )
    mocks.setResponse({ data: null, error: { message: "boom" } })

    await expect(listProduitRechercheMonthlyStats()).rejects.toEqual({
        message: "boom",
    })
})
