import { supabase } from "@/integrations/supabase/client"
import {
    DISTANCER_API_URL,
    DISTANCER_ORIGIN,
    type DistanceResult,
} from "@/features/crm/utils/distance"

type DistanceApiResponse = {
    results?: Array<{
        origin: string
        destination: string
        meters: number
        seconds: number
    }>
    missing?: Array<{ destination: string; reason: string }>
}

export async function calculateDistance(
    destination: string,
    origin: string = DISTANCER_ORIGIN
): Promise<DistanceResult | null> {
    const dest = destination?.trim()
    if (!dest) return null

    const session = (await supabase.auth.getSession()).data.session
    const token = session?.access_token
    if (!token) throw new Error("Non authentifié")

    const res = await fetch(`${DISTANCER_API_URL}/distances`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ origin, destinations: [dest] }),
    })

    if (!res.ok) {
        throw new Error(`Distancer API: HTTP ${res.status}`)
    }

    const data = (await res.json()) as DistanceApiResponse
    const hit = data.results?.find((r) => r.destination === dest) ??
        data.results?.[0]
    if (!hit) return null

    return { meters: hit.meters, seconds: hit.seconds }
}
