import { Smartphone, Cloud, Lock, Shield, Info, X } from "lucide-react"


type Props = {
    isNewDevice?: boolean
    deviceName?: string
    onClose?: () => void
}

export function MultiDeviceExplainer({
    isNewDevice,
    deviceName,
    onClose,
}: Props) {
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Smartphone className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">
                            {isNewDevice
                                ? "Nouvel appareil détecté"
                                : "Messagerie multi-appareils"}
                        </h3>
                        {deviceName && (
                            <p className="text-xs text-muted-foreground">{deviceName}</p>
                        )}
                    </div>
                </div>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        aria-label="Fermer"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {/* Alerte nouvel appareil */}
            {isNewDevice && (
                <div className="flex gap-2.5 text-xs">
                    <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary dark:text-primary-light" />
                    <div>
                        <span className="font-medium text-foreground">
                            Tu auras besoin de ton code PIN{" "}
                        </span>
                        <span className="text-muted-foreground">
                            pour récupérer tes messages depuis cet appareil.
                        </span>
                    </div>
                </div>
            )}

            {/* Comment ça marche */}
            <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                        <Lock className="h-3 w-3" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-foreground">Chiffrement de bout en bout</p>
                        <p className="text-xs text-muted-foreground">Tes messages sont chiffrés avec tes clés privées — personne d&apos;autre ne peut les lire.</p>
                    </div>
                </div>

                <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light">
                        <Cloud className="h-3 w-3" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-foreground">Sauvegarde chiffrée cloud</p>
                        <p className="text-xs text-muted-foreground">Tes clés sont dans le cloud, protégées par ton PIN. Le serveur ne peut pas les déchiffrer.</p>
                    </div>
                </div>

                <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400">
                        <Smartphone className="h-3 w-3" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-foreground">Multi-appareils</p>
                        <p className="text-xs text-muted-foreground">Connecte-toi avec le même compte et ton PIN pour accéder à tes messages partout.</p>
                    </div>
                </div>
            </div>

            {/* Avertissement PIN */}
            <div className="flex gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <Shield className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                <p>
                    <span className="font-medium text-foreground">PIN perdu = messages perdus.</span>{" "}
                    Il n&apos;existe pas de récupération — même nous ne pouvons pas déchiffrer tes données.
                </p>
            </div>

            {/* Astuce utilisateurs existants */}
            {!isNewDevice && (
                <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Astuce : </span>
                    Sur un nouvel appareil, connecte-toi avec le même compte et entre ton PIN pour synchroniser tes clés.
                </p>
            )}
        </div>
    )
}
