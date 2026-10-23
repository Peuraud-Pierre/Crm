/**
 * Extrait un message d'erreur lisible depuis un `unknown` (typiquement un catch).
 * Remplace les patterns `catch (err: any) { err.message }`.
 */
export function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message
    if (typeof err === "string") return err
    if (err && typeof err === "object") {
        const maybe = err as { message?: unknown; error?: unknown }
        if (typeof maybe.message === "string") return maybe.message
        if (typeof maybe.error === "string") return maybe.error
    }
    return "Erreur inconnue"
}
