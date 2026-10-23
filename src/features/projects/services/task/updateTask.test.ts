import { beforeEach, expect, rstest, test } from "@rstest/core";

import type { TaskStatus, UpdateTaskPayload } from "@/features/projects/types";

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

import { updateTask } from "./updateTask";

beforeEach(() => {
    rstest.clearAllMocks();
});

test("updateTask returns success when no payload changes", async () => {
    const result = await updateTask({
        taskId: "task-1",
        updates: {},
        fetchBoards: rstest.fn(),
        broadcastRefresh: rstest.fn(),
        findTask: rstest.fn(),
        getNextPosition: rstest.fn(),
    } as unknown as UpdateTaskPayload);

    expect(result).toEqual({ success: true });
    expect(mocks.from).not.toHaveBeenCalled();
});

test("updateTask tracks mover when status changes", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.eq.mockResolvedValue({ error: null });

    const fetchBoards = rstest.fn();
    const broadcastRefresh = rstest.fn();
    const findTask = rstest.fn(() => ({ sprint_id: "sprint-1" }));
    const getNextPosition = rstest.fn(() => 5);

    const result = await updateTask({
        taskId: "task-1",
        updates: { status: "done" as TaskStatus, title: "New" },
        fetchBoards,
        broadcastRefresh,
        findTask,
        getNextPosition,
    } as unknown as UpdateTaskPayload);

    expect(result).toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
            status: "done",
            position: 5,
            last_moved_by: "user-1",
            last_moved_at: expect.any(String),
            title: "New",
        })
    );
    expect(fetchBoards).toHaveBeenCalled();
    expect(broadcastRefresh).toHaveBeenCalled();
});
