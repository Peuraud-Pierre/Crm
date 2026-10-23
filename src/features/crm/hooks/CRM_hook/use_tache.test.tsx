import { beforeEach, expect, rstest, test } from "@rstest/core"
import { act, renderHook, waitFor } from "@testing-library/react"

const mocks = rstest.hoisted(() => {
    const insert = rstest.fn()
    const select = rstest.fn()
    const single = rstest.fn()
    const update = rstest.fn()
    const eq = rstest.fn()
    const neq = rstest.fn()
    const order = rstest.fn()
    const limit = rstest.fn()
    const supabase = {
        from: rstest.fn(() => ({
            insert,
            select,
            update,
            eq,
        })),
        channel: rstest.fn(() => ({
            on: rstest.fn().mockReturnThis(),
            subscribe: rstest.fn().mockReturnThis(),
        })),
        removeChannel: rstest.fn(),
    }

    insert.mockReturnValue({ select })
    select.mockReturnValue({ single, eq, order })
    // Chaînes de lecture du service : `.eq().order().limit()` (mes tâches) et
    // `.eq().neq().order().limit()` (tâches assignées).
    eq.mockReturnValue({ order, neq })
    neq.mockReturnValue({ order })
    order.mockReturnValue({ limit })
    limit.mockResolvedValue({ data: [], error: null })
    single.mockResolvedValue({ data: { id: "t1" }, error: null })
    update.mockReturnValue({ eq })

    return { insert, select, single, update, eq, neq, order, limit, supabase }
})

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: mocks.supabase,
}))

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    // Le nom `useAuth` doit correspondre au hook réellement mocké, on ne peut
    // pas le renommer sans casser le mock.
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix
    useAuth: () => ({ user: { user_id: "user-1" } }),
}))

import { useTache } from "./use_tache"

beforeEach(() => {
    rstest.clearAllMocks()
})

test("create_Tache sends client id when provided object", async () => {
    let result!: { current: ReturnType<typeof useTache> }
    await act(async () => {
        ;({ result } = renderHook(() => useTache()))
    })

    await act(async () => {
        await result.current.create_Tache({
            type: "call",
            client: { id: "client-1", nom: "Client" },
            content: "Hello",
            date: null,
        })
    })

    expect(mocks.insert).toHaveBeenCalledWith([
        expect.objectContaining({ client: "client-1" }),
    ])
})

test("update_Tache maps client object to id", async () => {
    let result!: { current: ReturnType<typeof useTache> }
    await act(async () => {
        ;({ result } = renderHook(() => useTache()))
    })

    await waitFor(() => {
        expect(mocks.update).toBeDefined()
    })

    await act(async () => {
        await result.current.update_Tache("t1", {
            client: { id: "client-2", nom: "Other" },
        })
    })

    expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({ client: "client-2" })
    )
})
