import { describe, it, expect, beforeEach } from "@rstest/core"
import nacl from "tweetnacl"
import { encodeBase64, decodeBase64 } from "tweetnacl-util"
import {
    encryptMessage,
    decryptPayload,
    generateKeyPairBase64,
    extractPublicKey,
} from "./crypto"
import type { KeyPairBase64 } from "./crypto"

describe("Crypto Module", () => {
    let senderKeyPair: KeyPairBase64
    let recipientKeyPair: KeyPairBase64
    let recipientPublicKeyB64: string

    beforeEach(() => {
        // Generate test key pairs
        const senderKeys = nacl.box.keyPair()
        const recipientKeys = nacl.box.keyPair()

        senderKeyPair = {
            publicKey: encodeBase64(senderKeys.publicKey),
            secretKey: encodeBase64(senderKeys.secretKey),
        }

        recipientKeyPair = {
            publicKey: encodeBase64(recipientKeys.publicKey),
            secretKey: encodeBase64(recipientKeys.secretKey),
        }

        recipientPublicKeyB64 = recipientKeyPair.publicKey
    })

    describe("encryptMessage", () => {
        it("should encrypt a message successfully", () => {
            const plaintext = "Hello, World!"
            const senderId = "sender-123"
            const recipientId = "recipient-456"

            const encrypted = encryptMessage(
                plaintext,
                senderId,
                recipientId,
                senderKeyPair,
                recipientPublicKeyB64
            )

            expect(encrypted).toHaveProperty("ciphertext_b64")
            expect(encrypted).toHaveProperty("iv_b64")
            expect(encrypted).toHaveProperty("meta")
            expect(typeof encrypted.ciphertext_b64).toBe("string")
            expect(typeof encrypted.iv_b64).toBe("string")
        })

        it("should create different ciphertexts for same plaintext (different nonce)", () => {
            const plaintext = "Same message"
            const senderId = "sender-123"
            const recipientId = "recipient-456"

            const encrypted1 = encryptMessage(
                plaintext,
                senderId,
                recipientId,
                senderKeyPair,
                recipientPublicKeyB64
            )

            const encrypted2 = encryptMessage(
                plaintext,
                senderId,
                recipientId,
                senderKeyPair,
                recipientPublicKeyB64
            )

            expect(encrypted1.ciphertext_b64).not.toBe(
                encrypted2.ciphertext_b64
            )
            expect(encrypted1.iv_b64).not.toBe(encrypted2.iv_b64)
        })

        it("should include sender public key in meta", () => {
            const encrypted = encryptMessage(
                "Test",
                "sender-123",
                "recipient-456",
                senderKeyPair,
                recipientPublicKeyB64
            )

            expect(encrypted.meta.sender_pubkey_b64).toBe(
                senderKeyPair.publicKey
            )
        })
    })

    describe("decryptPayload", () => {
        it("should decrypt an encrypted message", () => {
            const plaintext = "Secret message"
            const senderId = "sender-123"
            const recipientId = "recipient-456"

            const encrypted = encryptMessage(
                plaintext,
                senderId,
                recipientId,
                senderKeyPair,
                recipientPublicKeyB64
            )

            const decrypted = decryptPayload(
                encrypted.ciphertext_b64,
                encrypted.iv_b64,
                encrypted.meta,
                recipientId,
                recipientKeyPair.secretKey
            )

            expect(decrypted).not.toBeNull()
            if (decrypted) {
                const decryptedText = new TextDecoder().decode(decrypted)
                expect(decryptedText).toBe(plaintext)
            }
        })

        it("should return null with invalid key", () => {
            const plaintext = "Secret message"
            const encrypted = encryptMessage(
                plaintext,
                "sender-123",
                "recipient-456",
                senderKeyPair,
                recipientPublicKeyB64
            )

            const wrongKeyPair = nacl.box.keyPair()
            const wrongSecretKeyB64 = encodeBase64(wrongKeyPair.secretKey)

            const decrypted = decryptPayload(
                encrypted.ciphertext_b64,
                encrypted.iv_b64,
                encrypted.meta,
                "recipient-456",
                wrongSecretKeyB64
            )

            expect(decrypted).toBeNull()
        })

        it("should return null with corrupted ciphertext", () => {
            const plaintext = "Secret message"
            const encrypted = encryptMessage(
                plaintext,
                "sender-123",
                "recipient-456",
                senderKeyPair,
                recipientPublicKeyB64
            )

            const corruptedCiphertext = "aGVsbG8gd29ybGQ="

            const decrypted = decryptPayload(
                corruptedCiphertext,
                encrypted.iv_b64,
                encrypted.meta,
                "recipient-456",
                recipientKeyPair.secretKey
            )

            expect(decrypted).toBeNull()
        })
    })

    describe("extractPublicKey", () => {
        it("should extract public key from payload object", () => {
            const publicKeyB64 = senderKeyPair.publicKey
            const extracted = extractPublicKey({ key: publicKeyB64 })

            expect(extracted).toBe(publicKeyB64)
        })

        it("should return null for invalid payload", () => {
            expect(extractPublicKey("not-valid-base64!!!")).toBeNull()
        })
    })

    describe("generateKeyPairBase64", () => {
        it("should generate valid key pairs", () => {
            const keyPair = generateKeyPairBase64()

            expect(keyPair).toHaveProperty("publicKey")
            expect(keyPair).toHaveProperty("secretKey")
            expect(typeof keyPair.publicKey).toBe("string")
            expect(typeof keyPair.secretKey).toBe("string")

            const publicKey = decodeBase64(keyPair.publicKey)
            const secretKey = decodeBase64(keyPair.secretKey)

            expect(publicKey.length).toBe(32)
            expect(secretKey.length).toBe(32)
        })

        it("should generate different key pairs each time", () => {
            const keyPair1 = generateKeyPairBase64()
            const keyPair2 = generateKeyPairBase64()

            expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey)
            expect(keyPair1.secretKey).not.toBe(keyPair2.secretKey)
        })
    })

    describe("Message encryption roundtrip", () => {
        it("should successfully encrypt and decrypt a complete message", () => {
            const messages = [
                "Hello, World!",
                "Special characters: !@#$%^&*()",
                "Unicode: 你好世界 🎉",
                "Long message: " + "x".repeat(1000),
            ]

            messages.forEach((message) => {
                const encrypted = encryptMessage(
                    message,
                    "sender-1",
                    "recipient-1",
                    senderKeyPair,
                    recipientPublicKeyB64
                )

                const decrypted = decryptPayload(
                    encrypted.ciphertext_b64,
                    encrypted.iv_b64,
                    encrypted.meta,
                    "recipient-1",
                    recipientKeyPair.secretKey
                )

                expect(decrypted).not.toBeNull()
                if (decrypted) {
                    const decryptedText = new TextDecoder().decode(decrypted)
                    expect(decryptedText).toBe(message)
                }
            })
        })
    })
})
