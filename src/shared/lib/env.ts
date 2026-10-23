import { z } from "zod"

// Validation des variables d'environnement exposées côté client par rsbuild.
// Voir docs/PLAN_ASSAINISSEMENT.md §7.3 — PUBLIC_* est le seul préfixe réellement
// exposé (confirmé dans rsbuild.config.ts et le CSP). Convention : tout nouveau
// code lit ces valeurs via `env`, pas via `import.meta.env.` directement
// (voir eslint.config.js, règle no-restricted-syntax).
//
// Les 4 variables requises ci-dessous l'étaient déjà implicitement (typées `string`,
// non optionnelles, dans src/vite-env.d.ts) — ce schéma rend cette exigence explicite
// et échoue au démarrage avec un message clair plutôt que de laisser une erreur
// résulter plus tard d'un appel Supabase avec une URL `undefined`.
const envSchema = z.object({
    PUBLIC_SUPABASE_URL: z.string().min(1),
    PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    PUBLIC_SUPABASE_FUNCTION_URL: z.string().min(1),
    PUBLIC_API_BASE_URL: z.string().min(1),

    PUBLIC_SUPABASE_REALTIME_URL: z.string().optional(),
    PUBLIC_PAKE_URL: z.string().optional(),
    PUBLIC_PAKE_SERVER_ID: z.string().optional(),
    PUBLIC_HIGHLIGHT_PROJECT_ID: z.string().optional(),
    PUBLIC_HIGHLIGHT_BACKEND_URL: z.string().optional(),
    PUBLIC_RETAIL_API_URL: z.string().optional(),
    PUBLIC_ARRIVAGE_API_URL: z.string().optional(),
    PUBLIC_PACKING_API_URL: z.string().optional(),
    PUBLIC_SCAN_DOC_URL: z.string().optional(),
    PUBLIC_INFO_API_URL: z.string().optional(),
    PUBLIC_DISTANCER_API_URL: z.string().optional(),
    PUBLIC_DISTANCER_ORIGIN: z.string().optional(),
    PUBLIC_DISTANCER_ORIGIN_LABEL: z.string().optional(),
    PUBLIC_VITE_BRIDGE_URL: z.string().optional(),
    PUBLIC_VITE_BRIDGE_KEY: z.string().optional(),
    PUBLIC_NEWSLETTER_API_URL: z.string().optional(),
    PUBLIC_ENABLE_CRYPTO_DEBUG: z.string().optional(),
    PUBLIC_N8N_WEBHOOK_URL: z.string().optional(),
    PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
})

// Rsbuild/Rspack ne remplace `import.meta.env.PUBLIC_XXX` par sa valeur littérale
// que lors d'un accès explicite par propriété — passer l'objet `import.meta.env`
// entier (comme ci-dessous en commentaire) ne récupère que les champs internes du
// bundler (MODE, DEV, PROD...), jamais les variables PUBLIC_*. D'où la liste
// explicite : `envSchema.safeParse(import.meta.env)`.
const rawEnv = {
    PUBLIC_SUPABASE_URL: import.meta.env.PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_PUBLISHABLE_KEY: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    PUBLIC_SUPABASE_FUNCTION_URL: import.meta.env.PUBLIC_SUPABASE_FUNCTION_URL,
    PUBLIC_API_BASE_URL: import.meta.env.PUBLIC_API_BASE_URL,

    PUBLIC_SUPABASE_REALTIME_URL: import.meta.env.PUBLIC_SUPABASE_REALTIME_URL,
    PUBLIC_PAKE_URL: import.meta.env.PUBLIC_PAKE_URL,
    PUBLIC_PAKE_SERVER_ID: import.meta.env.PUBLIC_PAKE_SERVER_ID,
    PUBLIC_HIGHLIGHT_PROJECT_ID: import.meta.env.PUBLIC_HIGHLIGHT_PROJECT_ID,
    PUBLIC_HIGHLIGHT_BACKEND_URL: import.meta.env.PUBLIC_HIGHLIGHT_BACKEND_URL,
    PUBLIC_RETAIL_API_URL: import.meta.env.PUBLIC_RETAIL_API_URL,
    PUBLIC_ARRIVAGE_API_URL: import.meta.env.PUBLIC_ARRIVAGE_API_URL,
    PUBLIC_PACKING_API_URL: import.meta.env.PUBLIC_PACKING_API_URL,
    PUBLIC_SCAN_DOC_URL: import.meta.env.PUBLIC_SCAN_DOC_URL,
    PUBLIC_INFO_API_URL: import.meta.env.PUBLIC_INFO_API_URL,
    PUBLIC_DISTANCER_API_URL: import.meta.env.PUBLIC_DISTANCER_API_URL,
    PUBLIC_DISTANCER_ORIGIN: import.meta.env.PUBLIC_DISTANCER_ORIGIN,
    PUBLIC_DISTANCER_ORIGIN_LABEL: import.meta.env.PUBLIC_DISTANCER_ORIGIN_LABEL,
    PUBLIC_VITE_BRIDGE_URL: import.meta.env.PUBLIC_VITE_BRIDGE_URL,
    PUBLIC_VITE_BRIDGE_KEY: import.meta.env.PUBLIC_VITE_BRIDGE_KEY,
    PUBLIC_NEWSLETTER_API_URL: import.meta.env.PUBLIC_NEWSLETTER_API_URL,
    PUBLIC_ENABLE_CRYPTO_DEBUG: import.meta.env.PUBLIC_ENABLE_CRYPTO_DEBUG,
    PUBLIC_N8N_WEBHOOK_URL: import.meta.env.PUBLIC_N8N_WEBHOOK_URL,
    PUBLIC_TURNSTILE_SITE_KEY: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY,
}

function loadEnv() {
    const result = envSchema.safeParse(rawEnv)
    if (!result.success) {
        console.error(
            "[env] Variables d'environnement invalides ou manquantes :",
            result.error.flatten().fieldErrors,
        )
        throw new Error(
            "Configuration d'environnement invalide — voir la console pour le détail des variables manquantes.",
        )
    }
    return result.data
}

export const env = loadEnv()

// Mode du bundler (development/production/test). Exposé ici car env.ts est le
// seul module autorisé à lire import.meta.env (règle no-restricted-syntax).
export const mode = import.meta.env.MODE
export const isDev = import.meta.env.MODE === "development"
