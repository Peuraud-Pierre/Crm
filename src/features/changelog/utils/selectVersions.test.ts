import { expect, test } from "@rstest/core"
import type { ChangelogVersion } from "../types/changelog.types"
import { selectLatestPublished, selectPublished } from "./selectVersions"

function version(
    v: string,
    status: ChangelogVersion["status"] = "published"
): ChangelogVersion {
    return {
        id: v,
        version: v,
        deployment_date: "2026-01-01T00:00:00.000Z",
        status,
        summary: null,
        created_by: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
    }
}

test("le tri est SemVer, pas alphabétique", () => {
    // Le piège classique : « 10.0.0 » < « 9.0.0 » en comparaison de
    // chaînes. C'est précisément pour cela que ce tri ne doit exister
    // qu'à un seul endroit.
    const sorted = selectPublished([
        version("9.0.0"),
        version("10.0.0"),
        version("2.1.0"),
    ])

    expect(sorted.map((v) => v.version)).toEqual(["10.0.0", "9.0.0", "2.1.0"])
})

test("les brouillons et les archives sont écartés", () => {
    const sorted = selectPublished([
        version("3.0.0", "draft"),
        version("2.0.0"),
        version("1.0.0", "archived"),
    ])

    expect(sorted.map((v) => v.version)).toEqual(["2.0.0"])
})

test("selectLatestPublished renvoie la plus haute version publiée", () => {
    const latest = selectLatestPublished([
        version("1.0.0"),
        version("1.2.0"),
        version("9.9.9", "draft"),
    ])

    expect(latest?.version).toBe("1.2.0")
})

test("selectLatestPublished renvoie null quand rien n'est publié", () => {
    expect(selectLatestPublished([version("1.0.0", "draft")])).toBeNull()
    expect(selectLatestPublished([])).toBeNull()
})
