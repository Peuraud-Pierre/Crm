import { beforeEach, expect, rstest, test } from "@rstest/core";

const mocks = rstest.hoisted(() => {
    const del = rstest.fn();
    const eq = rstest.fn();
    const from = rstest.fn(() => ({ delete: del }));
    const toast = { error: rstest.fn() };

    del.mockReturnValue({ eq });

    return { del, eq, from, toast };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: mocks.from,
    },
}));

rstest.mock("./taskAttachmentService", () => ({
    removeTaskAttachmentFiles: rstest.fn(),
}));

rstest.mock("sonner", () => ({
    toast: mocks.toast,
}));

import type { DeleteTaskPayload } from "@/features/projects/types";
import type { ProjectTask } from "@/features/projects/types";
import { deleteTask } from "./deleteTask";

beforeEach(() => {
    rstest.clearAllMocks();
});

test("deleteTask sends notifications and refreshes", async () => {
    mocks.eq.mockResolvedValue({ error: null });

    const sendProjectNotifications = rstest.fn();
    const fetchBoards = rstest.fn();
    const broadcastRefresh = rstest.fn();

    const result = await deleteTask({
        taskId: "task-1",
        actorName: "Alice",
        teams: [
            {
                id: "team-1",
                owner_id: "owner-1",
                members: [{ user_id: "member-1" }],
                sprints: [{ id: "sprint-1" }],
            },
        ],
        findTask: () =>
            ({ sprint_id: "sprint-1", title: "Task A" }) as unknown as ProjectTask,
        sendProjectNotifications,
        fetchBoards,
        broadcastRefresh,
    } as unknown as DeleteTaskPayload);

    expect(result).toEqual({ success: true });
    expect(sendProjectNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
            userIds: expect.arrayContaining(["owner-1", "member-1"]),
            title: "Tâche supprimée",
        })
    );
    expect(fetchBoards).toHaveBeenCalled();
    expect(broadcastRefresh).toHaveBeenCalled();
});
