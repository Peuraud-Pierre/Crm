import { AlertTriangle, XOctagon } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { usePrefersReducedMotion } from "@/shared/hooks/usePrefersReducedMotion"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/atoms/alert"
import type { DashboardAlert } from "@/features/arrivage-admin/types"

/**
 * Bandeau d'alertes du dashboard. Ne rend rien quand tout va bien : l'absence
 * de bandeau est elle-même l'information.
 *
 * `AnimatePresence` sert surtout à la *sortie* : une alerte qui se résout
 * (l'API revient) doit se replier visiblement plutôt que disparaître d'un coup
 * en faisant sauter le reste de la page.
 */
export function AlertsBanner({ alerts }: { alerts: DashboardAlert[] }) {
    const reducedMotion = usePrefersReducedMotion()

    return (
        <AnimatePresence initial={false}>
            {alerts.length > 0 && (
                <motion.div
                    key="alerts"
                    initial={reducedMotion ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                >
                    <div className="space-y-3">
                        {alerts.map(alert => {
                            const Icon =
                                alert.tone === "destructive"
                                    ? XOctagon
                                    : AlertTriangle
                            return (
                                <Alert
                                    key={alert.id}
                                    variant={
                                        alert.tone === "destructive"
                                            ? "destructive"
                                            : "default"
                                    }
                                    className={
                                        alert.tone === "warning"
                                            ? "border-warning/50 text-warning"
                                            : undefined
                                    }
                                >
                                    <Icon className="h-4 w-4" />
                                    <AlertTitle>{alert.title}</AlertTitle>
                                    <AlertDescription>
                                        {alert.description}
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
