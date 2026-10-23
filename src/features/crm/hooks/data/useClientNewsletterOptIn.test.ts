import { beforeEach, expect, rstest, test } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"
import type { Client } from "@/features/crm/types/client"

const mocks = rstest.hoisted(() => ({
    update: rstest.fn(),
}))

rstest.mock("@/features/crm/services/clientService", () => ({
    updateClientNewsletter: mocks.update,
}))
rstest.mock("sonner", () => ({
    toast: { success: rstest.fn(), error: rstest.fn() },
}))

import { useClientNewsletterOptIn } from "./useClientNewsletterOptIn"

const client = (over: Partial<Client>): Client =>
    ({ id: "A", mail: "a@x.fr", newsletter: false, newsletter_updated_at: null, ...over }) as Client

function deferred<T>() {
    let resolve!: (v: T) => void
    let reject!: (e: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

beforeEach(() => {
    mocks.update.mockReset()
})

test("ligne légère sans `newsletter` : état inconnu, pas prêt", () => {
    const light = { id: "A", mail: "a@x.fr" } as Client
    const { result, rerender } = renderHook(({ c }) => useClientNewsletterOptIn(c), {
        initialProps: { c: light },
    })
    expect(result.current.ready).toBe(false)

    rerender({ c: client({ newsletter: true }) })
    expect(result.current.ready).toBe(true)
    expect(result.current.checked).toBe(true)
})

test("échec d'une requête de A après passage à B : B n'est pas modifié", async () => {
    const d = deferred<string>()
    mocks.update.mockReturnValue(d.promise)
    const { result, rerender } = renderHook(({ c }) => useClientNewsletterOptIn(c), {
        initialProps: { c: client({ id: "A", newsletter: false }) },
    })

    let pending!: Promise<void>
    act(() => {
        pending = result.current.toggle(true)
    })
    rerender({ c: client({ id: "B", newsletter: true, newsletter_updated_at: "2026-01-01T00:00:00Z" }) })

    await act(async () => {
        d.reject(new Error("refusé"))
        await pending
    })

    expect(mocks.update).toHaveBeenCalledWith("A", true)
    expect(result.current.checked).toBe(true)
    expect(result.current.updatedAt).toBe("2026-01-01T00:00:00Z")
    expect(result.current.saving).toBe(false)
})

test("succès d'une requête de A après passage à B : la date de A ne s'affiche pas sur B", async () => {
    const d = deferred<string>()
    mocks.update.mockReturnValue(d.promise)
    const { result, rerender } = renderHook(({ c }) => useClientNewsletterOptIn(c), {
        initialProps: { c: client({ id: "A" }) },
    })

    let pending!: Promise<void>
    act(() => {
        pending = result.current.toggle(true)
    })
    rerender({ c: client({ id: "B", newsletter_updated_at: null }) })

    await act(async () => {
        d.resolve("2026-10-14T10:00:00Z")
        await pending
    })

    expect(result.current.updatedAt).toBeNull()
    expect(result.current.checked).toBe(false)
})

test("échec sur le même client : rollback", async () => {
    mocks.update.mockRejectedValue(new Error("refusé"))
    const { result } = renderHook(() => useClientNewsletterOptIn(client({ newsletter: false })))

    await act(async () => {
        await result.current.toggle(true)
    })

    expect(result.current.checked).toBe(false)
})
