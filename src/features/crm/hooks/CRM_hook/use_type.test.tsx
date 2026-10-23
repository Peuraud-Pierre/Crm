import { beforeEach, expect, rstest, test } from "@rstest/core";
import { act, renderHook, waitFor } from "@testing-library/react";

const mocks = rstest.hoisted(() => {
    const insert = rstest.fn();
    const select = rstest.fn();
    const single = rstest.fn();
    const del = rstest.fn();
    const eq = rstest.fn();
    const channel = {
        on: rstest.fn().mockReturnThis(),
        subscribe: rstest.fn().mockReturnThis(),
    };
    const supabase = {
        from: rstest.fn(() => ({
            insert,
            select,
            delete: del,
            eq,
        })),
        channel: rstest.fn(() => channel),
        removeChannel: rstest.fn(),
    };

    insert.mockReturnValue({ select });
    select.mockImplementation((fields?: string) => {
        if (fields === "id") {
            return { single };
        }
        return Promise.resolve({
            data: [{ id: "type-1", name: "Type A" }],
            error: null,
        });
    });
    del.mockReturnValue({ eq });
    eq.mockResolvedValue({ error: null });

    return { insert, select, single, del, eq, supabase };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: mocks.supabase,
}));

import { useType } from "./use_type";

beforeEach(() => {
    rstest.clearAllMocks();
});

test("useType fetches types and create_Type returns id", async () => {
    mocks.single.mockResolvedValue({ data: { id: "type-2" }, error: null });

    const { result } = renderHook(() => useType());

    await waitFor(() => {
        expect(result.current.Type).toHaveLength(1);
    });

    // create_Type appelle setType après résolution : hors act, la mise à jour
    // retombe après la fin du test.
    let createdId: string | null | undefined = null;
    await act(async () => {
        createdId = await result.current.create_Type({ name: "New" });
    });
    expect(createdId).toBe("type-2");
});
