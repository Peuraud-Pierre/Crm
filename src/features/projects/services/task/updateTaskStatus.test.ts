import { beforeEach, expect, rstest, test } from "@rstest/core";

import type { TaskStatus } from "@/features/projects/types";

const mocks = rstest.hoisted(() => {
    const getUser = rstest.fn();
    const update = rstest.fn();
    const eq = rstest.fn();
    const from = rstest.fn(() => ({ update }));
    const toast = { error: rstest.fn() };

    update.mockReturnValue({ eq });

    return { getUser, update, eq, from, toast };
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

import { updateTaskStatus } from "./updateTaskStatus";

beforeEach(() => {
    rstest.clearAllMocks();
});

test("updateTaskStatus returns not_found when task missing", async () => {
    const result = await updateTaskStatus({
        taskId: "task-1",
        status: "done" as TaskStatus,
        findTask: () => undefined,
        fetchBoards: rstest.fn(),
        getNextPosition: rstest.fn(),
        broadcastRefresh: rstest.fn(),
    });

    expect(result).toEqual({ success: false, error: "not_found" });
    expect(mocks.toast.error).toHaveBeenCalledWith("Tâche introuvable");
    expect(mocks.from).not.toHaveBeenCalled();
});

test("updateTaskStatus updates task and refreshes", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.eq.mockResolvedValue({ error: null });

    const fetchBoards = rstest.fn();
    const broadcastRefresh = rstest.fn();
    const getNextPosition = rstest.fn(() => 3);
    const findTask = rstest.fn(() => ({ sprint_id: "sprint-1" }));

    const result = await updateTaskStatus({
        taskId: "task-1",
        status: "done" as TaskStatus,
        findTask,
        fetchBoards,
        getNextPosition,
        broadcastRefresh,
    });

    expect(result).toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
            status: "done",
            position: 3,
            last_moved_by: "user-1",
            last_moved_at: expect.any(String),
        })
    );
    expect(fetchBoards).toHaveBeenCalled();
    expect(broadcastRefresh).toHaveBeenCalled();
});
