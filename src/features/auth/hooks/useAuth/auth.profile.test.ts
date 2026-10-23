import { beforeEach, expect, rstest, test } from "@rstest/core";

const mocks = rstest.hoisted(() => {
    const select = rstest.fn();
    const eq = rstest.fn();
    const single = rstest.fn();
    const supabase = {
        from: rstest.fn(() => ({
            select,
            eq,
            single,
        })),
    };

    select.mockReturnValue({ eq });
    eq.mockReturnValue({ single });

    return { select, eq, single, supabase };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: mocks.supabase,
}));

import { fetchUserProfile } from "./auth.profile";

beforeEach(() => {
    rstest.clearAllMocks();
});

test("fetchUserProfile maps optional fields", async () => {
    mocks.single.mockResolvedValue({
        data: {
            full_name: null,
            avatar_url: null,
            role: { id: "role-1", nom: "Admin" },
            service: { id: "service-1", nom: "Support" },
            last_login: null,
        },
        error: null,
    });

    const result = await fetchUserProfile("user-1");

    expect(result).toEqual({
        full_name: undefined,
        avatar_url: undefined,
        role: "Admin",
        role_id: "role-1",
        service: "Support",
        service_id: "service-1",
        last_login: undefined,
        id: "user-1",
    });
});

test("fetchUserProfile returns null on error", async () => {
    const consoleError = console.error;
    console.error = () => {};
    mocks.single.mockResolvedValue({
        data: null,
        error: { message: "fail" },
    });

    await expect(fetchUserProfile("user-1")).resolves.toBeNull();
    console.error = consoleError;
});
