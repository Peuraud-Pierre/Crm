/**
 * Utilitaire pour retry avec backoff exponentiel
 * Utilisé pour les appels à Microsoft Graph API
 */

export interface RetryConfig {
    maxRetries: number
    baseDelayMs: number
    maxDelayMs: number
    retryableStatuses: number[]
}

const defaultConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableStatuses: [429, 500, 502, 503, 504],
}

export class RetryableError extends Error {
    constructor(
        message: string,
        public status: number,
        public response?: Response
    ) {
        super(message)
        this.name = "RetryableError"
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Exécute une opération avec retry automatique en cas d'échec
 * @param operation Fonction à exécuter
 * @param config Configuration du retry
 * @returns Résultat de l'opération
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
): Promise<T> {
    const finalConfig = { ...defaultConfig, ...config }
    let lastError: unknown

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
        try {
            return await operation()
        } catch (error) {
            lastError = error

            // Ne pas réessayer si l'erreur n'est pas retryable
            if (
                error instanceof RetryableError &&
                !finalConfig.retryableStatuses.includes(error.status)
            ) {
                throw error
            }

            // Ne pas réessayer si erreur non-retryable ou max attempts atteint
            if (
                !(error instanceof RetryableError) ||
                attempt === finalConfig.maxRetries
            ) {
                break
            }

            // Calculer le délai avec backoff exponentiel
            const delay = Math.min(
                finalConfig.baseDelayMs * Math.pow(2, attempt),
                finalConfig.maxDelayMs
            )

            // Respecter le header Retry-After si présent (rate limiting Microsoft)
            let waitTime = delay
            const errResponse = (error as { response?: { headers?: Headers } })
                .response
            if (errResponse?.headers?.has("Retry-After")) {
                const retryAfter = errResponse.headers.get("Retry-After")
                if (retryAfter) {
                    const retryAfterSeconds = parseInt(retryAfter, 10)
                    if (!isNaN(retryAfterSeconds)) {
                        waitTime = retryAfterSeconds * 1000
                    }
                }
            }

            console.log(
                `[Outlook Sync] Retry attempt ${attempt + 1}/${finalConfig.maxRetries} after ${waitTime}ms`
            )

            await sleep(waitTime)
        }
    }

    throw lastError!
}

/**
 * Wrapper pour fetch avec gestion d'erreurs retryables
 * @param url URL à fetcher
 * @param options Options fetch
 * @param retryConfig Configuration du retry
 * @returns Réponse fetch
 */
export async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retryConfig: Partial<RetryConfig> = {}
): Promise<Response> {
    return withRetry(async () => {
        const response = await fetch(url, options)

        if (!response.ok) {
            throw new RetryableError(
                `HTTP ${response.status}: ${response.statusText}`,
                response.status,
                response
            )
        }

        return response
    }, retryConfig)
}
