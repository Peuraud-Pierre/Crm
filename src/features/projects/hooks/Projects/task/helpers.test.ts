import { expect, test } from "@rstest/core";
import type { ProjectTask } from "@/features/projects/types";
import {
    getNextPositionInList,
    sanitizeTaskUpdatePayload,
    taskBelongsToSprint,
} from "./helpers";

test("getNextPositionInList returns next position for status", () => {
    const tasks = [
        { status: "todo" as const, position: 2 },
        { status: "todo" as const, position: 5 },
        { status: "done" as const, position: 1 },
        { status: "todo" as const },
    ] as unknown as Pick<ProjectTask, "status" | "position">[];

    expect(getNextPositionInList(tasks, "todo")).toBe(6);
    expect(getNextPositionInList(tasks, "done")).toBe(2);
    expect(getNextPositionInList(tasks, "in_progress")).toBe(1);
});

test("sanitizeTaskUpdatePayload keeps only defined fields", () => {
    const updates = {
        title: "New title",
        description: undefined,
        assignee_id: null,
        due_date: "2024-02-01",
        priority: "High",
        status: undefined,
    } as unknown as Partial<Omit<ProjectTask, "id" | "sprint_id" | "created_at">>;

    expect(sanitizeTaskUpdatePayload(updates)).toEqual({
        title: "New title",
        assignee_id: null,
        due_date: "2024-02-01",
        priority: "High",
    });
});

test("taskBelongsToSprint matches sprint id", () => {
    expect(
        taskBelongsToSprint(
            { sprint_id: "sprint-1" } as Pick<ProjectTask, "sprint_id">,
            "sprint-1"
        )
    ).toBe(true);
    expect(
        taskBelongsToSprint(
            { sprint_id: "sprint-2" } as Pick<ProjectTask, "sprint_id">,
            "sprint-1"
        )
    ).toBe(false);
});
