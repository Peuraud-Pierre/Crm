import { renderHook } from "@testing-library/react"
import { expect, rstest, test } from "@rstest/core"

const mocks = rstest.hoisted(() => ({
    useShare: rstest.fn(),
}))

rstest.mock("@/features/drive/hooks/useShare", () => ({
    useShare: (args: { baseUrl: string }) => mocks.useShare(args),
}))

import { ShareProvider, useShareCtx } from "./ShareProvider"

test("ShareProvider exposes useShare value", () => {
    // Le contexte expose la valeur retournée par useShare (ReturnType<typeof
    // useShare>, qui n'a pas de propriété baseUrl) — on vérifie qu'elle est
    // bien transmise telle quelle et que baseUrl est passé au hook.
    mocks.useShare.mockReturnValue({
        shareOpen: true,
    })

    const { result } = renderHook(() => useShareCtx(), {
        wrapper: ({ children }) => (
            <ShareProvider baseUrl="https://api">{children}</ShareProvider>
        ),
    })

    expect(result.current.shareOpen).toBe(true)
    expect(mocks.useShare).toHaveBeenCalledWith({ baseUrl: "https://api" })
})

test("useShareCtx throws outside provider", () => {
    expect(() => renderHook(() => useShareCtx())).toThrow(
        "useShareCtx must be used under <ShareProvider>"
    )
})
