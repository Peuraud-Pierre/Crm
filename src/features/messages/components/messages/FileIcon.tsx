import type { ReactNode } from "react"

export type FileIconProps = {
    className?: string
    children: ReactNode
}

export function FileIcon({ className, children }: FileIconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className ?? "h-4 w-4"}
            aria-hidden
        >
            {children}
        </svg>
    )
}
