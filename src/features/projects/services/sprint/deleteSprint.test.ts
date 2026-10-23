import { beforeEach, expect, rstest, test } from "@rstest/core";

const mocks = rstest.hoisted(() => {
    const del = rstest.fn();
    const eq = rstest.fn();
    const from = rstest.fn(() => ({ delete: del }));
    const toast = { error: rstest.fn(), success: rstest.fn() };

    del.mockReturnValue({ eq });

    return { del, eq, from, toast };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: mocks.from,
    },
}));

rstest.mock("sonner", () => ({
    toast: mocks.toast,
}));

import type { DeleteSprintPayload } from "@/features/projects/types";
import { deleteSprint } from "./deleteSprint";

beforeEach(() => {
    rstest.clearAllMocks();
});

test("deleteSprint notifies and refreshes", async () => {
    mocks.eq.mockResolvedValue({ error: null });

    const sendProjectNotifications = rstest.fn();
    const fetchBoards = rstest.fn();
    const broadcastRefresh = rstest.fn();

    const result = await deleteSprint({
        sprintId: "sprint-1",
        teamId: "team-1",
        memberIds: ["user-1"],
        sprintName: "Sprint A",
        actorName: "Alice",
        findSprint: rstest.fn(),
        teams: [],
        sendProjectNotifications,
        fetchBoards,
        broadcastRefresh,
    } as DeleteSprintPayload);

    expect(result).toEqual({ success: true });
    expect(sendProjectNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
            userIds: ["user-1"],
            title: "Sprint supprimé",
        })
    );
    expect(mocks.toast.success).toHaveBeenCalledWith("Sprint supprimé");
    expect(fetchBoards).toHaveBeenCalled();
    expect(broadcastRefresh).toHaveBeenCalled();
});
