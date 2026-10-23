import type { Json } from "@/integrations/supabase/types"

export type StoredKeyPair = {
    publicKey: string
    secretKey: string
}

export type DhRatchetState = {
    root_b64: string
    dh_self_pub_b64: string
    dh_self_priv_b64: string
    dh_remote_pub_b64: string
    send_ck_b64: string
    recv_ck_b64: string
    send_count: number
    recv_count: number
}

const KEYPAIR_STORAGE_KEY = "cryptedmessage:keypair"
const RATCHET_STORAGE_KEY = "cryptedmessage:ratchetKeypair"
const SIGN_KEYPAIR_STORAGE_KEY = "cryptedmessage:signKeypair"
const ENCRYPTED_BUNDLE_KEY = "cryptedmessage:keybundle:v1"
const SESSION_UNLOCK_KEY = "cryptedmessage:sessionUnlock"
const SESSION_KEYS_KEY = "cryptedmessage:sessionKeys"
const SESSION_DERIVATION_INFO_KEY = "cryptedmessage:sessionDerivationInfo"
const PENDING_AUTH_SECRET_KEY = "cryptedmessage:pendingAuthSecret"
const PENDING_AUTH_SECRET_AT_KEY = "cryptedmessage:pendingAuthSecretAt"
const PENDING_AUTH_SECRET_TTL_MS = 10 * 60 * 1000
const REMEMBERED_UNLOCK_KEY = "cryptedmessage:rememberedUnlock"
const REMEMBERED_DERIVATION_INFO_KEY = "cryptedmessage:rememberedDerivationInfo"
const PINNED_KEYS_STORAGE_KEY = "cryptedmessage:pinnedKeys"
const RATCHET_STATE_STORAGE_KEY = "cryptedmessage:ratchet"
const DEVICE_KEY_STORAGE_KEY = "cryptedmessage:deviceKey"
const DEVICE_ID_STORAGE_KEY = "cryptedmessage:deviceId"

const PAKE_EXPORT_KEY_STORAGE_KEY = "cryptedmessage:pakeExportKey"

function readLocalStorage(key: string): string | null {
    if (typeof window === "undefined") return null
    return window.localStorage.getItem(key)
}

function writeLocalStorage(key: string, value: string) {
    if (typeof window === "undefined") return
    window.localStorage.setItem(key, value)
}

function removeLocalStorage(key: string) {
    if (typeof window === "undefined") return
    window.localStorage.removeItem(key)
}

function readSessionStorage(key: string): string | null {
    if (typeof window === "undefined") return null
    return window.sessionStorage.getItem(key)
}

function writeSessionStorage(key: string, value: string) {
    if (typeof window === "undefined") return
    window.sessionStorage.setItem(key, value)
}

function removeSessionStorage(key: string) {
    if (typeof window === "undefined") return
    window.sessionStorage.removeItem(key)
}

export function readEncryptedBundle(): string | null {
    return readLocalStorage(ENCRYPTED_BUNDLE_KEY)
}

export function writeEncryptedBundle(bundle: Json | string) {
    const payload = typeof bundle === "string" ? bundle : JSON.stringify(bundle)
    writeLocalStorage(ENCRYPTED_BUNDLE_KEY, payload)
}

export function clearEncryptedBundle() {
    removeLocalStorage(ENCRYPTED_BUNDLE_KEY)
}

/**
 * Lit la clé de session dérivée (PAS la passphrase en clair).
 * Cette clé est dérivée cryptographiquement et ne permet pas de retrouver la passphrase.
 */
export function readSessionUnlock(): string | null {
    return readSessionStorage(SESSION_UNLOCK_KEY)
}

/**
 * Stocke une clé de session dérivée (PAS la passphrase en clair).
 * @param derivedKey - Clé dérivée via PBKDF2, pas la passphrase originale
 */
export function writeSessionUnlock(derivedKey: string) {
    writeSessionStorage(SESSION_UNLOCK_KEY, derivedKey)
}

export function clearSessionUnlock() {
    removeSessionStorage(SESSION_UNLOCK_KEY)
    removeSessionStorage(SESSION_KEYS_KEY)
    removeSessionStorage(SESSION_DERIVATION_INFO_KEY)
}

/**
 * Lit les informations de dérivation pour la session.
 */
export function readSessionDerivationInfo(): string | null {
    return readSessionStorage(SESSION_DERIVATION_INFO_KEY)
}

/**
 * Stocke les informations de dérivation (salt, iterations) pour la session.
 */
export function writeSessionDerivationInfo(info: string) {
    writeSessionStorage(SESSION_DERIVATION_INFO_KEY, info)
}

/**
 * Lit les clés déchiffrées de la session (keyPair, ratchetKeyPair, signKeyPair).
 * Ces clés sont stockées temporairement pour l'auto-unlock sans re-demander la passphrase.
 */
export function readSessionKeys(): string | null {
    return readSessionStorage(SESSION_KEYS_KEY)
}

/**
 * Stores the PAKE export key (passphrase) locally to allow QR code export/import.
 * Note: this is sensitive; keep it opt-in and scoped.
 */
export function writePakeExportKey(exportKey: string) {
    writeLocalStorage(PAKE_EXPORT_KEY_STORAGE_KEY, exportKey)
}

export function readPakeExportKey(): string | null {
    return readLocalStorage(PAKE_EXPORT_KEY_STORAGE_KEY)
}

/**
 * Stocke les clés déchiffrées en session pour permettre l'auto-unlock.
 * @param keys - Objet JSON stringifié contenant keyPair, ratchetKeyPair, signKeyPair
 */
export function writeSessionKeys(keys: string) {
    writeSessionStorage(SESSION_KEYS_KEY, keys)
}

/**
 * Lit la clé persistante dérivée (PAS la passphrase en clair).
 * Cette clé est dérivée cryptographiquement et ne permet pas de retrouver la passphrase.
 */
export function readRememberedUnlock(): string | null {
    return readLocalStorage(REMEMBERED_UNLOCK_KEY)
}

/**
 * Stocke une clé persistante dérivée (PAS la passphrase en clair).
 * @param derivedKey - Clé dérivée via PBKDF2, pas la passphrase originale
 */
export function writeRememberedUnlock(derivedKey: string) {
    writeLocalStorage(REMEMBERED_UNLOCK_KEY, derivedKey)
}

export function clearRememberedUnlock() {
    removeLocalStorage(REMEMBERED_UNLOCK_KEY)
    removeLocalStorage(REMEMBERED_DERIVATION_INFO_KEY)
}

/**
 * Lit les informations de dérivation persistantes.
 */
export function readRememberedDerivationInfo(): string | null {
    return readLocalStorage(REMEMBERED_DERIVATION_INFO_KEY)
}

/**
 * Stocke les informations de dérivation (salt, iterations) de manière persistante.
 */
export function writeRememberedDerivationInfo(info: string) {
    writeLocalStorage(REMEMBERED_DERIVATION_INFO_KEY, info)
}

export function readPendingAuthSecret(): string | null {
    if (typeof window === "undefined") return null
    const secret = window.sessionStorage.getItem(PENDING_AUTH_SECRET_KEY)
    if (!secret) return null
    const rawTs = window.sessionStorage.getItem(PENDING_AUTH_SECRET_AT_KEY)
    if (!rawTs) return secret
    const ts = Number(rawTs)
    if (!Number.isFinite(ts)) return secret
    if (Date.now() - ts > PENDING_AUTH_SECRET_TTL_MS) {
        clearPendingAuthSecret()
        return null
    }
    return secret
}

export function clearPendingAuthSecret() {
    removeSessionStorage(PENDING_AUTH_SECRET_KEY)
    removeSessionStorage(PENDING_AUTH_SECRET_AT_KEY)
}

function parseKeyPair(raw: string | null): StoredKeyPair | null {
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw) as StoredKeyPair
        if (!parsed?.publicKey || !parsed?.secretKey) return null
        return parsed
    } catch {
        return null
    }
}

export function loadKeyPair(): StoredKeyPair | null {
    return parseKeyPair(readLocalStorage(KEYPAIR_STORAGE_KEY))
}

export function loadRatchetKeyPair(): StoredKeyPair | null {
    return parseKeyPair(readLocalStorage(RATCHET_STORAGE_KEY))
}

export function loadSignKeyPair(): StoredKeyPair | null {
    return parseKeyPair(readLocalStorage(SIGN_KEYPAIR_STORAGE_KEY))
}

export function clearLegacyKeyPairs() {
    removeLocalStorage(KEYPAIR_STORAGE_KEY)
    removeLocalStorage(RATCHET_STORAGE_KEY)
    removeLocalStorage(SIGN_KEYPAIR_STORAGE_KEY)
}

export function clearBundleStorage() {
    clearEncryptedBundle()
    clearSessionUnlock()
}

export function clearLocalVaultStorage() {
    console.log("clearLocalVaultStorage")
    clearBundleStorage()
    clearLegacyKeyPairs()
    removeLocalStorage(DEVICE_KEY_STORAGE_KEY)
    removeLocalStorage(DEVICE_ID_STORAGE_KEY)
    removeLocalStorage(PINNED_KEYS_STORAGE_KEY)
    removeLocalStorage(RATCHET_STATE_STORAGE_KEY)
    clearPendingAuthSecret()
    clearRememberedUnlock()
}

export function readRatchetState(chatId: string): DhRatchetState | null {
    if (typeof window === "undefined") return null
    try {
        const raw = window.localStorage.getItem(RATCHET_STATE_STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Record<string, DhRatchetState>
        return parsed?.[chatId] ?? null
    } catch {
        return null
    }
}

export function writeRatchetState(chatId: string, state: DhRatchetState) {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem(RATCHET_STATE_STORAGE_KEY)
    const parsed = raw
        ? (JSON.parse(raw) as Record<string, DhRatchetState>)
        : {}
    parsed[chatId] = state
    window.localStorage.setItem(
        RATCHET_STATE_STORAGE_KEY,
        JSON.stringify(parsed)
    )
}

export function clearRatchetState(chatId: string) {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem(RATCHET_STATE_STORAGE_KEY)
    if (!raw) return
    try {
        const parsed = JSON.parse(raw) as Record<string, DhRatchetState>
        if (!(chatId in parsed)) return
        delete parsed[chatId]
        window.localStorage.setItem(
            RATCHET_STATE_STORAGE_KEY,
            JSON.stringify(parsed)
        )
    } catch {
        // If storage is corrupted, just clear the whole ratchet state.
        window.localStorage.removeItem(RATCHET_STATE_STORAGE_KEY)
    }
}
