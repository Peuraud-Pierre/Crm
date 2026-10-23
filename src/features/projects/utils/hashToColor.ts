import { MEMBER_COLOR_PALETTE } from "@/features/projects/project_constants"

export function hashToColor(value: string | null | undefined): string {
    if (!value) return "hsl(var(--muted-foreground))"
    let hash = 0
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i)
        hash |= 0
    }
    const index = Math.abs(hash) % MEMBER_COLOR_PALETTE.length
    return MEMBER_COLOR_PALETTE[index]
}
