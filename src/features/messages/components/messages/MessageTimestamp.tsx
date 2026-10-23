import {
    formatMessageDateTime,
    formatMessageTimeShort,
} from "../../utils/messageFormatting"

export type MessageTimestampProps = {
    createdAt: string
    isMine?: boolean
    read?: boolean
    /** Incrusté sur un média : pas de marge, opacité pleine sur le scrim. */
    compact?: boolean
}

export function MessageTimestamp({
    createdAt,
    isMine,
    read,
    compact,
}: MessageTimestampProps) {
    const label = formatMessageTimeShort(createdAt)
    if (!label) return null
    return (
        <div
            className={
                compact
                    ? "flex items-center gap-1 text-3xs"
                    : "mt-1 flex items-center gap-1 text-3xs opacity-70"
            }
            // La date complète reste accessible au survol : elle n'a pas
            // disparu, elle a seulement quitté le fil de lecture.
            title={formatMessageDateTime(createdAt)}
        >
            <span>{label}</span>
            {isMine && <span>{read ? "✓✓" : "✓"}</span>}
        </div>
    )
}
