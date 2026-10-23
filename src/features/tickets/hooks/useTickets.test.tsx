import { beforeEach, expect, rstest, test } from "@rstest/core";
import { act, renderHook } from "@testing-library/react";

const mocks = rstest.hoisted(() => {
    const ticketsOrderFn = rstest.fn();
    const ticketsEqFn = rstest.fn();
    const ticketsInsertSingleFn = rstest.fn();
    const ticketsDeleteEqFn = rstest.fn();

    const channel = {
        on: rstest.fn().mockReturnThis(),
        subscribe: rstest.fn().mockReturnThis(),
    };

    const supabase = {
        from: rstest.fn((table: string) => {
            if (table === "ticket_table") {
                return {
                    select: rstest.fn(() => ({
                        order: ticketsOrderFn,
                        eq: ticketsEqFn,
                        single: rstest.fn(),
                    })),
                    insert: rstest.fn(() => ({
                        select: rstest.fn(() => ({
                            single: ticketsInsertSingleFn,
                        })),
                    })),
                    update: rstest.fn(() => ({ eq: ticketsEqFn })),
                    delete: rstest.fn(() => ({ eq: ticketsDeleteEqFn })),
                };
            }
            return {};
        }),
        auth: { getUser: rstest.fn() },
        storage: { from: rstest.fn() },
        channel: rstest.fn(() => channel),
        removeChannel: rstest.fn(),
    };

    const toast = {
        success: rstest.fn(),
        error: rstest.fn(),
    };

    return {
        ticketsOrderFn,
        ticketsEqFn,
        ticketsInsertSingleFn,
        ticketsDeleteEqFn,
        supabase,
        toast,
        channel,
    };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: mocks.supabase,
}));

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    // Mock du hook useAuth : nom imposé par l'API, pas un vrai hook ici.
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix
    useAuth: () => ({ user: { user_id: "user-1" } }),
}));

rstest.mock("sonner", () => ({
    toast: mocks.toast,
}));

import { useTickets } from "./useTickets";

beforeEach(() => {
    rstest.clearAllMocks();
    mocks.supabase.from.mockImplementation((table: string) => {
        if (table === "ticket_table") {
            return {
                select: rstest.fn(() => ({
                    order: mocks.ticketsOrderFn,
                    eq: mocks.ticketsEqFn,
                    single: rstest.fn(),
                })),
                insert: rstest.fn(() => ({
                    select: rstest.fn(() => ({
                        single: mocks.ticketsInsertSingleFn,
                    })),
                })),
                update: rstest.fn(() => ({ eq: mocks.ticketsEqFn })),
                delete: rstest.fn(() => ({ eq: mocks.ticketsDeleteEqFn })),
            };
        }
        return {};
    });
    mocks.ticketsOrderFn.mockResolvedValue({ data: [], error: null });
});

test("useTickets fetchTickets maps tickets", async () => {
    mocks.ticketsOrderFn.mockResolvedValue({
        data: [
            {
                id: "t1",
                title: "Test ticket",
                description: "Desc",
                status: "ouvert",
                priority: "moyenne",
                category: "bug",
                created_by: "u1",
                assigned_to: "u2",
                from: "Nokk_project",
                created_at: "now",
                updated_at: "now",
                profiles: { user_id: "u1", full_name: "User" },
                assigned_profile: { user_id: "u2", full_name: "Agent" },
            },
        ],
        error: null,
    });

    const { result } = renderHook(() => useTickets());
    await act(async () => {
        await result.current.fetchTickets();
    });

    expect(result.current.tickets).toHaveLength(1);
    expect(result.current.tickets[0].profiles?.full_name).toBe("User");
    expect(result.current.tickets[0].assigned_profile?.full_name).toBe("Agent");
});

test("createTicket inserts and returns ticket", async () => {
    const newTicket = {
        id: "t2",
        title: "Sub",
        description: "Desc",
        status: "ouvert" as const,
        priority: "moyenne" as const,
        category: "bug" as const,
        created_by: "user-1",
        from: "Nokk_project" as const,
        created_at: "now",
        updated_at: "now",
        profiles: null,
        assigned_profile: null,
    };
    mocks.ticketsInsertSingleFn.mockResolvedValue({
        data: newTicket,
        error: null,
    });

    const { result } = renderHook(() => useTickets());

    let response: Awaited<
        ReturnType<typeof result.current.createTicket>
    > | undefined;
    await act(async () => {
        response = await result.current.createTicket(newTicket);
    });

    expect(response).not.toBeNull();
    expect(response?.id).toBe("t2");
});

test("updateTicket calls supabase update", async () => {
    mocks.ticketsEqFn.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useTickets());

    await act(async () => {
        await result.current.updateTicket({
            id: "t1",
            title: "Updated",
            description: "Desc",
            status: "ouvert",
            priority: "moyenne",
            category: "bug",
            created_by: "user-1",
            from: "Nokk_project" as const,
            created_at: "now",
            updated_at: "now",
            profiles: null,
            assigned_profile: null,
        });
    });

    expect(mocks.ticketsEqFn).toHaveBeenCalledWith("id", "t1");
});

test("deleteTicket calls supabase delete", async () => {
    mocks.ticketsDeleteEqFn.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useTickets());

    await act(async () => {
        await result.current.deleteTicket("t1");
    });

    expect(mocks.ticketsDeleteEqFn).toHaveBeenCalledWith("id", "t1");
});
