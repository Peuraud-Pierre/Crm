import { expect, rstest, test } from "@rstest/core"
import { act, renderHook, waitFor } from "@testing-library/react"

const mocks = rstest.hoisted(() => ({ fetchCount: rstest.fn() }))

rstest.mock("@/features/client-newsletter/services/clientNewsletterService", () => ({
    fetchRecipientCount: mocks.fetchCount,
}))

import { useNewsletterRecipientCount } from "./useNewsletterRecipientCount"

test("échec du comptage : erreur exposée, plus de chargement", async () => {
    mocks.fetchCount.mockRejectedValue(new Error("Failed to fetch"))
    const { result } = renderHook(() => useNewsletterRecipientCount())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.count).toBeNull()
    expect(result.current.error).toBe("Impossible de compter les destinataires.")

    mocks.fetchCount.mockResolvedValue(7)
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.count).toBe(7))
    expect(result.current.error).toBeNull()
})
