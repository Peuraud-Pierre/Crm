import { afterEach, beforeEach, expect, rstest, test } from "@rstest/core";

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

import type { UpdateTaskPriorityPayload } from "@/features/projects/types";
import type { ProjectTask } from "@/features/projects/types";
import { updateTaskPriority } from "./updateTaskPriority";

const originalConsoleError = console.error;

beforeEach(() => {
    rstest.clearAllMocks();
    console.error = () => {};
});

afterEach(() => {
    console.error = originalConsoleError;
});

test("updateTaskPriority returns not_found when task missing", async () => {
    const result = await updateTaskPriority({
        taskId: "task-1",
        priority: "High",
        findTask: () => undefined,
        fetchBoards: rstest.fn(),
        broadcastRefresh: rstest.fn(),
    } as unknown as UpdateTaskPriorityPayload);

    expect(result).toEqual({ success: false, error: "not_found" });
    expect(mocks.toast.error).toHaveBeenCalledWith("Tâche introuvable");
    expect(mocks.from).not.toHaveBeenCalled();
});

test("updateTaskPriority handles RLS errors", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.eq.mockResolvedValue({
        error: {
            code: "42501",
            message: "row-level security",
        },
    });

    const result = await updateTaskPriority({
        taskId: "task-1",
        priority: "High",
        findTask: () => ({ id: "task-1" }) as unknown as ProjectTask,
        fetchBoards: rstest.fn(),
        broadcastRefresh: rstest.fn(),
    } as unknown as UpdateTaskPriorityPayload);

    expect(result.success).toBe(false);
    expect(mocks.toast.error).toHaveBeenCalledWith(
        "Vous n'avez pas les droits pour modifier cette tâche."
    );
});
