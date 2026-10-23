import { useEffect, useState } from "react"

const AUTO_UNLOCK_DURATION_MS = 3000
const AUTO_UNLOCK_EXIT_MS = 220

type Props = {
    /** Une erreur n'a de sens qu'au sein d'une conversation ouverte. */
    hasActiveConversation: boolean
    error: string | null
    showAutoUnlock: boolean
}

export function ChatAlerts({
    hasActiveConversation,
    error,
    showAutoUnlock,
}: Props) {
    const [progressPercent, setProgressPercent] = useState(100)
    const [renderAutoUnlock, setRenderAutoUnlock] = useState(showAutoUnlock)
    const [autoUnlockVisible, setAutoUnlockVisible] = useState(showAutoUnlock)

    useEffect(() => {
        if (showAutoUnlock) {
            // Resync render state on prop change to drive enter animation
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setRenderAutoUnlock(true)
            const frame = window.requestAnimationFrame(() => {
                setAutoUnlockVisible(true)
            })
            return () => window.cancelAnimationFrame(frame)
        }

        // Resync render state on prop change to drive exit animation
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setAutoUnlockVisible(false)
        const timer = window.setTimeout(() => {
            setRenderAutoUnlock(false)
        }, AUTO_UNLOCK_EXIT_MS)
        return () => window.clearTimeout(timer)
    }, [showAutoUnlock])

    useEffect(() => {
        if (!showAutoUnlock) {
            // Reset progress bar when alert hides (prop-driven resync)
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setProgressPercent(100)
            return
        }

        // Restart progress bar countdown on each show (prop-driven resync)
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setProgressPercent(100)
        const tickMs = 50
        const totalTicks = AUTO_UNLOCK_DURATION_MS / tickMs
        const step = 100 / totalTicks

        const interval = window.setInterval(() => {
            setProgressPercent((prev) => Math.max(0, prev - step))
        }, tickMs)

        return () => window.clearInterval(interval)
    }, [showAutoUnlock])

    return (
        <>
            {error && hasActiveConversation ? (
                <div className="mx-4 mt-3 rounded-md border border-destructive/30 bg-destructive-light p-3 text-xs text-destructive">
                    <div className="font-medium">{error}</div>
                </div>
            ) : null}

            {renderAutoUnlock ? (
                <div
                    className="mx-4 mt-3 rounded-lg border border-success/30 bg-success-light p-3 transition-[opacity,transform] duration-base ease-out"
                    style={{
                        opacity: autoUnlockVisible ? 1 : 0,
                        transform: autoUnlockVisible
                            ? "translateY(0px)"
                            : "translateY(-4px)",
                    }}
                >
                    <div className="flex items-start gap-2">
                        <span className="text-lg">✅</span>
                        <div>
                            <div className="text-sm font-semibold text-success">
                                Session deverrouillee automatiquement
                            </div>
                            <div className="mt-1 text-xs text-success/90">
                                Tes cles ont ete recuperees depuis le stockage
                                securise de cet appareil.
                            </div>
                            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-success/20">
                                <div
                                    className="h-full bg-success transition-[width] duration-instant ease-linear"
                                    style={{
                                        width: `${progressPercent}%`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

        </>
    )
}
