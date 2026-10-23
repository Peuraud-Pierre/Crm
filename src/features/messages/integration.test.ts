import { describe, it, expect } from "@rstest/core"
import {
    encryptMessage,
    decryptMessage,
    generateKeyPairBase64,
} from "./core/crypto"

describe("Messages Integration Tests", () => {
    describe("End-to-end message flow", () => {
        it("should encrypt and decrypt message successfully", async () => {
            const userId = "user-1"
            const recipientId = "user-2"
            const messageText = "Hello, this is a test message"

            // Generate key pairs
            const senderKeyPair = generateKeyPairBase64()
            const recipientKeyPair = generateKeyPairBase64()

            // Sender encrypts message
            const encrypted = await encryptMessage(
                messageText,
                userId,
                recipientId,
                senderKeyPair,
                recipientKeyPair.publicKey,
                {}
            )

            expect(encrypted).toBeDefined()
            expect(encrypted.ciphertext_b64).toBeDefined()
            expect(encrypted.iv_b64).toBeDefined()
            expect(encrypted.meta).toBeDefined()

            // Recipient decrypts message
            const decrypted = decryptMessage(
                encrypted.ciphertext_b64,
                encrypted.iv_b64,
                encrypted.meta,
                recipientId,
                recipientKeyPair.secretKey
            )

            expect(decrypted).toBe(messageText)
        })

        it("should handle multiple sequential messages", async () => {
            const userId = "user-1"
            const recipientId = "user-2"
            const messages = [
                "First message",
                "Second message",
                "Third message with émojis 🎉",
            ]

            const senderKeyPair = generateKeyPairBase64()
            const recipientKeyPair = generateKeyPairBase64()

            for (const message of messages) {
                const encrypted = await encryptMessage(
                    message,
                    userId,
                    recipientId,
                    senderKeyPair,
                    recipientKeyPair.publicKey,
                    {}
                )

                const decrypted = decryptMessage(
                    encrypted.ciphertext_b64,
                    encrypted.iv_b64,
                    encrypted.meta,
                    recipientId,
                    recipientKeyPair.secretKey
                )

                expect(decrypted).toBe(message)
            }
        })

        it("should handle long messages", async () => {
            const userId = "user-1"
            const recipientId = "user-2"
            const longMessage = "Lorem ipsum dolor sit amet. ".repeat(500) // ~13KB message

            const senderKeyPair = generateKeyPairBase64()
            const recipientKeyPair = generateKeyPairBase64()

            const encrypted = await encryptMessage(
                longMessage,
                userId,
                recipientId,
                senderKeyPair,
                recipientKeyPair.publicKey,
                {}
            )

            const decrypted = decryptMessage(
                encrypted.ciphertext_b64,
                encrypted.iv_b64,
                encrypted.meta,
                recipientId,
                recipientKeyPair.secretKey
            )

            expect(decrypted).toBe(longMessage)
        })

        it("should handle unicode messages", async () => {
            const userId = "user-1"
            const recipientId = "user-2"
            const unicodeMessage = "Hello 世界 🌍 مرحبا мир Здравствуй שלום"

            const senderKeyPair = generateKeyPairBase64()
            const recipientKeyPair = generateKeyPairBase64()

            const encrypted = await encryptMessage(
                unicodeMessage,
                userId,
                recipientId,
                senderKeyPair,
                recipientKeyPair.publicKey,
                {}
            )

            const decrypted = decryptMessage(
                encrypted.ciphertext_b64,
                encrypted.iv_b64,
                encrypted.meta,
                recipientId,
                recipientKeyPair.secretKey
            )

            expect(decrypted).toBe(unicodeMessage)
        })
    })

    describe("Decryption security", () => {
        it("should fail when recipient key is wrong", async () => {
            const userId = "user-1"
            const recipientId = "user-2"
            const messageText = "Secret message"

            const senderKeyPair = generateKeyPairBase64()
            const recipientKeyPair = generateKeyPairBase64()
            const wrongKeyPair = generateKeyPairBase64()

            const encrypted = await encryptMessage(
                messageText,
                userId,
                recipientId,
                senderKeyPair,
                recipientKeyPair.publicKey,
                {}
            )

            // Try to decrypt with wrong key
            const decrypted = decryptMessage(
                encrypted.ciphertext_b64,
                encrypted.iv_b64,
                encrypted.meta,
                recipientId,
                wrongKeyPair.secretKey
            )

            expect(decrypted).toBeNull()
        })

        it("should fail when ciphertext is tampered", async () => {
            const userId = "user-1"
            const recipientId = "user-2"
            const messageText = "Tampered message"

            const senderKeyPair = generateKeyPairBase64()
            const recipientKeyPair = generateKeyPairBase64()

            const encrypted = await encryptMessage(
                messageText,
                userId,
                recipientId,
                senderKeyPair,
                recipientKeyPair.publicKey,
                {}
            )

            // Tamper with ciphertext
            const tamperedBytes = Buffer.from(
                encrypted.ciphertext_b64,
                "base64"
            )
            tamperedBytes[0] ^= 0xff // Flip bits in first byte
            const tamperedCiphertext = tamperedBytes.toString("base64")

            const decrypted = decryptMessage(
                tamperedCiphertext,
                encrypted.iv_b64,
                encrypted.meta,
                recipientId,
                recipientKeyPair.secretKey
            )

            expect(decrypted).toBeNull()
        })

        it("should fail when IV is wrong", async () => {
            const userId = "user-1"
            const recipientId = "user-2"
            const messageText = "Test message"

            const senderKeyPair = generateKeyPairBase64()
            const recipientKeyPair = generateKeyPairBase64()

            const encrypted = await encryptMessage(
                messageText,
                userId,
                recipientId,
                senderKeyPair,
                recipientKeyPair.publicKey,
                {}
            )

            // Generate wrong IV
            const wrongIv = Buffer.alloc(24)
            wrongIv[0] = 0xff
            const wrongIvB64 = wrongIv.toString("base64")

            const decrypted = decryptMessage(
                encrypted.ciphertext_b64,
                wrongIvB64,
                encrypted.meta,
                recipientId,
                recipientKeyPair.secretKey
            )

            expect(decrypted).toBeNull()
        })
    })

    describe("Message metadata", () => {
        it("should preserve metadata in encrypted message", async () => {
            const userId = "user-1"
            const recipientId = "user-2"
            const messageText = "Message with metadata"

            const senderKeyPair = generateKeyPairBase64()
            const recipientKeyPair = generateKeyPairBase64()

            const encrypted = await encryptMessage(
                messageText,
                userId,
                recipientId,
                senderKeyPair,
                recipientKeyPair.publicKey,
                {}
            )

            expect(encrypted.meta).toBeDefined()
            expect(encrypted.meta.key_wraps[userId]).toBeDefined()
            expect(encrypted.meta.key_wraps[recipientId]).toBeDefined()
        })

        it("should include key derivation info in metadata", async () => {
            const userId = "user-1"
            const recipientId = "user-2"
            const messageText = "Test message"

            const senderKeyPair = generateKeyPairBase64()
            const recipientKeyPair = generateKeyPairBase64()

            const encrypted = await encryptMessage(
                messageText,
                userId,
                recipientId,
                senderKeyPair,
                recipientKeyPair.publicKey,
                {}
            )

            expect(encrypted.meta).toBeDefined()
            expect(encrypted.meta.sender_pubkey_b64).toBeDefined()
        })
    })

    describe("Performance characteristics", () => {
        it("should encrypt/decrypt message in reasonable time", async () => {
            const userId = "user-1"
            const recipientId = "user-2"
            const messageText = "Performance test message"

            const senderKeyPair = generateKeyPairBase64()
            const recipientKeyPair = generateKeyPairBase64()

            const startEncrypt = performance.now()
            const encrypted = await encryptMessage(
                messageText,
                userId,
                recipientId,
                senderKeyPair,
                recipientKeyPair.publicKey,
                {}
            )
            const encryptTime = performance.now() - startEncrypt

            const startDecrypt = performance.now()
            decryptMessage(
                encrypted.ciphertext_b64,
                encrypted.iv_b64,
                encrypted.meta,
                recipientId,
                recipientKeyPair.secretKey
            )
            const decryptTime = performance.now() - startDecrypt

            // Encryption/decryption should be fast (< 100ms for small messages)
            expect(encryptTime).toBeLessThan(100)
            expect(decryptTime).toBeLessThan(100)
        })

        it("should handle rapid successive messages", async () => {
            const userId = "user-1"
            const recipientId = "user-2"
            const count = 100

            const senderKeyPair = generateKeyPairBase64()
            const recipientKeyPair = generateKeyPairBase64()

            const start = performance.now()

            for (let i = 0; i < count; i++) {
                const message = `Message ${i}`
                const encrypted = await encryptMessage(
                    message,
                    userId,
                    recipientId,
                    senderKeyPair,
                    recipientKeyPair.publicKey,
                    {}
                )

                decryptMessage(
                    encrypted.ciphertext_b64,
                    encrypted.iv_b64,
                    encrypted.meta,
                    recipientId,
                    recipientKeyPair.secretKey
                )
            }

            const totalTime = performance.now() - start
            const avgTimePerMessage = totalTime / count

            // Average encrypt + decrypt time per message. Generous bound to
            // absorb CI/machine timing variance while still catching gross
            // regressions (typical run is ~10ms).
            expect(avgTimePerMessage).toBeLessThan(25)
        })
    })

    describe("Error recovery", () => {
        it("should not leak information when decryption fails", async () => {
            const userId = "user-1"
            const recipientId = "user-2"
            const messageText = "Sensitive data"

            const senderKeyPair = generateKeyPairBase64()
            const recipientKeyPair = generateKeyPairBase64()
            const wrongKeyPair = generateKeyPairBase64()

            const encrypted = await encryptMessage(
                messageText,
                userId,
                recipientId,
                senderKeyPair,
                recipientKeyPair.publicKey,
                {}
            )

            const decrypted = decryptMessage(
                encrypted.ciphertext_b64,
                encrypted.iv_b64,
                encrypted.meta,
                recipientId,
                wrongKeyPair.secretKey
            )

            expect(decrypted).toBeNull()
        })

        it("should allow retry after decryption failure", async () => {
            const userId = "user-1"
            const recipientId = "user-2"
            const messageText = "Retry test"

            const senderKeyPair = generateKeyPairBase64()
            const recipientKeyPair = generateKeyPairBase64()
            const wrongKeyPair = generateKeyPairBase64()

            const encrypted = await encryptMessage(
                messageText,
                userId,
                recipientId,
                senderKeyPair,
                recipientKeyPair.publicKey,
                {}
            )

            // First attempt with wrong key - should fail
            const firstAttempt = decryptMessage(
                encrypted.ciphertext_b64,
                encrypted.iv_b64,
                encrypted.meta,
                recipientId,
                wrongKeyPair.secretKey
            )

            expect(firstAttempt).toBeNull()

            const decrypted = decryptMessage(
                encrypted.ciphertext_b64,
                encrypted.iv_b64,
                encrypted.meta,
                recipientId,
                recipientKeyPair.secretKey
            )

            expect(decrypted).toBe(messageText)
        })
    })
})
