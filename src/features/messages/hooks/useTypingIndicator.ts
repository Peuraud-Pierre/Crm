import { useEffect, useRef, useState } from "react"
import {
    subscribeToTyping,
    type TypingSubscription,
} from "../services/typingService"

const TYPING_TIMEOUT_MS = 3000

export function useTypingIndicator(
    chatId: string | null,
    userId: string | null | undefined
) {
    const [typingUserIds, setTypingUserIds] = useState<string[]>([])
    const subscriptionRef = useRef<TypingSubscription | null>(null)
    const timeoutRef = useRef<number | null>(null)
    const isSendingRef = useRef(false)

    useEffect(() => {
        if (!chatId || !userId) {
            // Reset typing list when conversation changes (entity resync)
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setTypingUserIds([])
            return
        }

        const subscription = subscribeToTyping(
            chatId,
            ({ user_id, is_typing }) => {
                if (user_id === userId) return
                setTypingUserIds((prev) => {
                    if (is_typing) {
                        return prev.includes(user_id)
                            ? prev
                            : [...prev, user_id]
                    }
                    return prev.filter((id) => id !== user_id)
                })
            }
        )
        subscriptionRef.current = subscription

        return () => {
            subscription.unsubscribe()
            subscriptionRef.current = null
        }
    }, [chatId, userId])

    const sendTypingEvent = (isTyping: boolean) => {
        if (!subscriptionRef.current || !userId) return
        subscriptionRef.current.sendTyping(userId, isTyping)
    }

    const onTypingStart = () => {
        if (!isSendingRef.current) {
            sendTypingEvent(true)
            isSendingRef.current = true
        }
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
        timeoutRef.current = window.setTimeout(() => {
            sendTypingEvent(false)
            isSendingRef.current = false
        }, TYPING_TIMEOUT_MS)
    }

    const onTypingStop = () => {
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
        if (isSendingRef.current) {
            sendTypingEvent(false)
            isSendingRef.current = false
        }
    }

    return { typingUserIds, onTypingStart, onTypingStop }
}
