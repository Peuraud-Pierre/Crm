import { encodeBase64, decodeBase64 } from "tweetnacl-util"

/**
 * Dérive une clé de session à partir d'une passphrase en utilisant PBKDF2.
 * Cette clé dérivée peut être stockée sans risque car il est impossible
 * de retrouver la passphrase originale (fonction à sens unique).
 *
 * @param passphrase - La passphrase en clair (jamais stockée)
 * @param salt - Le salt unique (généré ou récupéré du bundle)
 * @param iterations - Nombre d'itérations PBKDF2 (défaut: 100000)
 * @returns Clé dérivée en base64
 */
export async function deriveSessionKey(
    passphrase: string,
    salt: Uint8Array,
    iterations = 100000
): Promise<string> {
    if (typeof window === "undefined" || !window.crypto?.subtle) {
        throw new Error("Web Crypto API non disponible")
    }

    const encoder = new TextEncoder()
    const passphraseBuffer = encoder.encode(passphrase)

    // Import de la passphrase comme clé PBKDF2
    const baseKey = await window.crypto.subtle.importKey(
        "raw",
        passphraseBuffer,
        "PBKDF2",
        false,
        ["deriveBits"]
    )

    // Dérivation avec PBKDF2
    const derivedBits = await window.crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: salt as BufferSource,
            iterations: iterations,
            hash: "SHA-256",
        },
        baseKey,
        256 // 256 bits = 32 bytes
    )

    return encodeBase64(new Uint8Array(derivedBits))
}

/**
 * Vérifie qu'une passphrase correspond à une clé dérivée stockée.
 *
 * @param passphrase - La passphrase à vérifier
 * @param storedDerivedKey - La clé dérivée stockée (base64)
 * @param salt - Le salt utilisé lors de la dérivation
 * @param iterations - Nombre d'itérations PBKDF2
 * @returns true si la passphrase est correcte
 */
export async function verifyPassphrase(
    passphrase: string,
    storedDerivedKey: string,
    salt: Uint8Array,
    iterations = 100000
): Promise<boolean> {
    try {
        const derivedKey = await deriveSessionKey(passphrase, salt, iterations)
        return derivedKey === storedDerivedKey
    } catch {
        return false
    }
}

/**
 * Hash une passphrase avec SHA-256 pour créer un identifiant de session.
 * Utilisé pour les comparaisons rapides sans stocker la passphrase.
 *
 * @param passphrase - La passphrase à hasher
 * @returns Hash en base64
 */
export async function hashPassphrase(passphrase: string): Promise<string> {
    if (typeof window === "undefined" || !window.crypto?.subtle) {
        throw new Error("Web Crypto API non disponible")
    }

    const encoder = new TextEncoder()
    const data = encoder.encode(passphrase)
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data)
    return encodeBase64(new Uint8Array(hashBuffer))
}

/**
 * Génère un salt aléatoire pour PBKDF2.
 * Ce salt doit être stocké avec le bundle chiffré.
 *
 * @returns Salt de 32 bytes en Uint8Array
 */
export function generateSalt(): Uint8Array {
    if (typeof window === "undefined" || !window.crypto) {
        throw new Error("Web Crypto API non disponible")
    }
    return window.crypto.getRandomValues(new Uint8Array(32))
}

/**
 * Structure pour stocker les informations de dérivation avec le bundle.
 */
export type KeyDerivationInfo = {
    salt_b64: string
    iterations: number
    algorithm: "PBKDF2-SHA256"
}

/**
 * Crée les informations de dérivation à stocker avec le bundle.
 *
 * @param salt - Le salt généré
 * @param iterations - Nombre d'itérations (défaut: 100000)
 * @returns Informations de dérivation
 */
export function createDerivationInfo(
    salt: Uint8Array,
    iterations = 100000
): KeyDerivationInfo {
    return {
        salt_b64: encodeBase64(salt),
        iterations,
        algorithm: "PBKDF2-SHA256",
    }
}

/**
 * Parse les informations de dérivation depuis le bundle.
 *
 * @param info - Les informations de dérivation stockées
 * @returns Salt en Uint8Array
 */
export function parseDerivationInfo(info: KeyDerivationInfo): {
    salt: Uint8Array
    iterations: number
} {
    return {
        salt: decodeBase64(info.salt_b64),
        iterations: info.iterations,
    }
}
