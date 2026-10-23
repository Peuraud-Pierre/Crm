import { expect, test } from "@rstest/core";
import { mapTeams, type RawTeamRow } from "./mapTeams";

test("mapTeams maps members, sprints, tasks and defaults status", () => {
    const rows = [
        {
            id: "team-1",
            name: "Alpha",
            description: null,
            owner_id: "owner-1",
            created_at: "2024-01-01T00:00:00Z",
            status: undefined,
            project_team_members: [
                {
                    id: "member-1",
                    team_id: "team-1",
                    user_id: "user-1",
                    role: "owner",
                    profile: {
                        user_id: "user-1",
                        full_name: "User One",
                        email: "user@example.com",
                        avatar_url: null,
                    },
                },
            ],
            project_sprints: [
                {
                    id: "sprint-1",
                    team_id: "team-1",
                    name: "Sprint 1",
                    goal: null,
                    status: "active",
                    start_date: null,
                    end_date: null,
                    created_by: "user-1",
                    created_at: "2024-01-02T00:00:00Z",
                    project_tasks: [
                        {
                            id: "task-1",
                            sprint_id: "sprint-1",
                            title: "Task 1",
                            description: null,
                            status: "todo",
                            assignee_id: null,
                            assignee: null,
                            created_by: "user-1",
                            due_date: null,
                            position: 1,
                            priority: "Normal",
                            last_moved_by: null,
                            last_moved_at: null,
                            last_moved_by_profile: null,
                            created_at: "2024-01-03T00:00:00Z",
                        },
                    ],
                },
            ],
        },
    ];

    const [team] = mapTeams(rows as unknown as RawTeamRow[]);

    expect(team.status).toBe("active");
    expect(team.members[0].profile?.full_name).toBe("User One");
    expect(team.sprints[0].tasks[0].title).toBe("Task 1");
});
