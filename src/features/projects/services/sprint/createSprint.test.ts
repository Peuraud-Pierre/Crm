import { beforeEach, expect, rstest, test } from "@rstest/core";

import type {
    CreateSprintPayload,
    ProjectTeam,
} from "@/features/projects/types";

const mocks = rstest.hoisted(() => {
    const getUser = rstest.fn();
    const insert = rstest.fn();
    const from = rstest.fn(() => ({ insert }));
    const toast = { error: rstest.fn(), success: rstest.fn() };

    return { getUser, insert, from, toast };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        auth: { getUser: mocks.getUser },
        from: mocks.from,
    },
}));

rstest.mock("sonner", () => ({
    toast: mocks.toast,
}));

import { createSprint } from "./createSprint";

beforeEach(() => {
    rstest.clearAllMocks();
});

test("createSprint returns auth error when session missing", async () => {
    mocks.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "expired" },
    });

    const result = await createSprint({
        teamId: "team-1",
        name: "Sprint A",
        teams: [],
        sendProjectNotifications: rstest.fn(),
        fetchBoards: rstest.fn(),
        broadcastRefresh: rstest.fn(),
    } as unknown as CreateSprintPayload);

    expect(result).toEqual({ success: false, error: "expired" });
    expect(mocks.toast.error).toHaveBeenCalledWith("Session expirée");
});

test("createSprint inserts and notifies team", async () => {
    mocks.getUser.mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });

    const sendProjectNotifications = rstest.fn();
    const fetchBoards = rstest.fn();
    const broadcastRefresh = rstest.fn();

    const result = await createSprint({
        teamId: "team-1",
        name: "Sprint A",
        teams: [
            {
                id: "team-1",
                owner_id: "owner-1",
                members: [{ user_id: "member-1" }],
            },
        ] as unknown as ProjectTeam[],
        actorName: "Alice",
        sendProjectNotifications,
        fetchBoards,
        broadcastRefresh,
    } as unknown as CreateSprintPayload);

    expect(result).toEqual({ success: true });
    expect(sendProjectNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
            userIds: expect.arrayContaining(["owner-1", "member-1"]),
            title: "Nouveau sprint",
        })
    );
    expect(mocks.toast.success).toHaveBeenCalledWith("Sprint créé");
    expect(fetchBoards).toHaveBeenCalled();
    expect(broadcastRefresh).toHaveBeenCalled();
});
