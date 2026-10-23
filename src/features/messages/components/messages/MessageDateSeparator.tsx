export type MessageDateSeparatorProps = {
    label: string
}

/** Filet de séparation entre deux journées du fil de conversation. */
export function MessageDateSeparator({ label }: MessageDateSeparatorProps) {
    return (
        <div className="flex items-center gap-3 py-2" role="separator">
            <span className="h-px flex-1 bg-border/60" aria-hidden />
            <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </span>
            <span className="h-px flex-1 bg-border/60" aria-hidden />
        </div>
    )
}
