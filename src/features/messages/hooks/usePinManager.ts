import { useAuth } from "@/features/auth/hooks/useAuth"
import type { Json } from "@/integrations/supabase/types"
import { useCallback, useEffect, useState } from "react"
import {
    encryptKeyBundle,
    generateKeyPairBase64,
    generateSignKeyPairBase64,
} from "../core/crypto"
import {
    fetchRemoteBundle,
    saveRemoteBundle,
    fetchAutoPassphrase,
    deleteAutoPassphrase,
    deleteRemoteBundle,
} from "../services/keyBundleService"
import { deleteRemoteUserKeys } from "../services/userKeysService"
import { recoverKeyBundle } from "../core/bundleValidation"
import {
    deriveSessionKey,
    generateSalt,
    createDerivationInfo,
} from "../core/keyDerivation"
import { markDeviceUsed, isFirstUse, resetFirstUse } from "../core/deviceInfo"
import {
    clearBundleStorage,
    clearLegacyKeyPairs,
    clearLocalVaultStorage,
    clearPendingAuthSecret,
    clearRememberedUnlock,
    clearSessionUnlock,
    loadKeyPair,
    loadRatchetKeyPair,
    loadSignKeyPair,
    readEncryptedBundle,
    readPendingAuthSecret,
    readSessionKeys,
    writeEncryptedBundle,
    writeRememberedDerivationInfo,
    writeRememberedUnlock,
    writeSessionDerivationInfo,
    writeSessionKeys,
    writeSessionUnlock,
    writePakeExportKey,
    readPakeExportKey,
    type StoredKeyPair,
} from "../core/storage"
import {
    PAKE_ENABLED,
    getPakeStatus,
    deletePakeRegistration,
    registerWithPake,
    loginWithPake,
    PakeTooManyAttemptsError,
} from "../core/pake"
import { eventLogger } from "../core/logger"

async function persistSessionKeys(passphrase: string): Promise<void> {
    const salt = generateSalt()
    const derivedKey = await deriveSessionKey(passphrase, salt)
    writeSessionUnlock(derivedKey)
    writeSessionDerivationInfo(JSON.stringify(createDerivationInfo(salt)))
}

async function persistRememberedKeys(passphrase: string): Promise<void> {
    const salt = generateSalt()
    const derivedKey = await deriveSessionKey(passphrase, salt)
    writeRememberedUnlock(derivedKey)
    writeRememberedDerivationInfo(JSON.stringify(createDerivationInfo(salt)))
}

export function usePinManager() {
    const { user, session } = useAuth()
    const [keyPair, setKeyPair] = useState<StoredKeyPair | null>(null)
    const [ratchetKeyPair, setRatchetKeyPair] = useState<StoredKeyPair | null>(
        null
    )
    const [signKeyPair, setSignKeyPair] = useState<StoredKeyPair | null>(null)
    const [ready, setReady] = useState(false)
    const [locked, setLocked] = useState(true)
    const [needsPassphrase, setNeedsPassphrase] = useState(false)
    const [needsPinSetup, setNeedsPinSetup] = useState(false)
    const [setupInProgress, setSetupInProgress] = useState(false)
    const [setupError, setSetupError] = useState<string | null>(null)
    const [remoteBundleAvailable, setRemoteBundleAvailable] = useState(false)
    const [unlocking, setUnlocking] = useState(false)
    const [unlockError, setUnlockError] = useState<string | null>(null)
    const [bundleSynced, setBundleSynced] = useState(false)
    const [showMagicLinkHint, setShowMagicLinkHint] = useState(false)
    const [autoUnlockAt, setAutoUnlockAt] = useState<number | null>(null)
    const [bootstrapTrigger, setBootstrapTrigger] = useState(0)
    const userId = user?.user_id ?? null
    const authHeader = session?.access_token
        ? `Bearer ${session.access_token}`
        : null

    const setupPin = useCallback(
        async (pin: string) => {
            if (!userId || !authHeader) return false
            setSetupInProgress(true)
            setSetupError(null)
            try {
                if (PAKE_ENABLED) {
                    try {
                        await deletePakeRegistration({ userId, authHeader })
                    } catch {
                        // Ignore if no registration found
                    }
                }

                const passphrase = await registerWithPake(
                    { userId, authHeader },
                    pin
                )

                // Déjà déverrouillé (ancien mode sans PIN) : on rechiffre les
                // clés existantes sous le PIN au lieu d'en générer, sinon
                // l'utilisateur perd tout son historique.
                const nextKey = keyPair ?? generateKeyPairBase64()
                const nextRatchet = ratchetKeyPair ?? generateKeyPairBase64()
                const nextSign = signKeyPair ?? generateSignKeyPairBase64()

                const encrypted = await encryptKeyBundle(
                    {
                        keyPair: nextKey,
                        ratchetKeyPair: nextRatchet,
                        signKeyPair: nextSign,
                    },
                    passphrase
                )
                writeEncryptedBundle(encrypted)
                if (!(await saveRemoteBundle(userId, encrypted as Json))) {
                    throw new Error("Remote bundle save failed")
                }
                writePakeExportKey(passphrase)
                // Le bundle distant ne s'ouvre plus qu'avec le PIN : la
                // passphrase auto gardée côté serveur peut disparaître.
                await deleteAutoPassphrase(userId)

                setKeyPair(nextKey)
                setRatchetKeyPair(nextRatchet)
                setSignKeyPair(nextSign)
                setLocked(false)
                setReady(true)
                setNeedsPinSetup(false)

                const newBundle = {
                    keyPair: nextKey,
                    ratchetKeyPair: nextRatchet,
                    signKeyPair: nextSign,
                }
                writeSessionKeys(JSON.stringify(newBundle))

                await persistSessionKeys(passphrase)
                await persistRememberedKeys(passphrase)

                setBundleSynced(true)
                setRemoteBundleAvailable(false)
                if (isFirstUse()) {
                    markDeviceUsed()
                }
                eventLogger.success("PIN setup successful")
                return true
            } catch (error) {
                console.error("PIN setup failed:", error)
                setSetupError("Failed to set up PIN. Please try again.")
                return false
            } finally {
                setSetupInProgress(false)
            }
        },
        [userId, authHeader, keyPair, ratchetKeyPair, signKeyPair]
    )

    const unlockWithPassphrase = useCallback(
        async (passphrase: string) => {
            if (!userId) return false
            setUnlocking(true)
            setUnlockError(null)
            try {
                const recovery = await recoverKeyBundle(userId, passphrase)
                const bundle = recovery.bundle

                if (!bundle) {
                    if (
                        !recovery.diagnostics.hasLocal &&
                        !recovery.diagnostics.hasRemote
                    ) {
                        // No bundle exists, create a new one
                    } else {
                        setUnlockError(
                            recovery.errorMessage || "Failed to decrypt keys"
                        )
                        return false
                    }
                } else {
                    if (recovery.source === "remote") {
                        setBundleSynced(true)
                        setRemoteBundleAvailable(false)
                    }

                    setKeyPair(bundle.keyPair)
                    setRatchetKeyPair(bundle.ratchetKeyPair)
                    setSignKeyPair(bundle.signKeyPair)
                    setLocked(false)
                    setReady(true)

                    if (isFirstUse()) {
                        markDeviceUsed()
                    }
                    writeSessionKeys(JSON.stringify(bundle))
                    await persistSessionKeys(passphrase)
                    if (PAKE_ENABLED) {
                        await persistRememberedKeys(passphrase)
                    }

                    setBundleSynced(true)
                    setRemoteBundleAvailable(false)
                    return true
                }

                const existingKey = loadKeyPair()
                const existingRatchet = loadRatchetKeyPair()
                const existingSign = loadSignKeyPair()
                const nextKey = existingKey ?? generateKeyPairBase64()
                const nextRatchet = existingRatchet ?? generateKeyPairBase64()
                const nextSign = existingSign ?? generateSignKeyPairBase64()

                const encrypted = await encryptKeyBundle(
                    {
                        keyPair: nextKey,
                        ratchetKeyPair: nextRatchet,
                        signKeyPair: nextSign,
                    },
                    passphrase
                )
                writeEncryptedBundle(encrypted)
                await saveRemoteBundle(userId, encrypted as Json)
                if (existingKey || existingRatchet || existingSign) {
                    clearLegacyKeyPairs()
                }

                setKeyPair(nextKey)
                setRatchetKeyPair(nextRatchet)
                setSignKeyPair(nextSign)
                setLocked(false)
                setReady(true)

                const newBundle = {
                    keyPair: nextKey,
                    ratchetKeyPair: nextRatchet,
                    signKeyPair: nextSign,
                }
                writeSessionKeys(JSON.stringify(newBundle))
                await persistSessionKeys(passphrase)
                if (PAKE_ENABLED) {
                    await persistRememberedKeys(passphrase)
                }
                setBundleSynced(true)
                setRemoteBundleAvailable(false)
                return true
            } catch (error) {
                console.error("Unlock error:", error)
                setUnlockError("Failed to decrypt keys")
                return false
            } finally {
                setUnlocking(false)
            }
        },
        [userId]
    )

    const unlock = useCallback(
        async (pin: string) => {
            if (PAKE_ENABLED && authHeader) {
                try {
                    const pakePassphrase = await loginWithPake(
                        { userId: userId!, authHeader },
                        pin
                    )
                    writePakeExportKey(pakePassphrase)
                    const pakeSuccess =
                        await unlockWithPassphrase(pakePassphrase)
                    if (pakeSuccess) return true

                    const recovery = await recoverKeyBundle(userId!, pin)
                    if (!recovery.bundle) {
                        setUnlockError("Incorrect PIN")
                        return false
                    }

                    const encrypted = await encryptKeyBundle(
                        recovery.bundle,
                        pakePassphrase
                    )
                    writeEncryptedBundle(encrypted)
                    await saveRemoteBundle(userId!, encrypted as Json)

                    setKeyPair(recovery.bundle.keyPair)
                    setRatchetKeyPair(recovery.bundle.ratchetKeyPair)
                    setSignKeyPair(recovery.bundle.signKeyPair)
                    setLocked(false)
                    setReady(true)
                    writeSessionKeys(JSON.stringify(recovery.bundle))
                    await persistSessionKeys(pakePassphrase)
                    await persistRememberedKeys(pakePassphrase)

                    setBundleSynced(true)
                    setRemoteBundleAvailable(false)
                    if (isFirstUse()) {
                        markDeviceUsed()
                    }
                    eventLogger.success("Bundle migration to PAKE complete")
                    return true
                } catch (error) {
                    if (error instanceof PakeTooManyAttemptsError) {
                        setUnlockError(
                            "Trop de tentatives. Réessaie dans quelques minutes."
                        )
                        return false
                    }

                    const legacySuccess = await unlockWithPassphrase(pin)
                    if (legacySuccess) {
                        try {
                            await deletePakeRegistration({
                                userId: userId!,
                                authHeader,
                            })
                            const newPassphrase = await registerWithPake(
                                { userId: userId!, authHeader },
                                pin
                            )
                            const currentBundle = {
                                keyPair: keyPair!,
                                ratchetKeyPair: ratchetKeyPair!,
                                signKeyPair: signKeyPair!,
                            }
                            const encrypted = await encryptKeyBundle(
                                currentBundle,
                                newPassphrase
                            )
                            writeEncryptedBundle(encrypted)
                            await saveRemoteBundle(userId!, encrypted as Json)
                            eventLogger.success("PAKE migration complete")
                        } catch {
                            // Non-blocking
                        }
                        return true
                    }

                    setUnlockError("Incorrect PIN")
                    return false
                }
            }
            return await unlockWithPassphrase(pin)
        },
        [
            unlockWithPassphrase,
            userId,
            authHeader,
            keyPair,
            ratchetKeyPair,
            signKeyPair,
        ]
    )

    const forceBundleResync = useCallback(async () => {
        if (!userId) return
        try {
            setUnlockError(null)
            setKeyPair(null)
            setRatchetKeyPair(null)
            setSignKeyPair(null)
            setLocked(true)
            setReady(false)
            setNeedsPassphrase(false)
            setBundleSynced(false)
            clearBundleStorage()

            const remoteBundle = await fetchRemoteBundle(userId)
            if (remoteBundle) {
                writeEncryptedBundle(remoteBundle as Json)
                setRemoteBundleAvailable(false)
                setBundleSynced(true)
                setNeedsPassphrase(true)
                setLocked(true)
                setReady(true)
            } else {
                const status =
                    PAKE_ENABLED && authHeader
                        ? await getPakeStatus({ userId, authHeader })
                        : { registered: false }
                if (!status.registered) return
                setRemoteBundleAvailable(false)
            }
        } catch {
            setUnlockError("Sync error. Please try again.")
            setReady(true)
            setLocked(true)
        }
    }, [authHeader, userId])

    const purgeRemoteBundle = useCallback(async () => {
        if (!userId) return
        try {
            await deleteRemoteBundle(userId)
            await deleteRemoteUserKeys(userId)
            await deleteAutoPassphrase(userId)

            if (PAKE_ENABLED && authHeader) {
                try {
                    await deletePakeRegistration({ userId, authHeader })
                } catch {
                    // Ignore
                }
            }

            clearBundleStorage()
            clearLocalVaultStorage()
            clearSessionUnlock()
            clearRememberedUnlock()
            clearPendingAuthSecret()
            resetFirstUse()
            setKeyPair(null)
            setRatchetKeyPair(null)
            setSignKeyPair(null)
            setLocked(true)
            setReady(false)
            setNeedsPassphrase(true)
            setBundleSynced(false)
            setRemoteBundleAvailable(false)
            setUnlockError(null)
            setShowMagicLinkHint(false)
            setAutoUnlockAt(null)
            setBootstrapTrigger((prev) => prev + 1)
        } catch {
            setUnlockError("Failed to delete bundle. Please try again.")
        }
    }, [userId, authHeader])

    const importFromQRCode = useCallback(
        async (exportKey: string) => {
            if (!userId) {
                setUnlockError("User not logged in")
                return false
            }
            try {
                setUnlocking(true)
                setUnlockError(null)
                writePakeExportKey(exportKey)
                await forceBundleResync()
                const success = await unlockWithPassphrase(exportKey)
                if (success) {
                    eventLogger.success("QR Code sync successful")
                    return true
                }
                setUnlockError("Failed to unlock with this QR Code")
                return false
            } catch {
                setUnlockError("Error importing QR Code")
                return false
            } finally {
                setUnlocking(false)
            }
        },
        [userId, forceBundleResync, unlockWithPassphrase]
    )

    const getExportKeyForQRCode = useCallback((): string | null => {
        return readPakeExportKey()
    }, [])

    useEffect(() => {
        if (!userId) {
            // Resync hint when user/lock state changes
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setShowMagicLinkHint(false)
            return
        }
        if (!locked) {
            // Resync hint when user/lock state changes
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setShowMagicLinkHint(false)
            return
        }
        const existingBundle = readEncryptedBundle()
        if (!existingBundle) return

        const sessionKeys = readSessionKeys()
        if (sessionKeys) {
            try {
                const bundle = JSON.parse(sessionKeys) as {
                    keyPair: StoredKeyPair
                    ratchetKeyPair: StoredKeyPair
                    signKeyPair: StoredKeyPair
                }
                // Auto-unlock from existing session keys (entity resync on mount)
                /* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect */
                setKeyPair(bundle.keyPair)
                setRatchetKeyPair(bundle.ratchetKeyPair)
                setSignKeyPair(bundle.signKeyPair)
                setLocked(false)
                setReady(true)
                setAutoUnlockAt(Date.now())
                /* eslint-enable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */
                return
            } catch {
                clearSessionUnlock()
            }
        }

        // Try all auto-unlock methods in order (no PIN required)
        void (async () => {
            // 1. Local device passphrase (même appareil, nouvel onglet)
            const localPassphrase = readPakeExportKey()
            if (localPassphrase) {
                const ok = await unlockWithPassphrase(localPassphrase)
                if (ok) setAutoUnlockAt(Date.now())
                return
            }

            // 2. Remote auto passphrase (nouvel appareil, même compte).
            // ponytail: transitoire — seul accès des comptes créés sans PIN à
            // leur historique ; l'effet suivant leur impose ensuite un PIN.
            // À supprimer avec la table cryptedmessage_autopassphrase.
            if (userId) {
                const remotePassphrase = await fetchAutoPassphrase(userId)
                if (remotePassphrase) {
                    writePakeExportKey(remotePassphrase)
                    const ok = await unlockWithPassphrase(remotePassphrase)
                    if (ok) setAutoUnlockAt(Date.now())
                    return
                }
            }

            // 3. PAKE pending secret (magic link flow)
            if (!PAKE_ENABLED) return
            const pendingSecret = readPendingAuthSecret()
            if (pendingSecret) {
                const ok = await unlock(pendingSecret)
                if (ok) setAutoUnlockAt(Date.now())
                clearPendingAuthSecret()
                return
            }
            setShowMagicLinkHint(true)
        })()
    }, [locked, needsPassphrase, unlock, unlockWithPassphrase, userId])

    // Tant que le serveur garde une passphrase auto pour ce compte (mode sans
    // PIN introduit par 1f94c651), ses messages y restent déchiffrables : on
    // impose le PIN dès le déverrouillage. setupPin supprime la passphrase.
    useEffect(() => {
        if (locked || !userId) return
        let active = true
        void fetchAutoPassphrase(userId).then((passphrase) => {
            if (active && passphrase) setNeedsPinSetup(true)
        })
        return () => {
            active = false
        }
    }, [locked, userId])

    useEffect(() => {
        if (!autoUnlockAt) return
        // Auto-clear autoUnlockAt after 3 seconds to prevent duplicate notifications
        // when switching between chats. This matches the duration in useChatLayout.
        const timer = window.setTimeout(() => {
            setAutoUnlockAt(null)
        }, 3000)
        return () => window.clearTimeout(timer)
    }, [autoUnlockAt])

    useEffect(() => {
        if (!userId) return
        const existingBundle = readEncryptedBundle()
        const isNewDevice = isFirstUse()
        if (existingBundle && !isNewDevice) return

        let active = true
        const bootstrap = async () => {
            const remoteBundle = await fetchRemoteBundle(userId)
            if (!active) return
            if (remoteBundle) {
                const existingSessionKeys = readSessionKeys()
                if (existingSessionKeys) {
                    writeEncryptedBundle(remoteBundle as Json)
                    setBundleSynced(true)
                    setRemoteBundleAvailable(false)
                    return
                }
                writeEncryptedBundle(remoteBundle as Json)
                setNeedsPassphrase(true)
                setLocked(true)
                setReady(true)
                setBundleSynced(true)
                setRemoteBundleAvailable(false)
                return
            }

            const status =
                PAKE_ENABLED && authHeader
                    ? await getPakeStatus({ userId, authHeader })
                    : { registered: false }
            if (!active) return

            setRemoteBundleAvailable(false)

            if (!status.registered) {
                // PIN obligatoire : jamais de clés sans PIN, sinon le bundle
                // n'est protégé que par un secret que le serveur détient.
                setNeedsPinSetup(true)
                setLocked(true)
                setReady(true)
            } else {
                setNeedsPassphrase(true)
                setNeedsPinSetup(false)
                setLocked(true)
                setReady(true)
            }
        }

        bootstrap().catch(() => {
            if (!active) return
            setUnlockError("Initialization error. Please try again.")
            setReady(true)
            setLocked(true)
            setNeedsPassphrase(false)
        })

        return () => {
            active = false
        }
    }, [authHeader, userId, bootstrapTrigger])

    return {
        keyPair,
        ratchetKeyPair,
        signKeyPair,
        ready,
        locked,
        needsPassphrase,
        needsPinSetup,
        setupPin,
        setupInProgress,
        setupError,
        unlocking,
        unlockError,
        unlock,
        userId,
        bundleSynced,
        showMagicLinkHint,
        autoUnlockAt,
        remoteBundleAvailable,
        forceBundleResync,
        purgeRemoteBundle,
        importFromQRCode,
        getExportKeyForQRCode,
    }
}
