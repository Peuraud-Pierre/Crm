/** Type guard for errors with a code property (e.g., Supabase/Postgres errors) */
interface ErrorWithCode {
    code?: string
    message?: string
}

export function isErrorWithCode(error: unknown): error is ErrorWithCode {
    return typeof error === "object" && error !== null && "code" in error
}

export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    if (typeof error === "string") return error
    return "Unknown error"
}

export function isRlsViolation(error: unknown): boolean {
    if (!isErrorWithCode(error)) return false
    return (
        error.code === "42501" ||
        (typeof error.message === "string" &&
            error.message.includes("row-level security"))
    )
}
