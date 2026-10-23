import { useCallback, useEffect, useRef, useState } from "react"

export type UseChatLayoutParams = {
    activeConversationKey: string | null
    hasMessages: boolean
    messageCount: number
    latestMessageIsMine: boolean
    bundleSynced: boolean
    autoUnlockAt: number | null
    onReachBottom: () => Promise<void> | void
}

export function useChatLayout({
    activeConversationKey,
    hasMessages,
    messageCount,
    latestMessageIsMine,
    bundleSynced,
    autoUnlockAt,
    onReachBottom,
}: UseChatLayoutParams) {
    const [showUsers, setShowUsers] = useState(true)
    const [securityOpen, setSecurityOpen] = useState(false)
    const [isDesktop, setIsDesktop] = useState(
        () =>
            typeof window !== "undefined" &&
            window.matchMedia("(min-width: 1024px)").matches
    )
    const [showBundleSynced, setShowBundleSynced] = useState(false)
    const [showAutoUnlock, setShowAutoUnlock] = useState(false)
    const messagesRef = useRef<HTMLDivElement | null>(null)
    const isAtBottomRef = useRef(true)
    const lastAutoUnlockAtRef = useRef<number | null>(null)
    const smoothScrollUntilRef = useRef(0)
    const forceStickToBottomUntilRef = useRef(0)
    const finalAnchorTimerRef = useRef<number | null>(null)

    const getPreferredScrollBehavior = useCallback((): ScrollBehavior => {
        return Date.now() < smoothScrollUntilRef.current ? "smooth" : "auto"
    }, [])

    const shouldForceBottomAnchor = useCallback((): boolean => {
        return Date.now() < forceStickToBottomUntilRef.current
    }, [])

    const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
        const el = messagesRef.current
        if (!el) return

        requestAnimationFrame(() => {
            if (typeof el.scrollTo === "function") {
                el.scrollTo({ top: el.scrollHeight, behavior })
            } else {
                el.scrollTop = el.scrollHeight
            }
            if (behavior === "auto") {
                requestAnimationFrame(() => {
                    el.scrollTop = el.scrollHeight
                })
            }
        })
    }, [])

    useEffect(() => {
        return () => {
            if (finalAnchorTimerRef.current) {
                window.clearTimeout(finalAnchorTimerRef.current)
            }
        }
    }, [])

    useEffect(() => {
        if (typeof window === "undefined") return
        const mediaQuery = window.matchMedia("(min-width: 1024px)")

        const update = (event: MediaQueryListEvent) => {
            setIsDesktop(event.matches)
        }

        mediaQuery.addEventListener("change", update)
        return () => mediaQuery.removeEventListener("change", update)
    }, [])

    useEffect(() => {
        if (!bundleSynced) return
        // Show transient banner on prop change (resync), auto-hidden by timer
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setShowBundleSynced(true)
        const timer = window.setTimeout(() => {
            setShowBundleSynced(false)
        }, 8000)
        return () => window.clearTimeout(timer)
    }, [bundleSynced])

    useEffect(() => {
        if (!autoUnlockAt) return

        // Ignore rapid repeated events that would keep extending the banner.
        const lastShownAt = lastAutoUnlockAtRef.current
        if (lastShownAt && autoUnlockAt - lastShownAt < 5000) {
            return
        }

        lastAutoUnlockAtRef.current = autoUnlockAt
        // Show transient banner on prop change (resync), auto-hidden by timer
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setShowAutoUnlock(true)
        const timer = window.setTimeout(() => {
            setShowAutoUnlock(false)
        }, 3000)
        return () => window.clearTimeout(timer)
    }, [autoUnlockAt])

    useEffect(() => {
        if (!activeConversationKey) return
        const el = messagesRef.current
        if (!el) return

        // New conversation: consider viewport at bottom and move smoothly.
        isAtBottomRef.current = true
        smoothScrollUntilRef.current = Date.now() + 1200
        forceStickToBottomUntilRef.current = Date.now() + 2200
        scrollToBottom("smooth")

        // Timers are tracked in retryTimers and cleared in cleanup below
        const retryTimers = [120, 350, 700].map((delay) =>
            // eslint-disable-next-line react-web-api/no-leaked-timeout
            window.setTimeout(() => {
                if (isAtBottomRef.current) {
                    scrollToBottom(getPreferredScrollBehavior())
                }
            }, delay)
        )

        const images = Array.from(el.querySelectorAll("img"))
        const handleImageSettled = () => {
            if (
                isAtBottomRef.current ||
                Date.now() < forceStickToBottomUntilRef.current
            ) {
                scrollToBottom(getPreferredScrollBehavior())
            }
        }

        const resizeObserver =
            typeof ResizeObserver !== "undefined"
                ? new ResizeObserver(() => {
                      if (
                          isAtBottomRef.current ||
                          Date.now() < forceStickToBottomUntilRef.current
                      ) {
                          scrollToBottom(getPreferredScrollBehavior())
                      }
                  })
                : null
        resizeObserver?.observe(el)

        if (finalAnchorTimerRef.current) {
            window.clearTimeout(finalAnchorTimerRef.current)
        }
        finalAnchorTimerRef.current = window.setTimeout(() => {
            const currentEl = messagesRef.current
            if (!currentEl) return
            currentEl.scrollTop = currentEl.scrollHeight
        }, 1400)

        for (const image of images) {
            if (!image.complete) {
                image.addEventListener("load", handleImageSettled)
                image.addEventListener("error", handleImageSettled)
            }
        }

        return () => {
            for (const timer of retryTimers) {
                window.clearTimeout(timer)
            }
            for (const image of images) {
                image.removeEventListener("load", handleImageSettled)
                image.removeEventListener("error", handleImageSettled)
            }
            resizeObserver?.disconnect()
            if (finalAnchorTimerRef.current) {
                window.clearTimeout(finalAnchorTimerRef.current)
                finalAnchorTimerRef.current = null
            }
        }
    }, [activeConversationKey, getPreferredScrollBehavior, scrollToBottom])

    useEffect(() => {
        if (!hasMessages) return
        const el = messagesRef.current
        if (!el) return
        if (
            !latestMessageIsMine &&
            !isAtBottomRef.current &&
            Date.now() >= forceStickToBottomUntilRef.current
        ) {
            return
        }
        scrollToBottom(
            shouldForceBottomAnchor() ? "auto" : getPreferredScrollBehavior()
        )
    }, [
        hasMessages,
        latestMessageIsMine,
        messageCount,
        activeConversationKey,
        getPreferredScrollBehavior,
        shouldForceBottomAnchor,
        scrollToBottom,
    ])

    const handleMessagesScroll = useCallback(() => {
        const el = messagesRef.current
        if (!el) return
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight
        isAtBottomRef.current = distance <= 16
        if (distance <= 16) {
            void onReachBottom()
        }
    }, [onReachBottom])

    return {
        showUsers,
        setShowUsers,
        securityOpen,
        setSecurityOpen,
        isDesktop,
        showBundleSynced,
        showAutoUnlock,
        messagesRef,
        handleMessagesScroll,
    }
}
