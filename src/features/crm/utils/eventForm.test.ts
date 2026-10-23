import { expect, test } from "@rstest/core"
import type { activites } from "@/features/crm/types"
import {
    buildEventFormState,
    rdvValidationError,
    secondRdvFrom,
    toLocalDateStr,
    withStartDate,
} from "./eventForm"

const NOW = new Date("2024-03-15T09:30:00Z")

test("création : formulaire vide, tâche attribuée à l'utilisateur courant", () => {
    const s = buildEventFormState(false, null, "user-1", NOW)

    expect(s.mainActivity.title).toBe("")
    expect(s.mainActivity.description).toBe("")
    expect(s.mainActivity.date).toBe(toLocalDateStr(NOW))
    expect(s.rdvData.enabled).toBe(false)
    expect(s.taskData.enabled).toBe(false)
    expect(s.taskData.owner).toBe("user-1")
    expect(s.selectedDelayValue).toBe("")
})

test("édition simple : reprend titre/compte-rendu en date LOCALE (fix fuseau)", () => {
    // Instant tard le soir UTC : tombe potentiellement le lendemain en local.
    const event: activites = {
        id: "act-1",
        client: "client-1",
        date: "2024-06-10T23:30:00Z",
        title: "Appel de suivi",
        content: "RAS, rappeler la semaine prochaine.",
    }

    const s = buildEventFormState(true, event, "user-1", NOW)

    expect(s.mainActivity.title).toBe("Appel de suivi")
    expect(s.mainActivity.description).toBe(
        "RAS, rappeler la semaine prochaine."
    )
    // Doit utiliser le formatage LOCAL, pas toISOString() (UTC).
    expect(s.mainActivity.date).toBe(
        toLocalDateStr(new Date("2024-06-10T23:30:00Z"))
    )
    expect(s.rdvData.enabled).toBe(false)
})

test("édition avec RDV lié : active le panneau RDV avec dates locales", () => {
    const event: activites = {
        id: "act-2",
        client: "client-1",
        date: "2024-06-10T10:00:00Z",
        title: "RDV découverte",
        content: "Préparer le devis.",
        rdv: {
            nom: "rdv visio achat",
            debut: "2024-06-12T08:00:00Z",
            fin: "2024-06-12T09:00:00Z",
            description: "Visio Google Meet",
            owner: "user-2",
            participants: null,
            lieu: null,
            client: null,
        },
    }

    const s = buildEventFormState(true, event, "user-1", NOW)

    expect(s.rdvData.enabled).toBe(true)
    expect(s.rdvData.type).toBe("rdv visio achat")
    expect(s.rdvData.owner).toBe("user-2")
    expect(s.rdvData.startDate).toBe(
        toLocalDateStr(new Date("2024-06-12T08:00:00Z"))
    )
    expect(s.rdvData.description).toBe("Visio Google Meet")
})

const FIRST_RDV = {
    enabled: true, type: "Rdv achat", owner: "u1",
    startDate: "2026-09-30", startTime: "10:00",
    endDate: "2026-09-30", endTime: "11:00", description: "Showroom",
}

test("second RDV : reprend le créneau du premier, type et commercial à choisir", () => {
    expect(secondRdvFrom(FIRST_RDV)).toEqual({
        enabled: true, type: "", owner: "",
        startDate: "2026-09-30", startTime: "10:00",
        endDate: "2026-09-30", endTime: "11:00", description: "",
    })
})

test("un RDV exige un type et une fin après le début", () => {
    expect(rdvValidationError(FIRST_RDV)).toBeNull()
    expect(rdvValidationError({ ...FIRST_RDV, type: "" })).toBe("Veuillez choisir un type de RDV.")
    expect(rdvValidationError({ ...FIRST_RDV, endTime: "10:00" })).toBe("La fin du RDV doit être après le début.")
})

test("décaler le début après la fin repousse la date de fin", () => {
    expect(withStartDate(FIRST_RDV, "2026-10-02").endDate).toBe("2026-10-02")
    expect(withStartDate(FIRST_RDV, "2026-09-29").endDate).toBe("2026-09-30")
})
