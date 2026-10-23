// ── services/retailLayoutService.ts ───────────────────────────────────────────
// Couche service — API externe de la console retail (`/api/v1/external`),
// authentifiée par le JWT Supabase de l'utilisateur, comme les tickets
// (`features/tickets/retail/retailApi.ts`).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useRetailLayout.ts

import { supabase } from "@/integrations/supabase/client"
import { env } from "@/shared/lib/env"
import type { LayoutPayload } from "@/features/magasins/utils/layoutPayload"

export interface RetailShop {
    id: string
    name: string
    type: string
    address: string | null
}

/** Sans URL, le pont retail n'est pas proposé. */
export const retailConfigured = Boolean(env.PUBLIC_RETAIL_API_URL)

async function retailFetch(path: string, init?: RequestInit): Promise<Response> {
    const { data } = await supabase.auth.getSession()
    const res = await fetch(`${env.PUBLIC_RETAIL_API_URL}/api/v1/external${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        },
    })
    if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Retail API error ${res.status}`)
    }
    return res
}

export async function fetchRetailShops(): Promise<RetailShop[]> {
    const res = await retailFetch("/shops")
    return (await res.json()) as RetailShop[]
}

export async function publishLayout(shopId: string, payload: LayoutPayload): Promise<void> {
    await retailFetch(`/shops/${shopId}/layout`, { method: "PUT", body: JSON.stringify(payload) })
}

export async function unpublishLayout(shopId: string): Promise<void> {
    await retailFetch(`/shops/${shopId}/layout`, { method: "DELETE" })
}
