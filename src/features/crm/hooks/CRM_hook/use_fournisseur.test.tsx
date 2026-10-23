import { beforeEach, expect, rstest, test } from "@rstest/core";
import { renderHook, waitFor } from "@testing-library/react";

const mocks = rstest.hoisted(() => {
    const insert = rstest.fn();
    const select = rstest.fn();
    const del = rstest.fn();
    const eq = rstest.fn();
    const supabase = {
        from: rstest.fn(() => ({
            insert,
            select,
            delete: del,
            eq,
        })),
    };

    select.mockResolvedValue({
        data: [{ id: "f-1", name: "Four A" }],
        error: null,
    });
    del.mockReturnValue({ eq });
    eq.mockResolvedValue({ error: null });

    return { insert, select, del, eq, supabase };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: mocks.supabase,
}));

import { UseFournisseur } from "./use_fournisseur";

beforeEach(() => {
    rstest.clearAllMocks();
});

test("UseFournisseur fetches list on mount", async () => {
    const { result } = renderHook(() => UseFournisseur());

    await waitFor(() => {
        expect(result.current.fournisseurs).toEqual([
            { id: "f-1", name: "Four A" },
        ]);
    });
});
