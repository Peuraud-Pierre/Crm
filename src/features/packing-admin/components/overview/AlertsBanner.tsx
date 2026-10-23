import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, Info, XOctagon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/atoms/alert"
import { Button } from "@/shared/ui/atoms/button"
import { usePrefersReducedMotion } from "@/shared/hooks/usePrefersReducedMotion"
import { DURATION } from "@/shared/lib/motion"
import { TAB_META } from "@/features/packing-admin/constants"
import type { PackingAdminAlert, PackingAdminTab } from "@/features/packing-admin/types"

const ICONS = {
    error: XOctagon,
    warning: AlertTriangle,
    info: Info,
} as const

/**
 * `Alert` n'a que deux variantes (`default`, `destructive`). Le ton
 * d'avertissement est donc posé en classes sur les tokens `--warning`, comme le
 * fait déjà `arrivage-admin` — plutôt que d'ajouter une variante au socle pour
 * deux consommateurs.
 */
const VARIANTS = {
    error: "destructive",
    warning: "default",
    info: "default",
} as const

const TONE_CLASSES = {
    error: undefined,
    warning: "border-warning/50 text-warning",
    info: undefined,
} as const

interface AlertsBannerProps {
    alerts: PackingAdminAlert[]
    onGoToTab: (tab: PackingAdminTab) => void
}

/**
 * Bandeau d'alertes. Ne rend rien quand tout va bien : l'absence de bandeau est
 * elle-même l'information, et une alerte permanente cesse d'être lue.
 *
 * `AnimatePresence` sert surtout à la SORTIE : une alerte qui se résout (le
 * service revient) doit se replier visiblement plutôt que disparaître d'un coup
 * en faisant sauter le reste de la page sous le curseur.
 */
export function AlertsBanner({ alerts, onGoToTab }: AlertsBannerProps) {
    const reducedMotion = usePrefersReducedMotion()

    return (
        <AnimatePresence initial={false}>
            {alerts.length > 0 && (
                <motion.div
                    key="alerts"
                    initial={reducedMotion ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: reducedMotion ? 0 : DURATION.base }}
                    className="overflow-hidden"
                >
                    <div className="flex flex-col gap-3">
                        {alerts.map((alert) => {
                            const Icon = ICONS[alert.level]
                            return (
                                <Alert
                                    key={alert.id}
                                    variant={VARIANTS[alert.level]}
                                    className={TONE_CLASSES[alert.level]}
                                >
                                    <Icon className="h-4 w-4" />
                                    <AlertTitle>{alert.title}</AlertTitle>
                                    <AlertDescription className="flex flex-col items-start gap-2">
                                        <span>{alert.detail}</span>
                                        {alert.tab && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => onGoToTab(alert.tab as PackingAdminTab)}
                                            >
                                                Voir « {TAB_META[alert.tab].label} »
                                            </Button>
                                        )}
                                    </AlertDescription>
                                </Alert>
                            )
                        })}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
