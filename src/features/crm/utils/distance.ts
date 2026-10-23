import { env } from "@/shared/lib/env"

export const DISTANCER_API_URL =
    env.PUBLIC_DISTANCER_API_URL || "https://map.nokk-project.example"

// Adresse pré-configurée (origine) — surchargeable par variable d'env.
export const DISTANCER_ORIGIN: string =
    env.PUBLIC_DISTANCER_ORIGIN ||
    "12 rue de l'Exemple, 75000 Paris, France"

// Label court pour l'UI (le tooltip n'a pas besoin de l'adresse complète)
export const DISTANCER_ORIGIN_LABEL: string =
    env.PUBLIC_DISTANCER_ORIGIN_LABEL || "Paris"

export type DistanceResult = {
    meters: number
    seconds: number
}

export function formatDistance({ meters, seconds }: DistanceResult): string {
    const km = meters / 1000
    const kmStr =
        km >= 100
            ? `${Math.round(km)} km`
            : `${km.toFixed(km >= 10 ? 0 : 1)} km`

    const totalMinutes = Math.round(seconds / 60)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    const durationStr = h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m} min`

    return `${kmStr} · ${durationStr}`
}
