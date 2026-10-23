import { Component, type ErrorInfo, type ReactNode } from "react"
import { insertAppLog } from "@/shared/services/logsService"

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

// Récupère l'userId depuis localStorage (Supabase session) sans dépendre du contexte React
function getStoredUserId(): string | null {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (!key?.includes("supabase")) continue
            const raw = localStorage.getItem(key)
            if (!raw) continue
            const parsed = JSON.parse(raw)
            const uid = parsed?.user?.id ?? parsed?.session?.user?.id
            if (uid) return uid
        }
    } catch {
        // ignore
    }
    return null
}

function getSessionId(): string | null {
    try {
        return sessionStorage.getItem("error_logger_session")
    } catch {
        return null
    }
}

export class AppErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // ChunkLoadError = ancien chunk introuvable après déploiement → recharger une fois
        const isChunkError =
            error.name === "ChunkLoadError" ||
            /loading chunk \d+ failed/i.test(error.message) ||
            /loading css chunk/i.test(error.message)

        if (isChunkError) {
            const key = "chunk_reload_attempt"
            const attempts = parseInt(sessionStorage.getItem(key) ?? "0")
            if (attempts < 1) {
                sessionStorage.setItem(key, "1")
                window.location.reload()
                return
            }
        }

        const userId = getStoredUserId()
        if (!userId) return

        const componentStack = info.componentStack ?? undefined

        // Push en fire-and-forget — ne pas bloquer le rendu
        void insertAppLog({
            level: "error",
            message: `[React] ${error.message}`.slice(0, 2000),
            user_id: userId,
            url: window.location.href.slice(0, 500),
            stack: (error.stack ?? "").slice(0, 5000),
            session_id: getSessionId(),
            browser: navigator.userAgent.slice(0, 80),
            context: {
                type: "react_error_boundary",
                componentStack: componentStack?.slice(0, 2000),
            },
        })
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
                    <p className="text-xl font-semibold text-destructive">
                        Une erreur inattendue s&apos;est produite.
                    </p>
                    <p className="text-sm text-muted-foreground max-w-md">
                        L&apos;erreur a été enregistrée automatiquement.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        Recharger la page
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}
