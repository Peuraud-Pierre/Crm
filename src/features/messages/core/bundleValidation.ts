import type { StoredKeyPair } from "./storage"
import { decryptKeyBundle } from "./crypto"
import { fetchRemoteBundle } from "../services/keyBundleService"
import { readEncryptedBundle, writeEncryptedBundle } from "./storage"
import { cryptoLogger } from "@/features/messages/core/logger"

export type BundleData = {
    keyPair: StoredKeyPair
    ratchetKeyPair: StoredKeyPair
    signKeyPair: StoredKeyPair
}

export type BundleRecoveryResult = {
    bundle: BundleData | null
    source: "local" | "remote" | "none"
    errorMessage: string | null
    diagnostics: {
        hasLocal: boolean
        localValid: boolean
        hasRemote: boolean
        remoteValid: boolean
    }
}

/**
 * Valide le format d'un bundle chiffré pour détecter les corruptions
 */
export function validateBundleFormat(bundle: unknown): boolean {
    try {
        if (!bundle) return false
        const parsed = typeof bundle === "string" ? JSON.parse(bundle) : bundle
        if (typeof parsed !== "object" || !parsed) return false
        const typed = parsed as {
            salt_b64?: unknown
            iv_b64?: unknown
            ciphertext_b64?: unknown
        }
        return !!(
            typed.salt_b64 &&
            typeof typed.salt_b64 === "string" &&
            typed.iv_b64 &&
            typeof typed.iv_b64 === "string" &&
            typed.ciphertext_b64 &&
            typeof typed.ciphertext_b64 === "string"
        )
    } catch {
        return false
    }
}

/**
 * Tente de récupérer un bundle de clés en essayant local et distant en parallèle
 * Stratégie: essayer local d'abord, puis distant si échec
 */
export async function recoverKeyBundle(
    userId: string,
    passphrase: string
): Promise<BundleRecoveryResult> {
    const result: BundleRecoveryResult = {
        bundle: null,
        source: "none",
        errorMessage: null,
        diagnostics: {
            hasLocal: false,
            localValid: false,
            hasRemote: false,
            remoteValid: false,
        },
    }

    // Récupérer les bundles local et distant
    const localBundle = readEncryptedBundle()
    const remoteBundlePromise = fetchRemoteBundle(userId)

    // Valider le format du bundle local
    result.diagnostics.hasLocal = !!localBundle
    result.diagnostics.localValid = localBundle
        ? validateBundleFormat(localBundle)
        : false

    if (localBundle && !result.diagnostics.localValid) {
        cryptoLogger.warn(
            "⚠️ Bundle local corrompu, il sera ignoré et remplacé par le bundle distant"
        )
    }

    // Essayer le bundle local si valide
    if (localBundle && result.diagnostics.localValid) {
        try {
            const parsed = JSON.parse(localBundle) as {
                salt_b64: string
                iv_b64: string
                ciphertext_b64: string
            }
            cryptoLogger.log("🔐 Tentative de déchiffrement du bundle local...")
            const decrypted = await decryptKeyBundle(parsed, passphrase)
            if (decrypted) {
                result.bundle = decrypted as BundleData
                result.source = "local"
                cryptoLogger.log("✅ Bundle local déchiffré avec succès")
                return result
            }
        } catch (error) {
            cryptoLogger.warn("❌ Échec déchiffrement bundle local:", error)
        }
    }

    // Si le bundle local a échoué ou n'existe pas, essayer le distant
    const remoteBundle = await remoteBundlePromise
    result.diagnostics.hasRemote = !!remoteBundle
    result.diagnostics.remoteValid = remoteBundle
        ? validateBundleFormat(remoteBundle)
        : false

    if (remoteBundle && result.diagnostics.remoteValid) {
        try {
            const remoteParsed = remoteBundle as {
                salt_b64: string
                iv_b64: string
                ciphertext_b64: string
            }
            cryptoLogger.log(
                "🔐 Tentative de déchiffrement du bundle distant..."
            )
            const remoteDecrypted = await decryptKeyBundle(
                remoteParsed,
                passphrase
            )
            if (remoteDecrypted) {
                result.bundle = remoteDecrypted as BundleData
                result.source = "remote"
                // Sauvegarder le bundle distant localement
                writeEncryptedBundle(remoteParsed)
                cryptoLogger.log(
                    "✅ Bundle distant déchiffré et synchronisé localement"
                )
                return result
            }
        } catch (error) {
            cryptoLogger.warn("❌ Échec déchiffrement bundle distant:", error)
        }
    } else if (remoteBundle && !result.diagnostics.remoteValid) {
        cryptoLogger.warn("⚠️ Bundle distant corrompu")
    }

    // Générer un message d'erreur détaillé
    const { hasLocal, localValid, hasRemote, remoteValid } = result.diagnostics

    if (hasLocal && localValid && hasRemote && remoteValid) {
        result.errorMessage =
            "Passphrase invalide pour les bundles local et distant"
    } else if (hasLocal && localValid && !hasRemote) {
        result.errorMessage =
            "Passphrase invalide pour le bundle local (pas de bundle distant disponible)"
    } else if (!hasLocal && hasRemote && remoteValid) {
        result.errorMessage = "Passphrase invalide pour le bundle distant"
    } else if (localBundle && !localValid && (!hasRemote || !remoteValid)) {
        result.errorMessage =
            "Bundle local corrompu et aucun bundle distant valide disponible. Utilise 'Supprimer et recréer'."
    } else if (!hasLocal && !hasRemote) {
        result.errorMessage =
            "Aucun bundle de clés trouvé. Un nouveau sera créé."
    } else {
        result.errorMessage = "Impossible de récupérer les clés de chiffrement"
    }

    return result
}

/**
 * Diagnostic de l'état actuel des bundles
 */
export async function diagnoseBundleStatus(userId: string): Promise<{
    local: { exists: boolean; valid: boolean }
    remote: { exists: boolean; valid: boolean }
    synchronized: boolean
}> {
    const localBundle = readEncryptedBundle()
    const remoteBundle = await fetchRemoteBundle(userId)

    const localValid = localBundle ? validateBundleFormat(localBundle) : false
    const remoteValid = remoteBundle
        ? validateBundleFormat(remoteBundle)
        : false

    // Vérifier si les bundles sont identiques (synchronized)
    let synchronized = false
    if (localBundle && remoteBundle && localValid && remoteValid) {
        try {
            const localParsed = JSON.parse(localBundle)
            synchronized =
                JSON.stringify(localParsed) === JSON.stringify(remoteBundle)
        } catch {
            synchronized = false
        }
    }

    return {
        local: {
            exists: !!localBundle,
            valid: localValid,
        },
        remote: {
            exists: !!remoteBundle,
            valid: remoteValid,
        },
        synchronized,
    }
}
