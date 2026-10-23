import { expect, test } from "@rstest/core";
import type { ProjectTeam } from "@/features/projects/types";
import {
    checkSprintExists,
    formatSprintPayload,
    validateSprintDates,
} from "./helpers";

test("validateSprintDates allows missing dates and rejects invalid ranges", () => {
    expect(validateSprintDates()).toBe(true);
    expect(validateSprintDates("2024-01-10", "2024-01-20")).toBe(true);
    expect(validateSprintDates("2024-02-01", "2024-01-01")).toBe(false);
});

test("checkSprintExists finds sprint id in team", () => {
    const team = {
        sprints: [{ id: "sprint-1" }, { id: "sprint-2" }],
    } as unknown as ProjectTeam;

    expect(checkSprintExists(team, "sprint-2")).toBe(true);
    expect(checkSprintExists(team, "sprint-3")).toBe(false);
    expect(checkSprintExists(undefined, "sprint-1")).toBe(false);
});

test("formatSprintPayload normalizes optional fields", () => {
    const payload = {
        name: "Sprint A",
        goal: "",
        startDate: undefined,
        endDate: "2024-03-10",
        createdBy: "user-1",
    };

    expect(formatSprintPayload(payload)).toEqual({
        name: "Sprint A",
        goal: null,
        start_date: null,
        end_date: "2024-03-10",
        created_by: "user-1",
    });
});
