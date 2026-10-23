import { afterEach, beforeEach, expect, rstest, test } from "@rstest/core";

const mocks = rstest.hoisted(() => {
    const update = rstest.fn();
    const eq = rstest.fn();
    const from = rstest.fn(() => ({ update }));
    const toast = { error: rstest.fn(), success: rstest.fn() };

    update.mockReturnValue({ eq });

    return { update, eq, from, toast };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: mocks.from,
    },
}));

rstest.mock("sonner", () => ({
    toast: mocks.toast,
}));

import type { UpdateSprintStatusPayload } from "@/features/projects/types";
import { updateSprintStatus } from "./updateSprintStatus";

const originalConsoleError = console.error;

beforeEach(() => {
    rstest.clearAllMocks();
    console.error = () => {};
});

afterEach(() => {
    console.error = originalConsoleError;
});

test("updateSprintStatus notifies team and refreshes", async () => {
    mocks.eq.mockResolvedValue({ error: null });

    const sendProjectNotifications = rstest.fn();
    const fetchBoards = rstest.fn();
    const broadcastRefresh = rstest.fn();

    const result = await updateSprintStatus({
        sprintId: "sprint-1",
        status: "archived",
        actorName: "Alice",
        findSprint: rstest.fn(),
        teams: [
            {
                id: "team-1",
                owner_id: "owner-1",
                members: [{ user_id: "member-1" }],
                sprints: [{ id: "sprint-1", name: "Sprint A" }],
            },
        ],
        sendProjectNotifications,
        fetchBoards,
        broadcastRefresh,
    } as unknown as UpdateSprintStatusPayload);

    expect(result).toEqual({ success: true });
    expect(sendProjectNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
            title: "Sprint archivé",
            userIds: expect.arrayContaining(["owner-1", "member-1"]),
        })
    );
    expect(mocks.toast.success).toHaveBeenCalledWith("Sprint archivé");
    expect(fetchBoards).toHaveBeenCalled();
    expect(broadcastRefresh).toHaveBeenCalled();
});

test("updateSprintStatus handles RLS errors", async () => {
    mocks.eq.mockResolvedValue({
        error: {
            code: "42501",
            message: "row-level security",
        },
    });

    const result = await updateSprintStatus({
        sprintId: "sprint-1",
        status: "archived",
        actorName: "Alice",
        findSprint: rstest.fn(),
        teams: [],
        sendProjectNotifications: rstest.fn(),
        fetchBoards: rstest.fn(),
        broadcastRefresh: rstest.fn(),
    } as unknown as UpdateSprintStatusPayload);

    expect(result.success).toBe(false);
    expect(mocks.toast.error).toHaveBeenCalledWith(
        "Vous n'avez pas les droits pour modifier ce sprint."
    );
});
