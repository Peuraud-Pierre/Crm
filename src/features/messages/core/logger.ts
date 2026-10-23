import type { Json } from "@/integrations/supabase/types"
import { env } from "@/shared/lib/env"
import { insertAppLog } from "../services/appLogsService"

type LogLevel = "error" | "warn" | "info"

// Logs verbeux (log/info/success) gatés par PUBLIC_ENABLE_CRYPTO_DEBUG — voir DEBUG_CRYPTO.md.
// warn/error restent toujours actifs : ce sont de vraies anomalies, pas du diagnostic.
const isCryptoDebugEnabled = env.PUBLIC_ENABLE_CRYPTO_DEBUG === "true"

export type LogPayload = {
    code: string
    scope: string
    level?: LogLevel
    message?: string
    stack?: string
    userId?: string | null
    meta?: Record<string, unknown>
    occurredAt?: string
}

export const cryptoLogger = {
    log: (...args: unknown[]) => isCryptoDebugEnabled && console.log(...args),
    info: (...args: unknown[]) => isCryptoDebugEnabled && console.info(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    error: (...args: unknown[]) => console.error(...args),
}

export const eventLogger = {
    success: (message: string, meta?: Record<string, unknown>) =>
        isCryptoDebugEnabled && console.log(message, meta),
    info: (message: string, meta?: Record<string, unknown>) =>
        isCryptoDebugEnabled && console.info(message, meta),
    warn: (message: string, meta?: Record<string, unknown>) =>
        console.warn(message, meta),
    error: (message: string, meta?: Record<string, unknown>) =>
        console.error(message, meta),
}

export async function logCriticalError(payload: LogPayload) {
    try {
        const occurredAt = payload.occurredAt ?? new Date().toISOString()

        // Use actual userId (already a UUID) or "anonymous" UUID
        const anonymousUuid = "00000000-0000-0000-0000-000000000000"
        const userId = payload.userId ?? anonymousUuid

        // Sanitize context to ensure it's valid JSON
        const context: Record<string, Json> = {
            code: payload.code,
            scope: payload.scope,
        }

        if (payload.stack) {
            context.stack = payload.stack.substring(0, 1000) // Limit stack size
        }

        if (payload.meta) {
            // Convert meta to plain JSON, removing any functions/undefined
            context.meta = JSON.parse(JSON.stringify(payload.meta))
        }

        const { error } = await insertAppLog({
            level: payload.level ?? "error",
            message: (payload.message ?? payload.code).substring(0, 500), // Limit message size
            user_id: userId,
            context: context as Json,
            created_at: occurredAt,
        })

        if (error) {
            console.error("Erreur envoi log remote:", error)
        }
    } catch (error) {
        console.error("Erreur envoi log remote:", error)
    }
}
