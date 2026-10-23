import type { ReactNode } from "react"

/**
 * Renders text with bold markers (**text**)
 */
export function renderBold(text: string, boldClass: string): ReactNode[] {
    return text.split(/(\*\*.*?\*\*)/g).map((part) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return (
                <strong key={part} className={`font-bold ${boldClass}`}>
                    {part.slice(2, -2)}
                </strong>
            )
        }
        return part
    })
}
