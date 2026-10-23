import { cn } from "@/shared/lib/utils"
import { useEffect, useRef, useState } from "react"

interface ClampedTextProps {
    text: string
    lines?: number
}

export function ClampedText({ text, lines = 3 }: ClampedTextProps) {
    const [expanded, setExpanded] = useState(false)
    const [isClamped, setIsClamped] = useState(false)
    const contentRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = contentRef.current
        if (!el) return
        // Post-layout DOM measurement; cannot be derived during render
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setIsClamped(el.scrollHeight > el.clientHeight)
    }, [text])

    return (
        <div className="mt-1 text-xs text-muted-foreground">
            <div
                ref={contentRef}
                className={cn(!expanded && `clamp clamp-${lines}`)}
            >
                {text}
            </div>

            {(isClamped || expanded) && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="mt-1 text-[11px] font-bold hover:underline"
                >
                    {expanded ? "Voir moins" : "Voir plus"}
                </button>
            )}
        </div>
    )
}
