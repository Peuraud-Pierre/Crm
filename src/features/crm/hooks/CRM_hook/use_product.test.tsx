import { beforeEach, expect, rstest, test } from "@rstest/core";
import { act, renderHook, waitFor } from "@testing-library/react";

const mocks = rstest.hoisted(() => {
    const select = rstest.fn();
    const insert = rstest.fn();
    const update = rstest.fn();
    const del = rstest.fn();
    const eq = rstest.fn();
    const channel = {
        on: rstest.fn().mockReturnThis(),
        subscribe: rstest.fn().mockReturnThis(),
    };
    const supabase = {
        from: rstest.fn(() => ({
            select,
            insert,
            update,
            delete: del,
            eq,
        })),
        channel: rstest.fn(() => channel),
        removeChannel: rstest.fn(),
    };

    select.mockResolvedValue({
        data: [
            { id: 1, name: "A", price: 1, stock: 1, categorie: "c" },
            { id: 1, name: "A", price: 1, stock: 1, categorie: "c" },
            { id: 2, name: "B", price: 2, stock: 2, categorie: "c" },
        ],
        error: null,
    });
    update.mockReturnValue({ eq });
    del.mockReturnValue({ eq });
    eq.mockResolvedValue({ error: null });

    return { select, insert, update, del, eq, supabase };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: mocks.supabase,
}));

import { useProduct } from "./use_product";

beforeEach(() => {
    rstest.clearAllMocks();
});

test("useProduct deduplicates fetched products", async () => {
    let result!: { current: ReturnType<typeof useProduct> };
    await act(async () => {
        ({ result } = renderHook(() => useProduct()));
    });

    await waitFor(() => {
        expect(result.current.Produit).toHaveLength(2);
    });
});

test("update_product updates local state", async () => {
    let result!: { current: ReturnType<typeof useProduct> };
    await act(async () => {
        ({ result } = renderHook(() => useProduct()));
    });

    await waitFor(() => {
        expect(result.current.Produit.length).toBeGreaterThan(0);
    });

    await act(async () => {
        await result.current.update_product(1, { stock: 5 });
    });
    await waitFor(() => {
        expect(result.current.Produit.find((p) => p.id === 1)?.stock).toBe(5);
    });
});

test("delete_product removes item from state", async () => {
    let result!: { current: ReturnType<typeof useProduct> };
    await act(async () => {
        ({ result } = renderHook(() => useProduct()));
    });

    await waitFor(() => {
        expect(result.current.Produit).toHaveLength(2);
    });

    await act(async () => {
        await result.current.delete_product(1);
    });

    expect(result.current.Produit.find((p) => p.id === 1)).toBeUndefined();
});
