import { afterEach, beforeEach, expect, rstest, test } from "@rstest/core";
import { act, renderHook, waitFor } from "@testing-library/react";

const mocks = rstest.hoisted(() => {
    const insert = rstest.fn();
    const select = rstest.fn();
    const single = rstest.fn();
    const update = rstest.fn();
    const del = rstest.fn();
    const eq = rstest.fn();
    const toast = { error: rstest.fn() };
    const channel = {
        on: rstest.fn().mockReturnThis(),
        subscribe: rstest.fn().mockReturnThis(),
    };
    const supabase = {
        from: rstest.fn(() => ({
            insert,
            select,
            single,
            update,
            delete: del,
            eq,
        })),
        channel: rstest.fn(() => channel),
        removeChannel: rstest.fn(),
    };

    insert.mockReturnValue({ select });
    select.mockReturnValue({ single });
    single.mockResolvedValue({
        data: { id: "act-1", client: "c1", date: "2024-01-01T00:00:00Z" },
        error: null,
    });
    update.mockReturnValue({ eq });
    del.mockReturnValue({ eq });
    eq.mockResolvedValue({ error: null });

    return { insert, select, single, eq, toast, supabase };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: mocks.supabase,
}));

rstest.mock("sonner", () => ({
    toast: mocks.toast,
}));

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    // Le nom `useAuth` doit correspondre au hook réellement mocké, on ne peut
    // pas le renommer sans casser le mock.
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix
    useAuth: () => ({ user: { id: "user-1" } }),
}));

import { useActivites } from "./use_activites";

beforeEach(() => {
    rstest.clearAllMocks();
    rstest.stubGlobal("crypto", { randomUUID: () => "temp-1" });
});

afterEach(() => {
    rstest.unstubAllGlobals();
});

test("create_activites adds and replaces temp entry", async () => {
    let result!: { current: ReturnType<typeof useActivites> };
    await act(async () => {
        ({ result } = renderHook(() => useActivites()));
    });

    await act(async () => {
        await result.current.create_activites({
            client: "c1",
            title: "Call",
            content: "Hello",
        });
    });

    await waitFor(() => {
        expect(result.current.activites[0]?.id).toBe("act-1");
    });
});

test("delete_activites rolls back on error", async () => {
    let result!: { current: ReturnType<typeof useActivites> };
    await act(async () => {
        ({ result } = renderHook(() => useActivites()));
    });

    await act(async () => {
        await result.current.create_activites({
            client: "c1",
            title: "Call",
            content: "Hello",
        });
    });

    await waitFor(() => {
        expect(result.current.activites).toHaveLength(1);
    });

    mocks.eq.mockResolvedValueOnce({ error: { message: "fail" } });

    await act(async () => {
        await result.current.delete_activites("act-1", "c1");
    });

    await waitFor(() => {
        expect(result.current.activites).toHaveLength(1);
    });
    expect(mocks.toast.error).toHaveBeenCalledWith("Erreur suppression");
});
