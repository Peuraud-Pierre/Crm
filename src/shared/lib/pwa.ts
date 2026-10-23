import {
    deletePushSubscription,
    savePushSubscription,
    getAccessToken,
} from "@/shared/services/pushService"
import { env } from "@/shared/lib/env"

import type { Json } from "@/integrations/supabase/types"

const API_BASE_URL = `${env.PUBLIC_SUPABASE_URL}/keyexchange`

const NOTIFY_SYNC_URL = `${API_BASE_URL}/api/notify/register`

function base64UrlToUint8Array(base64Url: string): Uint8Array {
    // Convert to std base64
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")

    // Decode
    const decoded = atob(base64)
    const array = new Uint8Array(decoded.length)

    for (let i = 0; i < decoded.length; i++) {
        array[i] = decoded.charCodeAt(i)
    }

    return array
}

function hasWindow(): boolean {
    return typeof window !== "undefined"
}

export function isPushSupported(): boolean {
    if (!hasWindow()) return false
    return (
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window
    )
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!isPushSupported()) return null
    try {
        return await navigator.serviceWorker.ready
    } catch (error) {
        console.error("Impossible de récupérer le service worker", error)
        return null
    }
}

async function upsertSubscription(subscription: PushSubscription) {
    const payload = JSON.parse(JSON.stringify(subscription)) as Json

    await savePushSubscription(subscription.endpoint, payload)
}

async function syncSubscriptionWithNotify(
    userId: string,
    subscription: PushSubscription
) {
    try {
        const subscriptionPayload =
            typeof subscription.toJSON === "function"
                ? subscription.toJSON()
                : JSON.parse(JSON.stringify(subscription))

        const token = await getAccessToken()

        const response = await fetch(NOTIFY_SYNC_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: token ? `Bearer ${token}` : "",
            },
            body: JSON.stringify({
                userId,
                subscription: subscriptionPayload,
            }),
        })

        if (!response.ok) {
            console.error(
                "Notify: échec de la synchronisation",
                response.status,
                await response.text()
            )
        }
    } catch (error) {
        console.error("Notify: impossible d'envoyer la subscription", error)
    }
}

/**
 * 🔔 Initialise ou met à jour l’abonnement push d’un utilisateur
 */
export async function ensurePushSubscription(userId: string) {
    const registration = await getRegistration()
    if (!registration) return

    try {
        let subscription = await registration.pushManager.getSubscription()

        if (!subscription) {
            if (Notification.permission !== "granted") return

            // 🔹 Récupération de la clé publique depuis ton backend Go
            const response = await fetch(`${API_BASE_URL}/api/notify/keys`)

            if (!response.ok) {
                console.error(
                    "Notify: impossible de récupérer la clé VAPID",
                    response.status,
                    await response.text()
                )
                return
            }
            const result = await response.json()

            console.log("Notify: clé VAPID reçue:", result)

            if (!result.successful || typeof result.data !== "string") {
                throw new Error("Clé VAPID invalide reçue du backend")
            }

            const vapidKey = result.data.trim()

            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: base64UrlToUint8Array(vapidKey)
                    .buffer as ArrayBuffer,
            })
        }

        await upsertSubscription(subscription)
        await syncSubscriptionWithNotify(userId, subscription)
    } catch (error) {
        console.error("Erreur lors de la souscription push", error)
    }
}

/**
 * 🔕 Révoque l'abonnement push de cet appareil : désinscription auprès du
 * navigateur puis suppression de la ligne correspondante en base.
 * Contrairement à `ensurePushSubscription`, les erreurs remontent — le
 * réglage appelant a besoin de savoir si l'opération a abouti.
 */
export async function removePushSubscription(): Promise<void> {
    // getRegistration() et non `ready` : `ready` ne se résout jamais sans
    // service worker, ce qui bloquerait la déconnexion qui nous appelle.
    if (!isPushSupported()) return
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) return

    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return

    const { endpoint } = subscription
    await subscription.unsubscribe()
    await deletePushSubscription(endpoint)
}

/** true si cet appareil a un abonnement push actif auprès du navigateur. */
export async function hasPushSubscription(): Promise<boolean> {
    const registration = await getRegistration()
    if (!registration) return false

    return (await registration.pushManager.getSubscription()) !== null
}
