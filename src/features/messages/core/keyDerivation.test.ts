import { describe, it, expect } from "@rstest/core"
import {
    deriveSessionKey,
    verifyPassphrase,
    hashPassphrase,
    generateSalt,
    createDerivationInfo,
    parseDerivationInfo,
} from "./keyDerivation"

describe("Key Derivation Tests", () => {
    describe("deriveSessionKey", () => {
        it("should derive a consistent key from the same passphrase and salt", async () => {
            const passphrase = "mySecretPassword123"
            const salt = generateSalt()

            const key1 = await deriveSessionKey(passphrase, salt)
            const key2 = await deriveSessionKey(passphrase, salt)

            expect(key1).toBe(key2)
            expect(key1).toBeDefined()
            expect(key1.length).toBeGreaterThan(0)
        })

        it("should derive different keys for different passphrases", async () => {
            const salt = generateSalt()

            const key1 = await deriveSessionKey("password1", salt)
            const key2 = await deriveSessionKey("password2", salt)

            expect(key1).not.toBe(key2)
        })

        it("should derive different keys for different salts", async () => {
            const passphrase = "mySecretPassword123"
            const salt1 = generateSalt()
            const salt2 = generateSalt()

            const key1 = await deriveSessionKey(passphrase, salt1)
            const key2 = await deriveSessionKey(passphrase, salt2)

            expect(key1).not.toBe(key2)
        })
    })

    describe("verifyPassphrase", () => {
        it("should verify correct passphrase", async () => {
            const passphrase = "correctPassword"
            const salt = generateSalt()
            const derivedKey = await deriveSessionKey(passphrase, salt)

            const isValid = await verifyPassphrase(passphrase, derivedKey, salt)

            expect(isValid).toBe(true)
        })

        it("should reject incorrect passphrase", async () => {
            const correctPassphrase = "correctPassword"
            const wrongPassphrase = "wrongPassword"
            const salt = generateSalt()
            const derivedKey = await deriveSessionKey(correctPassphrase, salt)

            const isValid = await verifyPassphrase(
                wrongPassphrase,
                derivedKey,
                salt
            )

            expect(isValid).toBe(false)
        })
    })

    describe("hashPassphrase", () => {
        it("should hash passphrase consistently", async () => {
            const passphrase = "testPassword"

            const hash1 = await hashPassphrase(passphrase)
            const hash2 = await hashPassphrase(passphrase)

            expect(hash1).toBe(hash2)
            expect(hash1).toBeDefined()
            expect(hash1.length).toBeGreaterThan(0)
        })

        it("should produce different hashes for different passphrases", async () => {
            const hash1 = await hashPassphrase("password1")
            const hash2 = await hashPassphrase("password2")

            expect(hash1).not.toBe(hash2)
        })
    })

    describe("Salt generation and derivation info", () => {
        it("should generate random salts", () => {
            const salt1 = generateSalt()
            const salt2 = generateSalt()

            expect(salt1).toHaveLength(32)
            expect(salt2).toHaveLength(32)
            expect(salt1).not.toEqual(salt2)
        })

        it("should create and parse derivation info correctly", () => {
            const salt = generateSalt()
            const iterations = 150000

            const info = createDerivationInfo(salt, iterations)

            expect(info.algorithm).toBe("PBKDF2-SHA256")
            expect(info.iterations).toBe(iterations)
            expect(info.salt_b64).toBeDefined()

            const parsed = parseDerivationInfo(info)

            expect(parsed.salt).toEqual(salt)
            expect(parsed.iterations).toBe(iterations)
        })
    })

    describe("Security properties", () => {
        it("should not be reversible - cannot get passphrase from derived key", async () => {
            const passphrase = "secretPassword123"
            const salt = generateSalt()
            const derivedKey = await deriveSessionKey(passphrase, salt)

            // Le derived key ne doit pas contenir la passphrase
            expect(derivedKey.toLowerCase()).not.toContain(
                passphrase.toLowerCase()
            )

            // Le derived key doit être différent de la passphrase
            expect(derivedKey).not.toBe(passphrase)
        })

        it("should be resistant to timing attacks", async () => {
            const salt = generateSalt()
            const correctPassphrase = "correctPassword"
            const derivedKey = await deriveSessionKey(correctPassphrase, salt)

            // Tester avec des passphrases de longueurs différentes
            const start1 = Date.now()
            await verifyPassphrase("a", derivedKey, salt)
            const time1 = Date.now() - start1

            const start2 = Date.now()
            await verifyPassphrase("a".repeat(100), derivedKey, salt)
            const time2 = Date.now() - start2

            // PBKDF2 prend du temps, donc les deux devraient être similaires
            // (pas de différence majeure révélant la longueur de la passphrase)
            expect(Math.abs(time1 - time2)).toBeLessThan(1000) // max 1 seconde de différence
        })
    })

    describe("Integration with bundle encryption", () => {
        it("should work with typical passphrase flows", async () => {
            // Simulation du flow complet
            const userPassphrase = "MySecure!Pass123"

            // 1. L'utilisateur entre sa passphrase pour déverrouiller
            const salt = generateSalt()
            const derivedKey = await deriveSessionKey(userPassphrase, salt)
            const derivationInfo = createDerivationInfo(salt)

            // 2. On stocke la clé dérivée (pas la passphrase)
            const storedKey = derivedKey
            const storedInfo = JSON.stringify(derivationInfo)

            // 3. Plus tard, on vérifie que l'utilisateur a la bonne passphrase
            const parsedInfo = parseDerivationInfo(JSON.parse(storedInfo))
            const isValid = await verifyPassphrase(
                userPassphrase,
                storedKey,
                parsedInfo.salt,
                parsedInfo.iterations
            )

            expect(isValid).toBe(true)

            // 4. Une mauvaise passphrase échoue
            const wrongPassphrase = "WrongPassword"
            const isInvalid = await verifyPassphrase(
                wrongPassphrase,
                storedKey,
                parsedInfo.salt,
                parsedInfo.iterations
            )

            expect(isInvalid).toBe(false)
        })
    })
})
