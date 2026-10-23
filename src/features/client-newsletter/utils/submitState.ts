export const MAX_SUBJECT_LENGTH = 200
export const MAX_MESSAGE_LENGTH = 20000

interface SubmitInput {
    subject: string
    message: string
    recipientCount: number | null
    hasActiveSend: boolean
    busy: boolean
}

interface SubmitState {
    canTest: boolean
    canSend: boolean
    reason: string | null
}

/**
 * Règles d'activation des boutons « M'envoyer un test » / « Envoyer ».
 * Mêmes limites que la validation serveur (internal/clientnews/compose.go).
 */
export function getSubmitState(input: SubmitInput): SubmitState {
    const subject = input.subject.trim()
    const message = input.message.trim()

    const draftError =
        !subject || !message
            ? "Renseignez le sujet et le message."
            : [...subject].length > MAX_SUBJECT_LENGTH
              ? "Le sujet dépasse 200 caractères."
              : [...message].length > MAX_MESSAGE_LENGTH
                ? "Le message dépasse 20 000 caractères."
                : null

    if (draftError) return { canTest: false, canSend: false, reason: draftError }
    if (input.busy) return { canTest: false, canSend: false, reason: null }
    if (input.hasActiveSend)
        return { canTest: true, canSend: false, reason: "Un envoi est en cours." }
    if (input.recipientCount === 0)
        return {
            canTest: true,
            canSend: false,
            reason: "Aucun client abonné avec une adresse email.",
        }
    if (input.recipientCount === null)
        return { canTest: true, canSend: false, reason: null }
    return { canTest: true, canSend: true, reason: null }
}
