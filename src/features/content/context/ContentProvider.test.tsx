import { beforeEach, expect, rstest, test } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"
import React from "react"
import { MemoryRouter } from "react-router"

import { ContentProvider, useContent } from "./ContentProvider"

const mocks = rstest.hoisted(() => ({
    toastError: rstest.fn(),
    toastSuccess: rstest.fn(),
    navigate: rstest.fn(),
    fetch: rstest.fn(),
}))

rstest.mock("sonner", () => ({
    toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: rstest.fn(() => ({})),
        auth: { getUser: rstest.fn() },
        storage: { from: rstest.fn() },
        channel: rstest.fn(() => ({ on: rstest.fn().mockReturnThis(), subscribe: rstest.fn() })),
        removeChannel: rstest.fn(),
    },
}))

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    // Mock du hook réel useAuth : doit garder le préfixe "use".
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix
    useAuth: () => ({
        user: { user_id: "user-1" },
    }),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
        <ContentProvider>{children}</ContentProvider>
    </MemoryRouter>
)

beforeEach(() => {
    rstest.clearAllMocks()
    global.fetch = mocks.fetch as typeof fetch
})

test("updateField decorChoice updates decor label", () => {
    const { result } = renderHook(() => useContent(), { wrapper })

    act(() => {
        result.current.updateField("decorChoice", "studio_photo")
    })

    expect(result.current.formData.decorChoice).toBe("studio_photo")
    expect(result.current.formData.decor).toBe("Studio photo")
})

test("handleSend appId 1 warns when no files", async () => {
    const { result } = renderHook(() => useContent(), { wrapper })

    await act(async () => {
        await result.current.handleSend(1)
    })

    expect(mocks.toastError).toHaveBeenCalledWith(
        "Erreur",
        expect.objectContaining({
            description: "Veuillez sélectionner une image",
        })
    )
})

test("removeFile removes the selected file", () => {
    const { result } = renderHook(() => useContent(), { wrapper })
    const file = new File(["data"], "image.png", { type: "image/png" })

    act(() => {
        result.current.setSelectedFiles([file])
    })

    act(() => {
        result.current.removeFile(0)
    })

    expect(result.current.selectedFiles).toHaveLength(0)
})

test("resetForm clears files and html result", () => {
    const { result } = renderHook(() => useContent(), { wrapper })

    act(() => {
        result.current.setSelectedFiles([
            new File(["data"], "image.png", { type: "image/png" }),
        ])
        result.current.setHtmlResult("<div>ok</div>")
    })

    act(() => {
        result.current.resetForm()
    })

    expect(result.current.selectedFiles).toHaveLength(0)
    expect(result.current.htmlResult).toBeNull()
})
