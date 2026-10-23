/**
 * Returns the 2-letter initials for a display name or label.
 * e.g. "John Doe" → "JD", "alice" → "AL"
 */
export function getInitials(name: string): string {
    return name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
}

/**
 * Merges a new message into a sorted list, deduplicating by id.
 */
export function sortedMerge<T extends { id: number; createdAt: string }>(
    prev: T[],
    next: T
): T[] {
    if (prev.some((item) => item.id === next.id)) return prev
    return [...prev, next].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
