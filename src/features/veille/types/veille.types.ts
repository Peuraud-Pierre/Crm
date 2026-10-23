export interface VeilleBulletPoint {
    titre: string
    resume: string
    date_publication: string
    urls: string[]
    mots_cles: string[]
}

export interface VeilleSection {
    titre: string
    bullet_points: VeilleBulletPoint[]
}

export interface VeilleActualitePrincipale {
    titre: string
    resume: string
    date_publication: string
    urls: string[]
    mots_cles: string[]
}

export interface VeilleExecutiveSummary {
    date_veille: string
    periode: string
    secteurs_cibles: string[]
    actualites_principales: VeilleActualitePrincipale[]
    sections: VeilleSection[]
}

export interface VeilleMetadata {
    citations?: string[]
    [key: string]: unknown
}

export interface WatchConfig {
    id: number
    name: string
    topic: string
    language: string
    horizon: string
    persona: string
    active: boolean
    created_at: string
    service_ids?: string[] | null
}

export interface VeilleItem {
    id: string
    created_at: string
    period_start: string | null
    period_end: string | null
    topic: string
    title?: string | null
    frequency: string | null
    source_model: string | null
    analysis_model: string | null
    raw_research: string | null
    executive_summary: string | null
    risks: string | null
    opportunities: string | null
    recommended_actions: string | null
    importance_score: number | null
    tags: string[] | null
    metadata: VeilleMetadata | null
}
