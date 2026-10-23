import { beforeEach, expect, rstest, test } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const mocks = rstest.hoisted(() => {
    const select = rstest.fn()
    const selectProfiles = rstest.fn()
    const eq = rstest.fn()
    const single = rstest.fn()
    const order = rstest.fn()
    const or = rstest.fn()
    const insert = rstest.fn()
    const del = rstest.fn()
    const update = rstest.fn()

    // 1. Mock pour les CLIENTS (chaînable)
    const clientQuery: Record<string, unknown> = {
        order: rstest.fn(() => clientQuery),
        or: rstest.fn(() => clientQuery),
        eq: rstest.fn(() => clientQuery),
        range: rstest.fn(() => clientQuery),
        single: rstest.fn().mockResolvedValue({
            data: {
                id: "c3",
                brief: '{"budget":30}',
                customer: { id: "p1", user_id: "u1", full_name: "A" },
            },
            error: null,
        }),
        then: (resolve: (value: unknown) => unknown) =>
            resolve({
                data: [
                    {
                        id: "c1",
                        brief: '{"budget":10}',
                        customer: "u1",
                        closers: null,
                        updated_at: "2023-01-01",
                    },
                ],
                count: 1,
                error: null,
            }),
    }

    // 2. Mock pour les PROFILS (chaînable aussi !)
    const profileQuery: Record<string, unknown> = {
        order: rstest.fn(() => profileQuery),
        limit: rstest.fn(() => profileQuery),
        in: rstest.fn(() => profileQuery),
        then: (resolve: (value: unknown) => unknown) =>
            resolve({
                data: [{ id: "p1", user_id: "u1", full_name: "A" }],
                error: null,
            }),
    }

    const supabase = {
        from: rstest.fn((table: string) => {
            if (table === "profiles") {
                return { select: selectProfiles }
            }

            if (table === "Event_calendar") {
                return { delete: del }
            }

            return {
                select,
                eq,
                single,
                order,
                or,
                insert,
                delete: del,
                update,
            }
        }),
        channel: rstest.fn(() => ({
            on: rstest.fn().mockReturnThis(),
            subscribe: rstest.fn().mockReturnThis(),
        })),
        removeChannel: rstest.fn(),
    }

    // Configuration par défaut
    order.mockReturnValue(clientQuery)
    or.mockReturnValue(clientQuery)

    select.mockReturnValue(clientQuery)
    selectProfiles.mockReturnValue(profileQuery)

    eq.mockReturnValue({ single })
    single.mockResolvedValue({
        data: {
            id: "c2",
            brief: '{"budget":20}',
            customer: { id: "p1", user_id: "u1", full_name: "A" },
        },
        error: null,
    })

    insert.mockReturnValue({
        select: rstest.fn(() => ({
            single: rstest.fn().mockResolvedValue({
                data: {
                    id: "c3",
                    brief: '{"budget":30}',
                    customer: { id: "p1", user_id: "u1", full_name: "A" },
                },
                error: null,
            }),
        })),
    })

    update.mockReturnValue({
        eq: rstest.fn().mockResolvedValue({ error: null }),
    })
    del.mockReturnValue({ eq: rstest.fn().mockResolvedValue({ error: null }) })

    return { select, insert, single, supabase }
})

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: mocks.supabase,
}))

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    // Le nom `useAuth` doit correspondre au hook réellement mocké, on ne peut
    // pas le renommer sans casser le mock.
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix
    useAuth: () => ({ user: { user_id: "user-1", id: "user-1" } }),
}))

import { useClient } from "./use_client"

// useClient met la liste des commerciaux et les compteurs dans le cache
// TanStack : un client neuf par rendu pour isoler les tests.
const renderUseClient = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    return renderHook(() => useClient(), { wrapper })
}

type UseClientResult = ReturnType<typeof useClient>
type RenderedClient = { result: { current: UseClientResult } }

beforeEach(() => {
    // Clear call history only, preserve mockReturnValue from hoisted block
    mocks.select.mockClear()
    mocks.insert.mockClear()
    mocks.single.mockClear()
})

test("useClient create_fiche_client returns parsed client", async () => {
    let result!: RenderedClient["result"]
    await act(async () => {
        ;({ result } = renderUseClient())
    })

    let created: { id?: string; brief?: unknown } | null = null
    await act(async () => {
        created = await result.current.create_fiche_client({
            nom: "Client",
            societe: null,
            telephone: null,
            mail: null,
            siret: null,
            localisation: null,
            Note: "",
            brief: { budget: 30 },
        } as unknown as Parameters<
            UseClientResult["create_fiche_client"]
        >[0])
    })

    expect((created as { id?: string } | null)?.id).toBe("c3")
    expect((created as { brief?: unknown } | null)?.brief).toEqual({
        budget: 30,
    })
})

test("useClient fetch_research returns unique owners", async () => {
    let result!: RenderedClient["result"]
    await act(async () => {
        ;({ result } = renderUseClient())
    })

    let owners: Awaited<ReturnType<UseClientResult["fetch_research"]>> = []
    await act(async () => {
        owners = await result.current.fetch_research()
    })

    // Le mock renvoie 1 profil, fetch_research le transforme en Search object
    expect(owners).toHaveLength(1)
    expect(owners[0]?.user_id).toBe("u1")
    expect(owners[0]?.name).toBe("A") // Vérifie le mapping full_name -> name
})
