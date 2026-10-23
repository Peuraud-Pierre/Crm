import { expect, test } from "@rstest/core"
import type { Announcement } from "../types/announcement.types"
import { compareForDisplay, getAnnouncementStatus } from "./announcementStatus"

const NOW = Date.parse("2026-08-24T12:00:00.000Z")
const HOUR = 3600_000

function make(overrides: Partial<Announcement> = {}): Announcement {
    return {
        id: "a1",
        created_at: "2026-08-01T00:00:00.000Z",
        titre: "Titre",
        type: "news",
        image: null,
        description: null,
        link: null,
        start_date: new Date(NOW - HOUR).toISOString(),
        end_date: null,
        archived_at: null,
        pinned: false,
        target_role_ids: [],
        target_service_ids: [],
        author_id: null,
        author: null,
        excerpt: null,
        body_markdown: null,
        event_date: null,
        ...overrides,
    }
}

test("une annonce dont la fenêtre est ouverte est en ligne", () => {
    expect(getAnnouncementStatus(make(), NOW)).toBe("online")
})

test("une annonce sans date de fin reste en ligne indéfiniment", () => {
    const old = make({
        start_date: new Date(NOW - 1000 * HOUR).toISOString(),
        end_date: null,
    })
    expect(getAnnouncementStatus(old, NOW)).toBe("online")
})

test("une annonce dont le début est à venir est planifiée", () => {
    const planned = make({ start_date: new Date(NOW + HOUR).toISOString() })
    expect(getAnnouncementStatus(planned, NOW)).toBe("planned")
})

test("une annonce dont la fin est passée est expirée", () => {
    const expired = make({
        start_date: new Date(NOW - 2 * HOUR).toISOString(),
        end_date: new Date(NOW - HOUR).toISOString(),
    })
    expect(getAnnouncementStatus(expired, NOW)).toBe("expired")
})

test("l'archivage prime sur la fenêtre de diffusion", () => {
    // Une annonce archivée ne doit jamais ressortir comme « en ligne »,
    // même si ses dates sont parfaitement valides.
    const archived = make({ archived_at: "2026-08-20T00:00:00.000Z" })
    expect(getAnnouncementStatus(archived, NOW)).toBe("archived")
})

test("la fin de fenêtre est exclusive à l'instant pile", () => {
    const boundary = make({
        start_date: new Date(NOW - HOUR).toISOString(),
        end_date: new Date(NOW).toISOString(),
    })
    expect(getAnnouncementStatus(boundary, NOW)).toBe("expired")
})

test("les épinglées passent devant, puis les plus récentes", () => {
    const older = make({
        id: "older",
        start_date: new Date(NOW - 10 * HOUR).toISOString(),
    })
    const newer = make({
        id: "newer",
        start_date: new Date(NOW - HOUR).toISOString(),
    })
    const pinnedOld = make({
        id: "pinned",
        pinned: true,
        start_date: new Date(NOW - 100 * HOUR).toISOString(),
    })

    const sorted = [older, newer, pinnedOld].sort(compareForDisplay)
    expect(sorted.map((a) => a.id)).toEqual(["pinned", "newer", "older"])
})
