import { expect, test } from "@rstest/core"

import { buildProjectPath, isProjectView } from "./projectRoutes"

test("sans projet, tout retombe sur l'accueil", () => {
    expect(buildProjectPath({})).toBe("/projects")
    expect(
        buildProjectPath({ projectId: null, view: "list", taskId: "t1" })
    ).toBe("/projects")
})

test("la vue par défaut n'est pas écrite dans l'URL", () => {
    expect(buildProjectPath({ projectId: "p1" })).toBe("/projects/p1")
    expect(buildProjectPath({ projectId: "p1", view: "kanban" })).toBe(
        "/projects/p1"
    )
    expect(buildProjectPath({ projectId: "p1", view: "list" })).toBe(
        "/projects/p1/list"
    )
})

test("une tâche ouverte force le segment de vue", () => {
    expect(buildProjectPath({ projectId: "p1", taskId: "t1" })).toBe(
        "/projects/p1/kanban/t1"
    )
})

test("le sprint passe en query string", () => {
    expect(
        buildProjectPath({
            projectId: "p1",
            view: "calendar",
            taskId: "t1",
            sprintId: "s1",
        })
    ).toBe("/projects/p1/calendar/t1?sprint=s1")
})

test("isProjectView filtre les segments inconnus", () => {
    expect(isProjectView("kanban")).toBe(true)
    expect(isProjectView("gantt")).toBe(false)
    expect(isProjectView(undefined)).toBe(false)
})
