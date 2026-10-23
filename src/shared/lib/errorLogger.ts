import { insertAppLog } from "@/shared/services/logsService"

let sessionId: string | null = null
let currentUserId: string | null = null
let currentUserEmail: string | null = null
let initialized = false

function getSessionId(): string {
    if (!sessionId) {
        sessionId = sessionStorage.getItem("error_logger_session")
        if (!sessionId) {
            sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
            sessionStorage.setItem("error_logger_session", sessionId)
        }
    }
    return sessionId
}

function getBrowser(): string {
    const ua = navigator.userAgent
    if (ua.includes("Firefox/")) return `Firefox ${ua.match(/Firefox\/([\d.]+)/)?.[1] ?? ""}`
    if (ua.includes("Edg/")) return `Edge ${ua.match(/Edg\/([\d.]+)/)?.[1] ?? ""}`
    if (ua.includes("Chrome/")) return `Chrome ${ua.match(/Chrome\/([\d.]+)/)?.[1] ?? ""}`
    if (ua.includes("Safari/")) return `Safari ${ua.match(/Version\/([\d.]+)/)?.[1] ?? ""}`
    return ua.slice(0, 80)
}

async function pushLog(
    level: "error" | "warn" | "info",
    message: string,
    options: {
        stack?: string
        context?: Record<string, unknown>
        url?: string
    } = {}
) {
    // Sans userId on ne peut pas insérer (RLS)
    if (!currentUserId) return

    try {
        await insertAppLog({
            level,
            message: message.slice(0, 2000),
            user_id: currentUserId,
            user_email: currentUserEmail,
            url: (options.url ?? window.location.href).slice(0, 500),
            stack: options.stack ? options.stack.slice(0, 5000) : null,
            session_id: getSessionId(),
            browser: getBrowser(),
            context: options.context ?? null,
        })
    } catch {
        // Ne pas propager les erreurs du logger lui-même
    }
}

// Mots-clés à ignorer dans console.error (bruit non actionnable)
const CONSOLE_IGNORE = [
    "Warning:",
    "ResizeObserver loop",
    "Non-passive event listener",
    "Service worker registration skipped",
]

function serializeArg(arg: unknown): string {
    if (arg instanceof Error) return arg.message
    if (typeof arg === "object" && arg !== null) {
        try { return JSON.stringify(arg) } catch { return String(arg) }
    }
    return String(arg ?? "")
}

const _originalConsoleError = console.error.bind(console)
const _originalConsoleWarn = console.warn.bind(console)

function patchConsole() {
    console.error = (...args: unknown[]) => {
        _originalConsoleError(...args)

        const message = args.map(serializeArg).join(" ")
        if (CONSOLE_IGNORE.some((s) => message.includes(s))) return

        // Extraire le contexte structuré si le dernier arg est un objet d'erreur Supabase
        const lastArg = args[args.length - 1]
        const context: Record<string, unknown> =
            lastArg !== null &&
            typeof lastArg === "object" &&
            !Array.isArray(lastArg)
                ? (lastArg as Record<string, unknown>)
                : {}

        pushLog("error", message.slice(0, 2000), { context })
    }

    console.warn = (...args: unknown[]) => {
        _originalConsoleWarn(...args)

        const message = args.map(serializeArg).join(" ")
        if (CONSOLE_IGNORE.some((s) => message.includes(s))) return

        pushLog("warn", message.slice(0, 2000))
    }
}

function handleWindowError(event: ErrorEvent) {
    // Ignorer les ChunkLoadErrors (gérés séparément avec reload)
    if (event.error?.name === "ChunkLoadError") return

    pushLog("error", event.message || "Unknown error", {
        stack: event.error?.stack,
        context: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
        },
    })
}

function handleUnhandledRejection(event: PromiseRejectionEvent) {
    if (event.reason?.name === "ChunkLoadError") return

    const message =
        event.reason instanceof Error
            ? event.reason.message
            : String(event.reason ?? "Unhandled promise rejection")

    pushLog("error", message, {
        stack: event.reason instanceof Error ? event.reason.stack : undefined,
        context: { type: "unhandledrejection" },
    })
}

export function initErrorLogger(userId: string, userEmail?: string) {
    currentUserId = userId
    currentUserEmail = userEmail ?? null

    if (initialized) return
    initialized = true

    patchConsole()
    window.addEventListener("error", handleWindowError)
    window.addEventListener("unhandledrejection", handleUnhandledRejection)
}

export function resetErrorLogger() {
    currentUserId = null
    currentUserEmail = null
}

// API publique pour log manuel
export const errorLogger = {
    error: (message: string, context?: Record<string, unknown>) =>
        pushLog("error", message, { context }),
    warn: (message: string, context?: Record<string, unknown>) =>
        pushLog("warn", message, { context }),
    info: (message: string, context?: Record<string, unknown>) =>
        pushLog("info", message, { context }),
}
