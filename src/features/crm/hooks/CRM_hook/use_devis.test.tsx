import { afterEach, beforeEach, expect, rstest, test } from "@rstest/core"
import { renderHook } from "@testing-library/react"

const mocks = rstest.hoisted(() => {
    const insert = rstest.fn()
    const select = rstest.fn()
    const single = rstest.fn()
    const channel = {
        on: rstest.fn().mockReturnThis(),
        subscribe: rstest.fn().mockReturnThis(),
    }
    const from = rstest.fn(() => ({
        insert,
        select,
        single,
    }))
    const supabase = {
        from,
        channel: rstest.fn(() => channel),
        removeChannel: rstest.fn(),
    }

    insert.mockReturnValue({ select })
    select.mockReturnValue({ single })
    // On simule une erreur ici
    single.mockResolvedValue({ data: null, error: new Error("fail") })

    return { insert, select, single, supabase }
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

import { useDevis } from "./use_devis"

type UseDevisResult = ReturnType<typeof useDevis>

const originalConsoleError = console.error

beforeEach(() => {
    rstest.clearAllMocks()
    // On masque les erreurs console pour ne pas polluer les logs du test
    console.error = () => {}
})

afterEach(() => {
    console.error = originalConsoleError
})

test("Register_devis rolls back temp on error", async () => {
    const { result } = renderHook(() => useDevis())

    try {
        await result.current.Register_devis({
            name: "Devis A",
            client: "c1",
            Tableau: [],
        } as unknown as Parameters<UseDevisResult["Register_devis"]>[0])
    } catch {
        // L'erreur est attendue (simulée par le mock).
        // On l'attrape pour permettre au test de continuer et vérifier l'état.
    }

    // Vérification : l'ajout optimiste aurait dû être annulé (rollback)
    expect(result.current.Devis).toHaveLength(0)
})
