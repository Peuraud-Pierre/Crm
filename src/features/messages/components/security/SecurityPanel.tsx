import { useEffect, useState } from "react"
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/shared/ui/atoms/drawer"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/atoms/popover"
import {
    AlertTriangle,
    CheckCircle2,
    CloudDownload,
    Shield,
    QrCode,
} from "lucide-react"
import { QRCodeExport } from "./QRCodeSync"
import { Button } from "@/shared/ui/atoms/button"


type Props = {
    isDesktop: boolean
    open: boolean
    onOpenChange: (value: boolean) => void
    locked: boolean
    needsPassphrase: boolean
    remoteBundleAvailable: boolean
    forceBundleResync: () => Promise<void>
    purgeRemoteBundle: () => Promise<void>
    getExportKeyForQRCode: () => string | null
}

export function SecurityPanel({
    isDesktop,
    open,
    onOpenChange,
    locked,
    needsPassphrase,
    forceBundleResync,
    purgeRemoteBundle,
    getExportKeyForQRCode,
}: Props) {
    const indicatorClass = locked ? "bg-amber-400" : "bg-emerald-400"
    const [isAutoResyncing, setIsAutoResyncing] = useState(false)
    const [showQRExport, setShowQRExport] = useState(false)

    useEffect(() => {
        if (!locked || needsPassphrase || isAutoResyncing) return

        const timer = setTimeout(async () => {
            setIsAutoResyncing(true)
            try {
                await forceBundleResync()
            } catch (err) {
                console.error("Auto-resync failed:", err)
            } finally {
                setIsAutoResyncing(false)
            }
        }, 8000)

        return () => clearTimeout(timer)
    }, [locked, needsPassphrase, forceBundleResync, isAutoResyncing])

    const trigger = (
        <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted"
        >
            <span className={`h-2 w-2 rounded-full ${indicatorClass}`} />
            <Shield className="h-4 w-4" />
            Options
        </button>
    )

    const content = (
        <div className="space-y-3 text-sm">
            {/* Statut */}
            {locked ? (
                <p className="text-xs text-muted-foreground">
                    {isAutoResyncing
                        ? "Récupération des clés..."
                        : "Initialisation du chiffrement..."}
                </p>
            ) : (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Session active
                </div>
            )}

            <div className="h-px bg-border" />

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm transition hover:bg-muted"
                    onClick={() => void forceBundleResync()}
                >
                    <CloudDownload className="h-3 w-3" />
                    Resynchroniser
                </button>
                {!locked && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-[11px]"
                        onClick={() => setShowQRExport(true)}
                    >
                        <QrCode className="h-3 w-3" />
                        QR Code
                    </Button>
                )}
            </div>

            <div className="h-px bg-border" />

            {/* Danger */}
            <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 px-3 py-1 text-[11px] font-semibold text-destructive transition hover:bg-destructive/5"
                onClick={() => {
                    if (
                        confirm(
                            "Supprimer la sauvegarde cloud effacera tes clés de chiffrement du serveur. Continuer ?"
                        )
                    ) {
                        void purgeRemoteBundle()
                    }
                }}
            >
                <AlertTriangle className="h-3 w-3" />
                Réinitialiser
            </button>
        </div>
    )

    if (isDesktop) {
        return (
            <Popover open={open} onOpenChange={onOpenChange}>
                <PopoverTrigger asChild>{trigger}</PopoverTrigger>
                <PopoverContent
                    align="center"
                    side="bottom"
                    sideOffset={10}
                    collisionPadding={12}
                    className="w-[320px] max-w-[92vw] max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-xl sm:w-[360px]"
                >
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Shield className="h-4 w-4" />
                            Options
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                            Local
                        </span>
                    </div>
                    {content}
                </PopoverContent>
            </Popover>
        )
    }

    return (
        <>
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerTrigger asChild>{trigger}</DrawerTrigger>
                <DrawerContent className="rounded-t-2xl border-border bg-background">
                    <DrawerHeader className="flex-shrink-0 pb-2">
                        <DrawerTitle className="flex items-center justify-center gap-2 text-sm">
                            <Shield className="h-4 w-4" />
                            Options
                        </DrawerTitle>
                    </DrawerHeader>
                    <div
                        className="max-h-[70vh] overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-6"
                        style={{ WebkitOverflowScrolling: "touch" }}
                    >
                        {content}
                    </div>
                </DrawerContent>
            </Drawer>

            {showQRExport &&
                (() => {
                    const exportKey = getExportKeyForQRCode()
                    return exportKey ? (
                        <QRCodeExport
                            exportKey={exportKey}
                            onClose={() => setShowQRExport(false)}
                        />
                    ) : null
                })()}
        </>
    )
}
