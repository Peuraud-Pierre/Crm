import { beforeEach, describe, expect, rstest, test } from "@rstest/core"
import { act, renderHook, waitFor } from "@testing-library/react"
import {
    readPakeExportKey,
    writeEncryptedBundle,
    writeSessionKeys,
} from "../core/storage"
import { usePinManager } from "./usePinManager"

const mocks = rstest.hoisted(() => ({
    fetchRemoteBundle: rstest.fn(),
    saveRemoteBundle: rstest.fn(),
    fetchAutoPassphrase: rstest.fn(),
    deleteAutoPassphrase: rstest.fn(),
    getPakeStatus: rstest.fn(),
    registerWithPake: rstest.fn(),
    encryptKeyBundle: rstest.fn(),
}))

rstest.mock("@/features/auth/hooks/useAuth", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mock de hook
    useAuth: () => ({
        user: { user_id: "u1" },
        session: { access_token: "jwt" },
    }),
}))

rstest.mock("../services/keyBundleService", () => ({
    fetchRemoteBundle: mocks.fetchRemoteBundle,
    saveRemoteBundle: mocks.saveRemoteBundle,
    fetchAutoPassphrase: mocks.fetchAutoPassphrase,
    deleteAutoPassphrase: mocks.deleteAutoPassphrase,
    deleteRemoteBundle: rstest.fn(),
}))

rstest.mock("../services/userKeysService", () => ({
    deleteRemoteUserKeys: rstest.fn(),
}))

rstest.mock("../core/bundleValidation", () => ({
    recoverKeyBundle: rstest.fn(),
}))

rstest.mock("../core/pake", () => ({
    PAKE_ENABLED: true,
    getPakeStatus: mocks.getPakeStatus,
    registerWithPake: mocks.registerWithPake,
    deletePakeRegistration: rstest.fn().mockResolvedValue(undefined),
    loginWithPake: rstest.fn(),
    PakeTooManyAttemptsError: class extends Error {},
}))

rstest.mock("../core/crypto", () => ({
    encryptKeyBundle: mocks.encryptKeyBundle,
    generateKeyPairBase64: () => ({ publicKey: "new", secretKey: "new" }),
    generateSignKeyPairBase64: () => ({ publicKey: "new", secretKey: "new" }),
}))

rstest.mock("../core/keyDerivation", () => ({
    deriveSessionKey: rstest.fn().mockResolvedValue("derived"),
    generateSalt: () => new Uint8Array(32),
    createDerivationInfo: () => ({}),
}))

rstest.mock("../core/deviceInfo", () => ({
    isFirstUse: () => false,
    markDeviceUsed: rstest.fn(),
    resetFirstUse: rstest.fn(),
}))

const existingKeys = {
    keyPair: { publicKey: "old-pub", secretKey: "old-sec" },
    ratchetKeyPair: { publicKey: "old-r-pub", secretKey: "old-r-sec" },
    signKeyPair: { publicKey: "old-s-pub", secretKey: "old-s-sec" },
}

/** Compte créé sans PIN (1f94c651), déjà déverrouillé sur cet appareil. */
function renderPinlessAccount() {
    writeEncryptedBundle({ salt_b64: "s", iv_b64: "i", ciphertext_b64: "c" })
    writeSessionKeys(JSON.stringify(existingKeys))
    mocks.fetchAutoPassphrase.mockResolvedValue("auto-uuid")
    return renderHook(() => usePinManager())
}

describe("usePinManager — PIN obligatoire", () => {
    beforeEach(() => {
        sessionStorage.clear()
        mocks.fetchRemoteBundle.mockReset().mockResolvedValue(null)
        mocks.saveRemoteBundle.mockReset().mockResolvedValue(true)
        mocks.fetchAutoPassphrase.mockReset().mockResolvedValue(null)
        mocks.deleteAutoPassphrase.mockReset().mockResolvedValue(undefined)
        mocks.getPakeStatus.mockReset().mockResolvedValue({ registered: false })
        mocks.registerWithPake.mockReset().mockResolvedValue("pake-export-key")
        mocks.encryptKeyBundle.mockReset().mockResolvedValue({
            salt_b64: "s",
            iv_b64: "i",
            ciphertext_b64: "c",
        })
    })

    test("nouveau compte : PIN exigé, aucune clé créée ni envoyée", async () => {
        const { result } = renderHook(() => usePinManager())

        await waitFor(() => expect(result.current.needsPinSetup).toBe(true))
        expect(result.current.locked).toBe(true)
        expect(result.current.keyPair).toBeNull()
        expect(mocks.saveRemoteBundle).not.toHaveBeenCalled()
    })

    test("compte sans PIN : clés existantes rechiffrées, passphrase auto supprimée", async () => {
        const { result } = renderPinlessAccount()
        await waitFor(() => expect(result.current.needsPinSetup).toBe(true))
        expect(result.current.locked).toBe(false)

        let ok = false
        await act(async () => {
            ok = await result.current.setupPin("123456")
        })

        expect(ok).toBe(true)
        expect(mocks.encryptKeyBundle).toHaveBeenCalledWith(
            existingKeys,
            "pake-export-key"
        )
        expect(mocks.deleteAutoPassphrase).toHaveBeenCalledWith("u1")
        expect(readPakeExportKey()).toBe("pake-export-key")
        expect(result.current.needsPinSetup).toBe(false)
    })

    test("échec d'écriture du bundle distant : la passphrase auto est conservée", async () => {
        mocks.saveRemoteBundle.mockResolvedValue(false)
        const errSpy = rstest.spyOn(console, "error").mockImplementation(() => {})
        const { result } = renderPinlessAccount()
        await waitFor(() => expect(result.current.needsPinSetup).toBe(true))

        let ok = true
        await act(async () => {
            ok = await result.current.setupPin("123456")
        })

        expect(ok).toBe(false)
        expect(mocks.deleteAutoPassphrase).not.toHaveBeenCalled()
        expect(result.current.needsPinSetup).toBe(true)
        expect(errSpy).toHaveBeenCalledWith("PIN setup failed:", expect.any(Error))
        errSpy.mockRestore()
    })
})
