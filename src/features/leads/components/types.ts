export interface Lead {
    id: number
    name: string
    email: string
    phone: string
    message: string
    location: string | null
    activity: string
    budget: string | null
    arrivance: string | null
    urgency: string | null
    created_at: string
    distance_km: number
    city_found: string
}
