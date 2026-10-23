import nacl from "tweetnacl"
import {
    decodeBase64,
    decodeUTF8,
    encodeBase64,
    encodeUTF8,
} from "tweetnacl-util"
import type { Json } from "@/integrations/supabase/types"
import {
    readRatchetState,
    writeRatchetState,
    type DhRatchetState,
    type StoredKeyPair,
} from "./storage"

export type KeyPairBase64 = {
    publicKey: string
    secretKey: string
}

export type SignKeyPairBase64 = {
    publicKey: string
    secretKey: string
}

export type KeyWrap = {
    cipher_b64: string
    nonce_b64: string
    sender_pubkey_b64?: string
}

export type MessageMeta = {
    algo: "nacl-secretbox-v1"
    sender_pubkey_b64: string
    key_wraps: Record<string, KeyWrap>
    ratchet?: {
        version: "ck-v1" | "dh-v1"
        counter: number
        direction?: "AtoB" | "BtoA"
        dh_pubkey_b64?: string
    }
    content_type?: string
    file_name?: string
    file_size?: number
    file_ext?: string
    /**
     * Dimensions d'une image, écrites à l'envoi. Servent à réserver la place
     * de la vignette avant son téléchargement (fin du saut de scroll).
     * Absentes des messages antérieurs — l'UI retombe sur un cadre 4:3.
     * `meta` n'est pas chiffré : ces champs n'ont aucun effet crypto.
     */
    width?: number
    height?: number
    storage?: {
        bucket: string
        path: string
    }
}

export type EncryptedPayload = {
    ciphertext_b64: string
    iv_b64: string
    meta: MessageMeta
}

export const CRYPTED_MESSAGE_ALGO = "nacl-secretbox-v1" as const

export function generateKeyPairBase64(): KeyPairBase64 {
    const keyPair = nacl.box.keyPair()
    return {
        publicKey: encodeBase64(keyPair.publicKey),
        secretKey: encodeBase64(keyPair.secretKey),
    }
}

export function generateSignKeyPairBase64(): SignKeyPairBase64 {
    const keyPair = nacl.sign.keyPair()
    return {
        publicKey: encodeBase64(keyPair.publicKey),
        secretKey: encodeBase64(keyPair.secretKey),
    }
}

function encryptPayload(
    plaintext: Uint8Array,
    senderId: string,
    recipientId: string,
    senderKeys: KeyPairBase64,
    recipientPublicKeyB64: string,
    options?: {
        messageKey?: Uint8Array
        ratchet?: MessageMeta["ratchet"]
    }
): EncryptedPayload {
    const messageKey =
        options?.messageKey ?? nacl.randomBytes(nacl.secretbox.keyLength)
    const messageNonce = nacl.randomBytes(nacl.secretbox.nonceLength)
    const ciphertext = nacl.secretbox(plaintext, messageNonce, messageKey)

    const senderPublicKey = decodeBase64(senderKeys.publicKey)
    const senderSecretKey = decodeBase64(senderKeys.secretKey)
    const recipientPublicKey = decodeBase64(recipientPublicKeyB64)

    const senderWrapNonce = nacl.randomBytes(nacl.box.nonceLength)
    const recipientWrapNonce = nacl.randomBytes(nacl.box.nonceLength)
    const ephemeral = nacl.box.keyPair()

    const senderKeyWrap = nacl.box(
        messageKey,
        senderWrapNonce,
        senderPublicKey,
        senderSecretKey
    )
    const recipientKeyWrap = nacl.box(
        messageKey,
        recipientWrapNonce,
        recipientPublicKey,
        ephemeral.secretKey
    )

    return {
        ciphertext_b64: encodeBase64(ciphertext),
        iv_b64: encodeBase64(messageNonce),
        meta: {
            algo: CRYPTED_MESSAGE_ALGO,
            sender_pubkey_b64: senderKeys.publicKey,
            key_wraps: {
                [senderId]: {
                    cipher_b64: encodeBase64(senderKeyWrap),
                    nonce_b64: encodeBase64(senderWrapNonce),
                    sender_pubkey_b64: senderKeys.publicKey,
                },
                [recipientId]: {
                    cipher_b64: encodeBase64(recipientKeyWrap),
                    nonce_b64: encodeBase64(recipientWrapNonce),
                    sender_pubkey_b64: encodeBase64(ephemeral.publicKey),
                },
            },
            ratchet: options?.ratchet,
        },
    }
}

export function encryptMessage(
    plaintext: string,
    senderId: string,
    recipientId: string,
    senderKeys: KeyPairBase64,
    recipientPublicKeyB64: string,
    options?: {
        messageKey?: Uint8Array
        ratchet?: MessageMeta["ratchet"]
    }
): EncryptedPayload {
    return encryptPayload(
        decodeUTF8(plaintext),
        senderId,
        recipientId,
        senderKeys,
        recipientPublicKeyB64,
        options
    )
}

export function encryptBinary(
    plaintext: Uint8Array,
    senderId: string,
    recipientId: string,
    senderKeys: KeyPairBase64,
    recipientPublicKeyB64: string,
    options?: {
        messageKey?: Uint8Array
        ratchet?: MessageMeta["ratchet"]
    }
): EncryptedPayload {
    return encryptPayload(
        plaintext,
        senderId,
        recipientId,
        senderKeys,
        recipientPublicKeyB64,
        options
    )
}

export function decryptPayload(
    ciphertextB64: string,
    nonceB64: string,
    meta: MessageMeta,
    currentUserId: string,
    recipientSecretKeyB64: string,
    messageKeyOverride?: Uint8Array
): Uint8Array | null {
    const wrap = meta.key_wraps[currentUserId]
    if (!wrap && !messageKeyOverride) return null
    if (
        typeof ciphertextB64 !== "string" ||
        typeof nonceB64 !== "string" ||
        (!messageKeyOverride &&
            (typeof wrap?.cipher_b64 !== "string" ||
                typeof wrap?.nonce_b64 !== "string")) ||
        typeof meta.sender_pubkey_b64 !== "string" ||
        typeof recipientSecretKeyB64 !== "string"
    ) {
        return null
    }

    const wrappedKey = messageKeyOverride
        ? messageKeyOverride
        : (() => {
              const senderPublicKey = decodeBase64(
                  wrap.sender_pubkey_b64 ?? meta.sender_pubkey_b64
              )
              const recipientSecretKey = decodeBase64(recipientSecretKeyB64)
              return nacl.box.open(
                  decodeBase64(wrap.cipher_b64),
                  decodeBase64(wrap.nonce_b64),
                  senderPublicKey,
                  recipientSecretKey
              )
          })()

    if (!wrappedKey) return null

    const plaintext = nacl.secretbox.open(
        decodeBase64(ciphertextB64),
        decodeBase64(nonceB64),
        wrappedKey
    )

    if (!plaintext) return null

    return plaintext
}

export function unwrapMessageKey(
    meta: MessageMeta,
    currentUserId: string,
    recipientSecretKeyB64: string
): Uint8Array | null {
    const wrap = meta.key_wraps[currentUserId]
    if (!wrap) return null
    if (
        typeof wrap.cipher_b64 !== "string" ||
        typeof wrap.nonce_b64 !== "string" ||
        typeof meta.sender_pubkey_b64 !== "string" ||
        typeof recipientSecretKeyB64 !== "string"
    ) {
        return null
    }
    const senderPublicKey = decodeBase64(
        wrap.sender_pubkey_b64 ?? meta.sender_pubkey_b64
    )
    const recipientSecretKey = decodeBase64(recipientSecretKeyB64)
    return nacl.box.open(
        decodeBase64(wrap.cipher_b64),
        decodeBase64(wrap.nonce_b64),
        senderPublicKey,
        recipientSecretKey
    )
}

export function unwrapMessageKeyAny(
    meta: MessageMeta,
    recipientSecretKeyB64: string
): Uint8Array | null {
    const recipientSecretKey = decodeBase64(recipientSecretKeyB64)
    for (const wrap of Object.values(meta.key_wraps)) {
        if (
            !wrap ||
            typeof wrap.cipher_b64 !== "string" ||
            typeof wrap.nonce_b64 !== "string" ||
            typeof wrap.sender_pubkey_b64 !== "string"
        ) {
            continue
        }
        const senderPublicKey = decodeBase64(wrap.sender_pubkey_b64)
        const opened = nacl.box.open(
            decodeBase64(wrap.cipher_b64),
            decodeBase64(wrap.nonce_b64),
            senderPublicKey,
            recipientSecretKey
        )
        if (opened) return opened
    }
    return null
}

export function decryptPayloadBytes(
    ciphertext: Uint8Array,
    nonceB64: string,
    meta: MessageMeta,
    currentUserId: string,
    recipientSecretKeyB64: string,
    messageKeyOverride?: Uint8Array
): Uint8Array | null {
    return decryptPayload(
        encodeBase64(ciphertext),
        nonceB64,
        meta,
        currentUserId,
        recipientSecretKeyB64,
        messageKeyOverride
    )
}

export function decryptPayloadRaw(
    ciphertext: Uint8Array,
    nonceB64: string,
    messageKey: Uint8Array
): Uint8Array | null {
    return nacl.secretbox.open(ciphertext, decodeBase64(nonceB64), messageKey)
}

export function decryptMessage(
    ciphertextB64: string,
    nonceB64: string,
    meta: MessageMeta,
    currentUserId: string,
    recipientSecretKeyB64: string,
    messageKeyOverride?: Uint8Array
): string | null {
    const plaintext = decryptPayload(
        ciphertextB64,
        nonceB64,
        meta,
        currentUserId,
        recipientSecretKeyB64,
        messageKeyOverride
    )
    if (!plaintext) return null
    return encodeUTF8(plaintext)
}

export function serializeMeta(meta: MessageMeta): Json {
    return meta as Json
}

export function parseMeta(meta: unknown): MessageMeta | null {
    if (!meta || typeof meta !== "object") return null
    const typed = meta as MessageMeta
    if (!typed.sender_pubkey_b64 || !typed.key_wraps) return null
    if (typed.algo !== CRYPTED_MESSAGE_ALGO) return null
    for (const value of Object.values(typed.key_wraps)) {
        if (!value) return null
        if (
            typeof value.cipher_b64 !== "string" ||
            typeof value.nonce_b64 !== "string"
        ) {
            return null
        }
        if (
            value.sender_pubkey_b64 !== undefined &&
            typeof value.sender_pubkey_b64 !== "string"
        ) {
            return null
        }
    }
    if (typed.ratchet) {
        if (
            typed.ratchet.version !== "ck-v1" &&
            typed.ratchet.version !== "dh-v1"
        )
            return null
        if (typeof typed.ratchet.counter !== "number") return null
        if (typed.ratchet.version === "ck-v1") {
            if (
                typed.ratchet.direction !== "AtoB" &&
                typed.ratchet.direction !== "BtoA"
            ) {
                return null
            }
        }
        if (
            typed.ratchet.dh_pubkey_b64 !== undefined &&
            typeof typed.ratchet.dh_pubkey_b64 !== "string"
        ) {
            return null
        }
    }
    return typed
}

export function randomBase64(bytes: number): string {
    return encodeBase64(nacl.randomBytes(bytes))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    return copy.buffer
}

export async function derivePassphraseKey(
    passphrase: string,
    salt: Uint8Array,
    usages: KeyUsage[]
): Promise<CryptoKey> {
    if (!window.crypto?.subtle) {
        throw new Error("WebCrypto indisponible")
    }
    const baseKey = await window.crypto.subtle.importKey(
        "raw",
        toArrayBuffer(decodeUTF8(passphrase)),
        "PBKDF2",
        false,
        ["deriveKey"]
    )
    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: toArrayBuffer(salt),
            iterations: 150000,
            hash: "SHA-256",
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        usages
    )
}

export async function encryptKeyBundle(
    bundle: Record<string, unknown>,
    passphrase: string
): Promise<{ salt_b64: string; iv_b64: string; ciphertext_b64: string }> {
    const salt = nacl.randomBytes(16)
    const iv = nacl.randomBytes(12)
    const key = await derivePassphraseKey(passphrase, salt, ["encrypt"])
    const encoded = decodeUTF8(JSON.stringify(bundle))
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: toArrayBuffer(iv) },
        key,
        toArrayBuffer(encoded)
    )
    return {
        salt_b64: encodeBase64(salt),
        iv_b64: encodeBase64(iv),
        ciphertext_b64: encodeBase64(new Uint8Array(ciphertext)),
    }
}

export async function decryptKeyBundle(
    bundle: { salt_b64: string; iv_b64: string; ciphertext_b64: string },
    passphrase: string
): Promise<Record<string, unknown> | null> {
    try {
        const salt = decodeBase64(bundle.salt_b64)
        const iv = decodeBase64(bundle.iv_b64)
        const key = await derivePassphraseKey(passphrase, salt, ["decrypt"])
        const plaintext = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: toArrayBuffer(iv) },
            key,
            toArrayBuffer(decodeBase64(bundle.ciphertext_b64))
        )
        const decoded = new TextDecoder().decode(new Uint8Array(plaintext))
        return JSON.parse(decoded) as Record<string, unknown>
    } catch {
        return null
    }
}

export function signKeyBundle(
    userId: string,
    encryptionPublicKey: string,
    ratchetPublicKey: string,
    signSecretKeyB64: string
): string {
    const payload = `${userId}|${encryptionPublicKey}|${ratchetPublicKey}`
    const signature = nacl.sign.detached(
        decodeUTF8(payload),
        decodeBase64(signSecretKeyB64)
    )
    return encodeBase64(signature)
}

export function verifyKeyBundle(
    userId: string,
    encryptionPublicKey: string,
    ratchetPublicKey: string,
    signatureB64: string,
    signPublicKeyB64: string
): boolean {
    const payload = `${userId}|${encryptionPublicKey}|${ratchetPublicKey}`
    return nacl.sign.detached.verify(
        decodeUTF8(payload),
        decodeBase64(signatureB64),
        decodeBase64(signPublicKeyB64)
    )
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
    const out = new Uint8Array(a.length + b.length)
    out.set(a, 0)
    out.set(b, a.length)
    return out
}

function hashWithLabel(input: Uint8Array, label: string): Uint8Array {
    const labelBytes = decodeUTF8(label)
    return nacl.hash(concatBytes(input, labelBytes))
}

export function deriveSharedSecret(
    senderSecretKeyB64: string,
    recipientPublicKeyB64: string
): Uint8Array {
    return nacl.box.before(
        decodeBase64(recipientPublicKeyB64),
        decodeBase64(senderSecretKeyB64)
    )
}

export function kdfRoot(
    rootKey: Uint8Array,
    dhOutput: Uint8Array
): { rootKey: Uint8Array; chainKey: Uint8Array } {
    const material = concatBytes(rootKey, dhOutput)
    const nextRoot = hashWithLabel(material, "root").slice(0, 32)
    const chainKey = hashWithLabel(nextRoot, "ck").slice(0, 32)
    return { rootKey: nextRoot, chainKey }
}

export function advanceChain(
    chainKey: Uint8Array,
    currentCounter: number,
    targetCounter: number
): { chainKey: Uint8Array; counter: number; messageKey: Uint8Array } {
    let ck = chainKey
    let counter = currentCounter
    while (counter < targetCounter) {
        ck = hashWithLabel(ck, "ck").slice(0, 32)
        counter += 1
    }
    const messageKey = hashWithLabel(ck, "msg").slice(0, 32)
    return { chainKey: ck, counter, messageKey }
}

// Encrypt a payload for multiple recipients (group messages).
// Creates one independent ephemeral key wrap per member so any member can decrypt.
function encryptPayloadForMultiple(
    plaintext: Uint8Array,
    senderKeys: KeyPairBase64,
    memberKeys: Record<string, string>, // userId -> publicKeyB64
    options?: { messageKey?: Uint8Array }
): EncryptedPayload {
    const messageKey =
        options?.messageKey ?? nacl.randomBytes(nacl.secretbox.keyLength)
    const messageNonce = nacl.randomBytes(nacl.secretbox.nonceLength)
    const ciphertext = nacl.secretbox(plaintext, messageNonce, messageKey)

    const key_wraps: Record<string, KeyWrap> = {}

    for (const [memberId, memberPublicKeyB64] of Object.entries(memberKeys)) {
        const ephemeral = nacl.box.keyPair()
        const wrapNonce = nacl.randomBytes(nacl.box.nonceLength)
        const memberPublicKey = decodeBase64(memberPublicKeyB64)
        const keyWrap = nacl.box(
            messageKey,
            wrapNonce,
            memberPublicKey,
            ephemeral.secretKey
        )
        key_wraps[memberId] = {
            cipher_b64: encodeBase64(keyWrap),
            nonce_b64: encodeBase64(wrapNonce),
            sender_pubkey_b64: encodeBase64(ephemeral.publicKey),
        }
    }

    return {
        ciphertext_b64: encodeBase64(ciphertext),
        iv_b64: encodeBase64(messageNonce),
        meta: {
            algo: CRYPTED_MESSAGE_ALGO,
            sender_pubkey_b64: senderKeys.publicKey,
            key_wraps,
        },
    }
}

export function encryptMessageForGroup(
    plaintext: string,
    senderKeys: KeyPairBase64,
    memberKeys: Record<string, string>,
    options?: { messageKey?: Uint8Array }
): EncryptedPayload {
    return encryptPayloadForMultiple(
        decodeUTF8(plaintext),
        senderKeys,
        memberKeys,
        options
    )
}

export function encryptBinaryForGroup(
    plaintext: Uint8Array,
    senderKeys: KeyPairBase64,
    memberKeys: Record<string, string>,
    options?: { messageKey?: Uint8Array }
): EncryptedPayload {
    return encryptPayloadForMultiple(plaintext, senderKeys, memberKeys, options)
}

export function buildConversationId(a?: string | null, b?: string | null) {
    if (!a || !b) return null
    return [a, b].sort().join("::")
}

export function sanitizeFileName(name: string): string {
    const trimmed = name.trim()
    const base = trimmed || "file"
    // Supabase Storage rejette les clés non-ASCII ("Invalid key") :
    // on translittère les accents (NFKD) puis on ne garde qu'un
    // sous-ensemble sûr de caractères.
    const sanitized = base
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/_{2,}/g, "_")
        .replace(/^[_.]+|[_.]+$/g, "")
        .slice(0, 120)
    return sanitized || "file"
}

export function extractPublicKey(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null
    const raw = payload as { key?: unknown }
    if (!raw.key || typeof raw.key !== "string") return null
    return raw.key
}

export function extractRatchetPublicKey(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null
    const raw = payload as { ratchet_pubkey?: unknown }
    if (!raw.ratchet_pubkey || typeof raw.ratchet_pubkey !== "string")
        return null
    return raw.ratchet_pubkey
}

export function extractSignPublicKey(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null
    const raw = payload as { sign_pubkey?: unknown }
    if (!raw.sign_pubkey || typeof raw.sign_pubkey !== "string") return null
    return raw.sign_pubkey
}

export function extractSignature(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null
    const raw = payload as { signature?: unknown }
    if (!raw.signature || typeof raw.signature !== "string") return null
    return raw.signature
}

type RatchetSendResult = {
    messageKey: Uint8Array
    ratchet: MessageMeta["ratchet"]
}

type MessageIdentityRow = {
    sender_id?: string | null
    recipient_id?: string | null
}

function initRatchetState({
    identitySecretKey,
    identityPublicKey,
    ratchetSecretKey,
    ratchetPublicKey,
    remoteDhPublicKey,
}: {
    identitySecretKey: string
    identityPublicKey: string
    ratchetSecretKey: string
    ratchetPublicKey: string
    remoteDhPublicKey: string
}): DhRatchetState {
    const identityShared = deriveSharedSecret(
        identitySecretKey,
        identityPublicKey
    )
    const dhOut = deriveSharedSecret(ratchetSecretKey, remoteDhPublicKey)
    const { rootKey, chainKey } = kdfRoot(identityShared, dhOut)
    return {
        root_b64: encodeBase64(rootKey),
        dh_self_pub_b64: ratchetPublicKey,
        dh_self_priv_b64: ratchetSecretKey,
        dh_remote_pub_b64: remoteDhPublicKey,
        send_ck_b64: encodeBase64(chainKey),
        recv_ck_b64: encodeBase64(chainKey),
        send_count: 0,
        recv_count: 0,
    }
}

export function advanceSendRatchetState({
    chatId,
    keyPair,
    ratchetKeyPair,
    recipientPublicKey,
    recipientRatchetPublicKey,
}: {
    chatId: string
    keyPair: StoredKeyPair
    ratchetKeyPair: StoredKeyPair
    recipientPublicKey: string
    recipientRatchetPublicKey: string
}): RatchetSendResult {
    let state = readRatchetState(chatId)
    if (!state) {
        state = initRatchetState({
            identitySecretKey: keyPair.secretKey,
            identityPublicKey: recipientPublicKey,
            ratchetSecretKey: ratchetKeyPair.secretKey,
            ratchetPublicKey: ratchetKeyPair.publicKey,
            remoteDhPublicKey: recipientRatchetPublicKey,
        })
    }

    if (state.dh_remote_pub_b64 !== recipientRatchetPublicKey) {
        state.dh_remote_pub_b64 = recipientRatchetPublicKey
    }

    const nextDh = generateKeyPairBase64()
    const dhOut = deriveSharedSecret(nextDh.secretKey, state.dh_remote_pub_b64)
    const { rootKey, chainKey } = kdfRoot(decodeBase64(state.root_b64), dhOut)
    state.root_b64 = encodeBase64(rootKey)
    state.dh_self_pub_b64 = nextDh.publicKey
    state.dh_self_priv_b64 = nextDh.secretKey
    state.send_ck_b64 = encodeBase64(chainKey)
    state.send_count = 0

    const {
        chainKey: sendCk,
        counter,
        messageKey,
    } = advanceChain(
        decodeBase64(state.send_ck_b64),
        state.send_count,
        state.send_count + 1
    )
    state.send_ck_b64 = encodeBase64(sendCk)
    state.send_count = counter
    writeRatchetState(chatId, state)

    return {
        messageKey,
        ratchet: {
            version: "dh-v1",
            counter,
            dh_pubkey_b64: state.dh_self_pub_b64,
        },
    }
}

export function deriveIncomingRatchetMessageKey({
    row,
    meta,
    userId,
    keyPair,
    ratchetKeyPair,
}: {
    row: MessageIdentityRow
    meta: MessageMeta
    userId: string
    keyPair: StoredKeyPair
    ratchetKeyPair: StoredKeyPair
}): Uint8Array | null {
    if (meta.ratchet?.version !== "dh-v1" || !meta.ratchet.dh_pubkey_b64)
        return null
    if (!row.sender_id || !row.recipient_id) return null

    const otherId = row.sender_id === userId ? row.recipient_id : row.sender_id
    const chatKey = buildConversationId(userId, otherId)
    if (!chatKey) return null

    let state = readRatchetState(chatKey)
    if (!state) {
        state = initRatchetState({
            identitySecretKey: keyPair.secretKey,
            identityPublicKey: meta.sender_pubkey_b64,
            ratchetSecretKey: ratchetKeyPair.secretKey,
            ratchetPublicKey: ratchetKeyPair.publicKey,
            remoteDhPublicKey: meta.ratchet.dh_pubkey_b64,
        })
    }

    if (state.dh_remote_pub_b64 !== meta.ratchet.dh_pubkey_b64) {
        const dhOut = deriveSharedSecret(
            state.dh_self_priv_b64,
            meta.ratchet.dh_pubkey_b64
        )
        const { rootKey, chainKey } = kdfRoot(
            decodeBase64(state.root_b64),
            dhOut
        )
        state.root_b64 = encodeBase64(rootKey)
        state.recv_ck_b64 = encodeBase64(chainKey)
        state.recv_count = 0
        state.dh_remote_pub_b64 = meta.ratchet.dh_pubkey_b64
    }

    const { chainKey, counter, messageKey } = advanceChain(
        decodeBase64(state.recv_ck_b64),
        state.recv_count,
        meta.ratchet.counter
    )
    state.recv_ck_b64 = encodeBase64(chainKey)
    state.recv_count = counter
    writeRatchetState(chatKey, state)
    return messageKey
}

export function resolveMetaPayload(meta: unknown) {
    const parsed = parseMeta(meta)
    const rawMeta =
        typeof meta === "object" && meta ? (meta as Partial<MessageMeta>) : null
    return {
        meta: parsed,
        contentType: parsed?.content_type ?? rawMeta?.content_type ?? null,
        fileName: parsed?.file_name ?? rawMeta?.file_name ?? null,
        fileSize: parsed?.file_size ?? rawMeta?.file_size ?? null,
        storage: parsed?.storage ?? rawMeta?.storage ?? null,
        width: parsed?.width ?? rawMeta?.width ?? null,
        height: parsed?.height ?? rawMeta?.height ?? null,
    }
}

export function decryptRowContent({
    row,
    meta,
    contentType,
    storage,
    userId,
    keyPair,
    messageKeyOverride,
}: {
    row: { ciphertext_b64?: string | null; iv_b64?: string | null }
    meta: MessageMeta | null
    contentType: string | null
    storage: MessageMeta["storage"] | null
    userId: string | null | undefined
    keyPair: StoredKeyPair | null
    messageKeyOverride?: Uint8Array
}) {
    const fallbackBody = "Message chiffre"
    let image_url: string | undefined
    let body = fallbackBody

    if (contentType && contentType.startsWith("image/")) {
        if (
            row.ciphertext_b64 &&
            row.iv_b64 &&
            meta &&
            keyPair &&
            (!storage?.bucket || !storage?.path)
        ) {
            const bytes =
                decryptPayload(
                    row.ciphertext_b64,
                    row.iv_b64,
                    meta,
                    userId ?? "",
                    keyPair.secretKey,
                    messageKeyOverride
                ) ??
                decryptPayload(
                    row.ciphertext_b64,
                    row.iv_b64,
                    meta,
                    userId ?? "",
                    keyPair.secretKey
                )
            if (bytes) {
                const imageBuffer = new ArrayBuffer(bytes.byteLength)
                new Uint8Array(imageBuffer).set(bytes)
                const blob = new Blob([imageBuffer], {
                    type: contentType,
                })
                image_url = URL.createObjectURL(blob)
                body = ""
            }
        } else {
            body = "Chargement fichier..."
        }
    } else if (row.ciphertext_b64 && row.iv_b64 && meta && keyPair) {
        body =
            decryptMessage(
                row.ciphertext_b64,
                row.iv_b64,
                meta,
                userId ?? "",
                keyPair.secretKey,
                messageKeyOverride
            ) ??
            decryptMessage(
                row.ciphertext_b64,
                row.iv_b64,
                meta,
                userId ?? "",
                keyPair.secretKey
            ) ??
            fallbackBody
    }

    return { body, image_url }
}

export function decryptAttachmentPayload({
    payload,
    row,
    meta,
    userId,
    keyPair,
}: {
    payload: Uint8Array
    row: { iv_b64?: string | null; message_key_b64?: string | null }
    meta: MessageMeta
    userId: string
    keyPair: StoredKeyPair
}): Uint8Array | null {
    const candidateKeys: Uint8Array[] = []
    if (row.message_key_b64) {
        candidateKeys.push(decodeBase64(row.message_key_b64))
    }
    const directKey = unwrapMessageKey(meta, userId, keyPair.secretKey)
    if (directKey) candidateKeys.push(directKey)
    const anyKey = unwrapMessageKeyAny(meta, keyPair.secretKey)
    if (anyKey) candidateKeys.push(anyKey)

    for (const key of candidateKeys) {
        const opened = decryptPayloadRaw(payload, row.iv_b64 ?? "", key)
        if (opened) return opened
    }

    return decryptPayloadBytes(
        payload,
        row.iv_b64 ?? "",
        meta,
        userId,
        keyPair.secretKey
    )
}
