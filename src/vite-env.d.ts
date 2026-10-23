/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly PUBLIC_SUPABASE_URL: string
    readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY: string
    readonly PUBLIC_SUPABASE_FUNCTION_URL: string
    readonly PUBLIC_SUPABASE_REALTIME_URL?: string
    readonly PUBLIC_API_BASE_URL: string
    readonly PUBLIC_PAKE_URL?: string
    readonly PUBLIC_PAKE_SERVER_ID?: string
    readonly PUBLIC_HIGHLIGHT_PROJECT_ID?: string
    readonly PUBLIC_HIGHLIGHT_BACKEND_URL?: string
    readonly PUBLIC_RETAIL_API_URL?: string
    readonly PUBLIC_ARRIVAGE_API_URL?: string
    readonly PUBLIC_PACKING_API_URL?: string
    readonly PUBLIC_SCAN_DOC_URL?: string
    readonly PUBLIC_INFO_API_URL?: string
    readonly PUBLIC_DISTANCER_API_URL?: string
    readonly PUBLIC_DISTANCER_ORIGIN?: string
    readonly PUBLIC_DISTANCER_ORIGIN_LABEL?: string
    readonly PUBLIC_VITE_BRIDGE_URL?: string
    readonly PUBLIC_VITE_BRIDGE_KEY?: string
    readonly PUBLIC_NEWSLETTER_API_URL?: string
    readonly PUBLIC_TURNSTILE_SITE_KEY?: string
    readonly PUBLIC_ENABLE_CRYPTO_DEBUG?: string
    readonly PUBLIC_N8N_WEBHOOK_URL?: string
    readonly MODE: string
    // Add other env variables as needed
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
