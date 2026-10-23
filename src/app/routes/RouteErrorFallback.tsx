import { useRouteError } from "react-router"
import { useEffect } from "react"

function isChunkError(error: unknown): boolean {
    if (error instanceof Error) {
        return (
            error.name === "ChunkLoadError" ||
            /loading chunk/i.test(error.message) ||
            /loading css chunk/i.test(error.message) ||
            /dynamically imported module/i.test(error.message) ||
            /is not defined/i.test(error.message) ||
            /failed to fetch/i.test(error.message)
        )
    }
    return false
}

export default function RouteErrorFallback() {
    const error = useRouteError()

    useEffect(() => {
        if (isChunkError(error)) {
            const key = "chunk_reload_attempt"
            const attempts = parseInt(sessionStorage.getItem(key) ?? "0")
            if (attempts < 1) {
                sessionStorage.setItem(key, "1")
                window.location.reload()
                return
            }
        }
    }, [error])

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
            <p className="text-xl font-semibold text-red-600">
                Une erreur est survenue lors du chargement de la page.
            </p>
            <p className="text-sm text-gray-500 max-w-md">
                Cela peut arriver après une mise à jour. Rechargez la page pour
                corriger le problème.
            </p>
            <button
                onClick={() => {
                    sessionStorage.removeItem("chunk_reload_attempt")
                    window.location.reload()
                }}
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary-hover"
            >
                Recharger la page
            </button>
        </div>
    )
}
