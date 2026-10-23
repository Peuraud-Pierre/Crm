import { expect, test } from "@rstest/core"
import { getSubmitState } from "./submitState"

const base = {
    subject: "Nouveautés",
    message: "Bonjour",
    recipientCount: 12,
    hasActiveSend: false,
    busy: false,
}

test("tout est rempli : test et envoi possibles", () => {
    expect(getSubmitState(base)).toEqual({ canTest: true, canSend: true, reason: null })
})

test("sujet ou message vide (espaces compris) : rien n'est possible", () => {
    expect(getSubmitState({ ...base, subject: "   " })).toMatchObject({
        canTest: false,
        canSend: false,
        reason: "Renseignez le sujet et le message.",
    })
    expect(getSubmitState({ ...base, message: "" }).canSend).toBe(false)
})

test("aucun abonné : test possible, envoi impossible", () => {
    expect(getSubmitState({ ...base, recipientCount: 0 })).toEqual({
        canTest: true,
        canSend: false,
        reason: "Aucun client abonné avec une adresse email.",
    })
})

test("compteur pas encore chargé : envoi impossible", () => {
    expect(getSubmitState({ ...base, recipientCount: null }).canSend).toBe(false)
})

test("envoi déjà en cours : test possible, envoi impossible", () => {
    expect(getSubmitState({ ...base, hasActiveSend: true })).toEqual({
        canTest: true,
        canSend: false,
        reason: "Un envoi est en cours.",
    })
})

test("requête en vol : tout est bloqué", () => {
    expect(getSubmitState({ ...base, busy: true })).toMatchObject({
        canTest: false,
        canSend: false,
    })
})

test("sujet trop long : rien n'est possible", () => {
    expect(getSubmitState({ ...base, subject: "a".repeat(201) })).toMatchObject({
        canTest: false,
        canSend: false,
        reason: "Le sujet dépasse 200 caractères.",
    })
})
