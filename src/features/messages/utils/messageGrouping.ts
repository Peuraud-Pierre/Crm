import type { CryptedMessage } from "../hooks/useCryptedChat"
import { formatDayLabel, getDayKey } from "./messageFormatting"
import { isVisualMedia } from "./messageMedia"

/**
 * Au-delà de ce délai, deux messages du même expéditeur ouvrent deux salves
 * distinctes : l'identité et l'heure sont réaffichées. Sans ce seuil, une
 * réponse arrivée trois heures plus tard resterait collée à la précédente.
 */
export const RUN_BREAK_MS = 5 * 60 * 1000

export type DaySeparatorItem = {
    kind: "day"
    key: string
    label: string
}

export type MessageItem = {
    kind: "message"
    key: number
    message: CryptedMessage
    /** Premier message d'une salve du même expéditeur. */
    isFirstOfRun: boolean
    /** Dernier message d'une salve — porte l'avatar et la queue de bulle. */
    isLastOfRun: boolean
    /**
     * Afficher le pseudo de l'expéditeur au-dessus de la bulle. Vrai
     * uniquement en groupe, pour un message reçu, en tête de salve.
     */
    showSender: boolean
}

export type AlbumItem = {
    kind: "album"
    key: string
    messages: CryptedMessage[]
    showSender: boolean
}

export type MessageListItem = DaySeparatorItem | MessageItem | AlbumItem

/**
 * Nombre de médias à partir duquel une salve devient une mosaïque.
 *
 * Chaque fichier reste un message chiffré distinct — on ne regroupe qu'à
 * l'affichage. Envoyer cinq photos produisait cinq bulles pleine largeur.
 */
const MIN_ALBUM_SIZE = 2

export type BuildMessageItemsOptions = {
    isGroup?: boolean
    currentUserId?: string | null
    /** Injectable pour les tests ; sert à résoudre « Aujourd'hui » / « Hier ». */
    now?: Date
}

/**
 * Transforme la liste plate de messages en items de rendu : séparateurs de
 * jour + messages annotés de leur position dans une salve.
 *
 * Fonction pure, sans React ni Supabase — c'est ce qui rend les règles de
 * regroupement testables sans monter de composant.
 */
export function buildMessageItems(
    messages: CryptedMessage[],
    { isGroup = false, currentUserId, now }: BuildMessageItemsOptions = {}
): MessageListItem[] {
    const items: MessageListItem[] = []

    for (let i = 0; i < messages.length; i++) {
        const message = messages[i]
        const previous = messages[i - 1]
        const next = messages[i + 1]

        const dayKey = getDayKey(message.createdAt)
        const isNewDay = !previous || getDayKey(previous.createdAt) !== dayKey

        if (isNewDay && dayKey) {
            items.push({
                kind: "day",
                key: dayKey,
                label: formatDayLabel(message.createdAt, "fr-FR", now),
            })
        }

        const isFirstOfRun =
            isNewDay ||
            !previous ||
            previous.senderId !== message.senderId ||
            !isWithinRunWindow(previous.createdAt, message.createdAt)

        const isLastOfRun =
            !next ||
            getDayKey(next.createdAt) !== dayKey ||
            next.senderId !== message.senderId ||
            !isWithinRunWindow(message.createdAt, next.createdAt)

        const isMine = !!currentUserId && message.senderId === currentUserId

        items.push({
            kind: "message",
            key: message.id,
            message,
            isFirstOfRun,
            isLastOfRun,
            showSender: isGroup && !isMine && isFirstOfRun,
        })
    }

    return collapseAlbums(items)
}

/** Un média peut entrer dans une mosaïque tant qu'il est affichable. */
function isAlbumCandidate(item: MessageListItem): item is MessageItem {
    return (
        item.kind === "message" &&
        !item.message.deleted_at &&
        !item.message.attachment_error &&
        isVisualMedia(item.message.file_mime)
    )
}

/**
 * Fusionne les suites de médias d'un même expéditeur en mosaïques.
 *
 * Passe de post-traitement plutôt que branche dans la boucle principale : les
 * règles de salve et de séparateur de jour restent lisibles, et un séparateur
 * interrompt naturellement une mosaïque puisqu'il casse la suite d'items.
 */
function collapseAlbums(items: MessageListItem[]): MessageListItem[] {
    const output: MessageListItem[] = []

    for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (!isAlbumCandidate(item)) {
            output.push(item)
            continue
        }

        const run: MessageItem[] = [item]
        let j = i + 1
        while (j < items.length) {
            const candidate = items[j]
            if (!isAlbumCandidate(candidate)) break
            if (candidate.message.senderId !== item.message.senderId) break
            // Une nouvelle salve rouvre un bloc : deux envois espacés d'une
            // heure ne doivent pas se retrouver dans la même mosaïque.
            if (candidate.isFirstOfRun) break
            run.push(candidate)
            j++
        }

        if (run.length >= MIN_ALBUM_SIZE) {
            output.push({
                kind: "album",
                key: `album-${run[0].message.id}`,
                messages: run.map((entry) => entry.message),
                showSender: run[0].showSender,
            })
            i = j - 1
        } else {
            output.push(item)
        }
    }

    return output
}

function isWithinRunWindow(earlierIso: string, laterIso: string): boolean {
    const earlier = Date.parse(earlierIso)
    const later = Date.parse(laterIso)
    // Une date illisible ne doit pas fusionner deux salves par accident :
    // dans le doute, on coupe.
    if (Number.isNaN(earlier) || Number.isNaN(later)) return false
    return later - earlier <= RUN_BREAK_MS
}
