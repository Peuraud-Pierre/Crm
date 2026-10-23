/**
 * Service for Apple iCloud Calendar API interactions
 * Adapté pour l'API Go sur le port 8087
 */

import type {
    AppleConnection,
    AppleConnectResponse,
    AppleDisconnectResponse,
    AppleDeleteResponse,
    AppleSyncResponse,
    AppleSyncEventAction,
    AppleSyncEventRequest,
    AppleSyncEventResponse,
} from "../types/apple-auth.types"

import { env } from "@/shared/lib/env"

// L'API Go tourne sur le port 8087 d'après votre main.go

const API_BASE_URL = `${env.PUBLIC_SUPABASE_URL}/apple`

export class AppleCalendarService {
    private static instance: AppleCalendarService

    private constructor() {}

    static getInstance(): AppleCalendarService {
        if (!AppleCalendarService.instance) {
            AppleCalendarService.instance = new AppleCalendarService()
        }
        return AppleCalendarService.instance
    }

    /**
     * Get the current Apple iCloud connection status
     * Route Go: GET /status
     */
    async status(accessToken: string): Promise<AppleConnection[]> {
        const response = await fetch(`${API_BASE_URL}/status`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            credentials: "include", // Important pour les CORS
        })

        if (!response.ok) {
            throw new Error(
                `Failed to get Apple calendar status: ${response.statusText}`
            )
        }

        return response.json()
    }

    /**
     * Connect to Apple iCloud calendar
     * Route Go: POST /connect
     */
    async connect(
        appleId: string, // Renommé pour clarté
        appSpecificPassword: string, // Renommé pour clarté
        accessToken: string
    ): Promise<AppleConnectResponse> {
        // Adaptation du payload aux noms de champs probables du backend Go (snake_case)
        const payload = {
            apple_id: appleId,
            app_specific_password: appSpecificPassword,
        }
        console.log(
            "Connecting to Apple Calendar with payload:",
            `${API_BASE_URL}/connect`
        )
        const response = await fetch(`${API_BASE_URL}/connect`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(
                errorData.error ||
                    `Failed to connect Apple calendar: ${response.statusText}`
            )
        }

        return response.json()
    }

    /**
     * Disconnect from Apple iCloud calendar (soft delete)
     * Route Go: DELETE /disconnect/:id
     */
    async disconnect(
        connectionId: string,
        accessToken: string
    ): Promise<AppleDisconnectResponse> {
        const response = await fetch(
            `${API_BASE_URL}/disconnect/${connectionId}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                credentials: "include",
            }
        )

        if (!response.ok) {
            throw new Error(
                `Failed to disconnect Apple calendar: ${response.statusText}`
            )
        }

        return response.json()
    }

    /**
     * Permanently delete Apple iCloud connection (hard delete)
     * Route Go: DELETE /delete/:id
     */
    async delete(
        connectionId: string,
        accessToken: string
    ): Promise<AppleDeleteResponse> {
        const response = await fetch(`${API_BASE_URL}/delete/${connectionId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            credentials: "include",
        })

        if (!response.ok) {
            throw new Error(
                `Failed to delete Apple calendar connection: ${response.statusText}`
            )
        }

        return response.json()
    }

    /**
     * Trigger immediate synchronization
     * Route Go: POST /sync-now
     */
    async syncNow(accessToken: string): Promise<AppleSyncResponse> {
        const response = await fetch(`${API_BASE_URL}/sync-now`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            credentials: "include",
        })

        if (!response.ok) {
            throw new Error(
                `Failed to trigger Apple calendar sync: ${response.statusText}`
            )
        }

        return response.json()
    }

    /**
     * Sync a single event to Apple Calendar
     * Route Go: POST /sync-event
     * @param eventId - The local event ID
     * @param action - 'create' | 'update' | 'delete'
     * @param accessToken - Bearer token
     */
    async syncEvent(
        eventId: string,
        action: AppleSyncEventAction,
        accessToken: string,
        creator: string,
        userId: string
    ): Promise<AppleSyncEventResponse> {
        const payload: AppleSyncEventRequest = {
            creator_event: creator,
            event_id: eventId,
            action,
            Attribution_Id: userId,
        }

        const response = await fetch(`${API_BASE_URL}/sync-event`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(
                errorData.error ||
                    `Failed to sync event to Apple calendar: ${response.statusText}`
            )
        }

        return response.json()
    }
}

export const appleCalendarService = AppleCalendarService.getInstance()
