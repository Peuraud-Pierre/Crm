import { beforeEach, expect, rstest, test } from "@rstest/core";

import type { CreateTaskPayload } from "@/features/projects/types";

const mocks = rstest.hoisted(() => {
    const getUser = rstest.fn();
    const single = rstest.fn();
    const insert = rstest.fn(() => ({ select: () => ({ single }) }));
    const from = rstest.fn(() => ({ insert }));
    const toast = { error: rstest.fn() };

    return { getUser, single, insert, from, toast };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        auth: { getUser: mocks.getUser },
        from: mocks.from,
    },
}));

rstest.mock("./taskAttachmentService", () => ({
    uploadTaskAttachment: rstest.fn(),
}));

rstest.mock("sonner", () => ({
    toast: mocks.toast,
}));

import { createTask } from "./createTask";

beforeEach(() => {
    rstest.clearAllMocks();
});

test("createTask returns auth error when session missing", async () => {
    mocks.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "expired" },
    });

    const result = await createTask({
        sprintId: "sprint-1",
        title: "Task",
        fetchBoards: rstest.fn(),
        broadcastRefresh: rstest.fn(),
        getNextPosition: rstest.fn(),
    } as unknown as CreateTaskPayload);

    expect(result).toEqual({ success: false, error: "expired" });
    expect(mocks.toast.error).toHaveBeenCalledWith("Session expirée");
});

test("createTask inserts and refreshes on success", async () => {
    mocks.getUser.mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
    });
    mocks.single.mockResolvedValue({ data: { id: "task-1" }, error: null });

    const fetchBoards = rstest.fn();
    const broadcastRefresh = rstest.fn();

    const result = await createTask({
        sprintId: "sprint-1",
        title: "Task",
        fetchBoards,
        broadcastRefresh,
        getNextPosition: rstest.fn(() => 2),
    } as unknown as CreateTaskPayload);

    expect(result).toEqual({ success: true, taskId: "task-1" });
    expect(mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
            sprint_id: "sprint-1",
            title: "Task",
            status: "todo",
            position: 2,
            created_by: "user-1",
        })
    );
    expect(fetchBoards).toHaveBeenCalled();
    expect(broadcastRefresh).toHaveBeenCalled();
});
