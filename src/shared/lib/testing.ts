import { afterEach, beforeEach } from "@rstest/core"

/** Canaux console interceptés par silenceExpectedLogs. */
const CHANNELS = ["error", "warn", "log"] as const

/**
 * Neutralise les messages console ATTENDUS d'un fichier de test — ceux que le
 * code applicatif émet sur un chemin volontairement provoqué (mock rejeté,
 * donnée invalide passée exprès) ou par simple traçage. Sans ça, ces tests
 * impriment leur message suivi d'une pile d'appels majoritairement interne à
 * rstest, ce qui noie la sortie de la suite.
 *
 * Le filtrage se fait par préfixe, et non par un `console.error = () => {}`
 * global : les avertissements de React (« An update to X inside a test was not
 * wrapped in act(...) », « two children with the same key ») passent par le même
 * canal et doivent rester visibles — ils signalent de vrais défauts,
 * contrairement aux logs applicatifs.
 *
 * Couvre error, warn et log. À appeler au niveau du module, avant les tests :
 *   silenceExpectedLogs("[useBibli]", "[useBiblioQR]")
 */
export function silenceExpectedLogs(...prefixes: string[]) {
    const originals: Partial<Record<(typeof CHANNELS)[number], typeof console.log>> = {}

    beforeEach(() => {
        for (const channel of CHANNELS) {
            const original = console[channel]
            originals[channel] = original
            console[channel] = (...args: unknown[]) => {
                const first = typeof args[0] === "string" ? args[0] : ""
                if (prefixes.some((prefix) => first.startsWith(prefix))) return
                original(...args)
            }
        }
    })

    afterEach(() => {
        for (const channel of CHANNELS) {
            const original = originals[channel]
            if (original) console[channel] = original
        }
    })
}
