import * as opaque from "@serenity-kit/opaque"
import { env } from "@/shared/lib/env"

const PAKE_API_BASE = env.PUBLIC_PAKE_URL
export const PAKE_SERVER_ID = env.PUBLIC_PAKE_SERVER_ID ?? "pake_go"
export const PAKE_ENABLED = Boolean(PAKE_API_BASE)

// Diagnostic pour le debug — gaté par PUBLIC_ENABLE_CRYPTO_DEBUG, voir DEBUG_CRYPTO.md.
if (env.PUBLIC_ENABLE_CRYPTO_DEBUG === "true") {
    console.log("🔧 PAKE Configuration:", {
        PAKE_API_BASE,
        PAKE_SERVER_ID,
        PAKE_ENABLED,
    })
}

type PakeAuth = {
    userId: string
    authHeader: string
}

/** Le serveur PAKE bloque temporairement après trop de PIN faux (HTTP 429). */
export class PakeTooManyAttemptsError extends Error {}

export function exportKeyToPassphrase(exportKey: Uint8Array): string {
    return bytesToBase64Url(exportKey)
}

export async function getPakeStatus({
    userId,
    authHeader,
}: PakeAuth): Promise<PakeStatus> {
    if (!PAKE_ENABLED) return { registered: false }
    const res = await fetch(
        `${PAKE_API_BASE}/status?user_id=${encodeURIComponent(userId)}`,
        {
            headers: { Authorization: authHeader },
        }
    )
    if (!res.ok) {
        throw new Error("Erreur PAKE status")
    }
    const data = (await res.json()) as PakeStatus
    return {
        registered: Boolean(data?.registered),
        server_id: data?.server_id,
        server_pub_hash: data?.server_pub_hash,
        oprf_hash: data?.oprf_hash,
    }
}

export async function deletePakeRegistration({
    userId,
    authHeader,
}: PakeAuth): Promise<void> {
    if (!PAKE_ENABLED) return
    const res = await fetch(
        `${PAKE_API_BASE}/delete?user_id=${encodeURIComponent(userId)}`,
        {
            method: "DELETE",
            headers: { Authorization: authHeader },
        }
    )
    if (!res.ok) {
        throw new Error("Erreur suppression PAKE")
    }
}

// Utilitaire pour convertir des octets en Base64URL (sans padding)
// C'est ce que ton serveur Go attend via base64.RawURLEncoding
function toUint8Array(
    input: Uint8Array | ArrayBuffer | ArrayBufferView
): Uint8Array {
    if (input instanceof Uint8Array) return input
    if (input instanceof ArrayBuffer) return new Uint8Array(input)
    // On extrait uniquement la vue active du buffer (évite les 96 octets de 'A')
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
}

// 2. Encodage Base64URL conforme à ce que le serveur Go attend (RawURLEncoding)
function bytesToBase64Url(
    bytes: Uint8Array | ArrayBuffer | ArrayBufferView
): string {
    const uint8 = toUint8Array(bytes)
    let binary = ""
    for (let i = 0; i < uint8.byteLength; i++) {
        binary += String.fromCharCode(uint8[i])
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "")
}

async function ensureOpaqueReady() {
    await opaque.ready
}

export type PakeStatus = {
    registered: boolean
    server_id?: string
    server_pub_hash?: string
    oprf_hash?: string
}

export async function registerWithPake(
    { userId, authHeader }: { userId: string; authHeader: string },
    password: string
): Promise<string> {
    await ensureOpaqueReady()

    const { clientRegistrationState, registrationRequest } =
        opaque.client.startRegistration({ password })

    const startRes = await fetch(`${PAKE_API_BASE}/register/start`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
        },
        body: JSON.stringify({
            user_id: userId,
            registration_request_b64: registrationRequest,
        }),
    })

    if (!startRes.ok) throw new Error("Erreur PAKE registration start")

    const startData = (await startRes.json()) as {
        registration_response_b64: string
        cred_id_b64: string
    }

    // Ici, registration_response_b64 est une string, c'est ce qu'attend finishRegistration
    const { registrationRecord, exportKey } = opaque.client.finishRegistration({
        clientRegistrationState,
        registrationResponse: startData.registration_response_b64,
        password,
        identifiers: { client: userId, server: PAKE_SERVER_ID },
    })

    const finishRes = await fetch(`${PAKE_API_BASE}/register/finish`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
        },
        body: JSON.stringify({
            user_id: userId,
            client_id: userId,
            registration_record_b64: registrationRecord,
            cred_id_b64: startData.cred_id_b64,
        }),
    })

    if (!finishRes.ok) throw new Error("Erreur PAKE registration finish")
    return exportKey
}

export async function loginWithPake(
    { userId, authHeader }: { userId: string; authHeader: string },
    password: string
): Promise<string> {
    await ensureOpaqueReady()

    const { clientLoginState, startLoginRequest } = opaque.client.startLogin({
        password,
    })

    const startRes = await fetch(`${PAKE_API_BASE}/login/start`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
        },
        body: JSON.stringify({
            user_id: userId,
            start_login_request_b64: startLoginRequest,
        }),
    })

    if (startRes.status === 429) throw new PakeTooManyAttemptsError()
    if (!startRes.ok) throw new Error("Erreur PAKE login start")

    const startData = (await startRes.json()) as {
        login_response_b64: string
        session_id: string
    }

    const loginResult = opaque.client.finishLogin({
        clientLoginState,
        loginResponse: startData.login_response_b64, // On passe la string brute du serveur
        password,
        identifiers: {
            client: userId,
            server: PAKE_SERVER_ID,
        },
    })

    if (!loginResult) throw new Error("PAKE login failed - PIN incorrect")

    const { exportKey, finishLoginRequest } = loginResult

    const finishRes = await fetch(`${PAKE_API_BASE}/login/finish`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
        },
        body: JSON.stringify({
            session_id: startData.session_id,
            finish_login_request_b64: finishLoginRequest,
        }),
    })

    if (!finishRes.ok) throw new Error("Erreur PAKE login finish")
    return exportKey
}
