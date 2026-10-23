import { useCallback, useEffect, useRef, useState } from "react"
import {
    AlertTriangle,
    ChevronDown,
    CloudDownload,
    Shield,
    Trash2,
    QrCode,
} from "lucide-react"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/shared/ui/molecules/input-otp"
import { LoadingSpinner } from "@/shared/ui/atoms/loading-spinner"
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/shared/ui/atoms/drawer"
import { DeviceInfoPanel } from "./DeviceInfoPanel"
import { QRCodeImport } from "./QRCodeSync"
import { Button } from "@/shared/ui/atoms/button"


const OTP_SLOT_KEYS = ["s0", "s1", "s2", "s3", "s4", "s5"] as const

type Props = {
    onUnlock: (passphrase: string) => Promise<boolean>
    unlocking: boolean
    unlockError: string | null
    remoteBundleAvailable: boolean
    forceBundleResync: () => Promise<void>
    purgeRemoteBundle: () => Promise<void>
    importFromQRCode: (exportKey: string) => Promise<boolean>
}

export function PinUnlockScreen({
    onUnlock,
    unlocking,
    unlockError,
    remoteBundleAvailable,
    forceBundleResync,
    purgeRemoteBundle,
    importFromQRCode,
}: Props) {
    const [pin, setPin] = useState("")
    const [shaking, setShaking] = useState(false)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [showQRScanner, setShowQRScanner] = useState(false)
    const submittedRef = useRef(false)

    // Auto-submit when 6 digits are entered
    useEffect(() => {
        if (pin.length !== 6 || submittedRef.current || unlocking) return
        submittedRef.current = true
        let resetTimer: number | undefined
        void onUnlock(pin).then((ok) => {
            if (!ok) {
                // Trigger shake animation then reset
                setShaking(true)
                resetTimer = window.setTimeout(() => {
                    setShaking(false)
                    setPin("")
                    submittedRef.current = false
                }, 700)
            }
        })
        return () => window.clearTimeout(resetTimer)
    }, [pin, onUnlock, unlocking])

    // Reset submitted ref when pin changes below 6
    useEffect(() => {
        if (pin.length < 6) {
            submittedRef.current = false
        }
    }, [pin])

    const handlePurge = useCallback(() => {
        if (
            confirm(
                "Supprimer la sauvegarde cloud effacera tes cles de chiffrement du serveur. Tu ne pourras plus recuperer tes messages sur de nouveaux appareils. Continuer ?"
            )
        ) {
            void purgeRemoteBundle()
        }
    }, [purgeRemoteBundle])

    return (
        <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-6">
            {/* Shield icon */}
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-10 w-10 text-primary" />
            </div>

            {/* Title */}
            <h2 className="text-xl font-semibold text-foreground">
                Messages chiffres
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
                Entre ton code PIN a 6 chiffres
            </p>

            {/* PIN Input */}
            <div className="mt-8">
                {unlocking ? (
                    <div className="flex h-12 items-center justify-center">
                        <LoadingSpinner size="md" />
                        <span className="ml-3 text-sm text-muted-foreground">
                            Deverrouillage...
                        </span>
                    </div>
                ) : (
                    <div className={shaking ? "animate-shake" : ""}>
                        <InputOTP
                            maxLength={6}
                            value={pin}
                            onChange={setPin}
                            autoFocus
                        >
                            <InputOTPGroup>
                                {OTP_SLOT_KEYS.map((slotKey, i) => (
                                    <InputOTPSlot
                                        key={slotKey}
                                        index={i}
                                        className={
                                            shaking || unlockError
                                                ? "border-destructive text-destructive ring-destructive ring-destructive/30"
                                                : ""
                                        }
                                    />
                                ))}
                            </InputOTPGroup>
                        </InputOTP>
                    </div>
                )}
            </div>

            {/* Error message */}
            {unlockError && !shaking ? (
                <p className="mt-3 text-sm text-destructive">
                    Code incorrect, reessaie
                </p>
            ) : null}

            {/* Hint */}
            <p className="mt-6 text-center text-xs text-muted-foreground">
                Meme code PIN sur tous tes appareils
            </p>

            {/* QR Code sync */}
            <div className="mt-4">
                <Button
                    onClick={() => setShowQRScanner(true)}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                >
                    <QrCode className="h-4 w-4" />
                    Scanner QR Code pour synchroniser
                </Button>
            </div>

            {/* QR Scanner Modal */}
            {showQRScanner && (
                <QRCodeImport
                    onScanSuccess={async (exportKey) => {
                        setShowQRScanner(false)
                        const success = await importFromQRCode(exportKey)
                        if (!success) {
                            // L'erreur sera affichée via unlockError
                        }
                    }}
                    onClose={() => setShowQRScanner(false)}
                />
            )}

            {/* Cloud recovery notice */}
            {remoteBundleAvailable ? (
                <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 px-4 py-2 text-center text-xs text-warning">
                    Une sauvegarde cloud est disponible
                </div>
            ) : null}

            {/* Advanced options drawer */}
            <div className="mt-8">
                <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                    <DrawerTrigger asChild>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
                        >
                            Options avancees
                            <ChevronDown className="h-3 w-3" />
                        </button>
                    </DrawerTrigger>
                    <DrawerContent className="rounded-t-2xl">
                        <DrawerHeader className="pb-2">
                            <DrawerTitle className="text-center text-sm">
                                Options avancees
                            </DrawerTitle>
                        </DrawerHeader>
                        <div className="space-y-4 px-4 pb-8">
                            <DeviceInfoPanel />

                            {/* Cloud sync */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    <CloudDownload className="h-3.5 w-3.5" />
                                    Synchronisation
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Tes cles sont sauvegardees de maniere
                                    chiffree dans le cloud.
                                </p>
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
                                    onClick={() => {
                                        void forceBundleResync()
                                    }}
                                >
                                    <CloudDownload className="h-3.5 w-3.5" />
                                    Recuperer depuis le cloud
                                </button>
                            </div>

                            {/* Danger zone */}
                            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-destructive">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Zone dangereuse
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Supprime les cles locales et distantes. Les
                                    anciens messages pourront devenir
                                    indechiffrables.
                                </p>
                                <button
                                    type="button"
                                    className="mt-2 inline-flex items-center gap-2 rounded-full border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10"
                                    onClick={handlePurge}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Supprimer du cloud
                                </button>
                            </div>
                        </div>
                    </DrawerContent>
                </Drawer>
            </div>
        </div>
    )
}
