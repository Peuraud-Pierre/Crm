export type MessageTextProps = {
    text?: string
}

export function MessageText({ text }: MessageTextProps) {
    return <div className="whitespace-pre-wrap">{text}</div>
}
