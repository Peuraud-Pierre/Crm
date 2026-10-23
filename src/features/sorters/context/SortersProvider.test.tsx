import React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, expect, rstest, test } from "@rstest/core"

import type { SortingReport } from "../components/struct"

const mocks = rstest.hoisted(() => ({
    order: rstest.fn(),
    eq: rstest.fn(),
    update: rstest.fn(),
    updateEq: rstest.fn(),
    updateSelect: rstest.fn(),
    channel: rstest.fn(),
    removeChannel: rstest.fn(),
}))

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: () => ({
            select: () => ({
                order: mocks.order,
            }),
            update: mocks.update,
        }),
        channel: mocks.channel,
        removeChannel: mocks.removeChannel,
    },
}))

import { SortersProvider, useSorters } from "./SortersProvider"

const baseReport: SortingReport = {
    id: "r-1",
    uid_balle: "b1",
    user_id: "user-1",
    fournisseur_uid: "f1",
    category: "cat-a",
    time: "12:00:00",
    quantity: 1,
    comments: "note",
    quality: 1,
    updated_at: "00:00:00 - 00/00/0000",
}

const makeWrapper =
    (adminView: boolean) =>
    ({ children }: { children: React.ReactNode }) =>
        (
            <SortersProvider userId="user-1" adminView={adminView}>
                {children}
            </SortersProvider>
        )

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.order.mockReturnValue({ data: [baseReport], error: null, eq: mocks.eq })
    mocks.eq.mockReturnValue({ data: [baseReport], error: null })
    mocks.updateSelect.mockReturnValue({ data: [], error: null })
    mocks.updateEq.mockReturnValue({ select: mocks.updateSelect })
    mocks.update.mockReturnValue({ eq: mocks.updateEq })
    mocks.channel.mockReturnValue({
        on: () => ({ subscribe: () => ({}) }),
    })
})

test("fetchReports respects adminView filtering", async () => {
    const { result } = renderHook(() => useSorters(), {
        wrapper: makeWrapper(false),
    })

    await waitFor(() => {
        expect(result.current.loading).toBe(false)
    })
    await waitFor(() => {
        expect(result.current.reports).toHaveLength(1)
    })
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "user-1")

    mocks.eq.mockClear()
    const { result: adminResult } = renderHook(() => useSorters(), {
        wrapper: makeWrapper(true),
    })
    await waitFor(() => {
        expect(adminResult.current.loading).toBe(false)
    })
    await waitFor(() => {
        expect(adminResult.current.reports).toHaveLength(1)
    })
    expect(mocks.eq).not.toHaveBeenCalled()
})

test("filteredReports matches filter and search", async () => {
    const { result } = renderHook(() => useSorters(), {
        wrapper: makeWrapper(true),
    })

    await waitFor(() => {
        expect(result.current.loading).toBe(false)
    })
    await waitFor(() => {
        expect(result.current.reports).toHaveLength(1)
    })

    act(() => {
        result.current.setFilter("cat-a")
        result.current.setSearch("note")
    })

    expect(result.current.filteredReports).toHaveLength(1)

    act(() => {
        result.current.setFilter("cat-b")
    })

    expect(result.current.filteredReports).toHaveLength(0)
})

test("openNewForm and openEditForm set form state", async () => {
    const { result } = renderHook(() => useSorters(), {
        wrapper: makeWrapper(true),
    })

    await waitFor(() => {
        expect(result.current.loading).toBe(false)
    })
    act(() => {
        result.current.openNewForm()
    })

    expect(result.current.openForm).toBe(true)
    expect(result.current.form?.category).toBe("")

    act(() => {
        result.current.openEditForm(baseReport)
    })

    expect(result.current.editing?.id).toBe("r-1")
    expect(result.current.form?.category).toBe("cat-a")
})

test("handleSave updates when editing", async () => {
    const { result } = renderHook(() => useSorters(), {
        wrapper: makeWrapper(true),
    })

    await waitFor(() => {
        expect(result.current.loading).toBe(false)
    })
    act(() => {
        result.current.openEditForm(baseReport)
    })

    await act(async () => {
        await result.current.handleSave("r-1")
    })

    expect(mocks.update).toHaveBeenCalled()
    expect(result.current.openForm).toBe(false)
})
