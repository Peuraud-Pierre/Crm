/**
 * Types pour les événements Microsoft Graph API
 * Documentation: https://learn.microsoft.com/en-us/graph/api/resources/event
 */

export interface MicrosoftGraphEvent {
    id?: string
    subject: string
    body: {
        contentType: "text" | "html"
        content: string
    }
    start: {
        dateTime: string
        timeZone: string
    }
    end: {
        dateTime: string
        timeZone: string
    }
    location?: {
        displayName: string
        address?: unknown
    }
    attendees?: Array<{
        emailAddress: {
            name?: string
            address?: string
        }
        type: "required" | "optional" | "resource"
        status?: {
            response: string
            time: string
        }
    }>
    isAllDay?: boolean
    isCancelled?: boolean
    isOrganizer?: boolean
    recurrence?: unknown
    reminderMinutesBeforeStart?: number
    responseRequested?: boolean
    showAs?: "free" | "tentative" | "busy" | "oof" | "workingElsewhere" | "unknown"
    type?: "singleInstance" | "occurrence" | "exception" | "seriesMaster"
    createdDateTime?: string
    lastModifiedDateTime?: string
    changeKey?: string
    "@removed"?: { reason: string }
}

export interface MicrosoftGraphEventListResponse {
    value: MicrosoftGraphEvent[]
    "@odata.nextLink"?: string
    "@odata.deltaLink"?: string
}

export interface CalendarSyncMapping {
    id: string
    nokk_project_event_id: string
    outlook_event_id: string
    outlook_change_key: string | null
    connection_id: string
    last_synced_at: string | null
    nokk_project_updated_at: string | null
    outlook_updated_at: string | null
    created_at: string
}

export interface CalendarSyncLog {
    id: string
    connection_id: string
    sync_type: "full" | "incremental" | "webhook"
    status: "success" | "partial" | "failed"
    events_synced: number
    conflicts_resolved: number
    error_message: string | null
    started_at: string | null
    completed_at: string | null
    created_at: string
}

export interface OutlookWebhookSubscription {
    id: string
    connection_id: string
    subscription_id: string
    resource: string
    expires_at: string
    notification_url: string
    created_at: string
}

export interface SyncResult {
    success: boolean
    eventsProcessed?: number
    conflicts?: number
    error?: string
}

export interface SyncConflict {
    type: "simultaneous_edit" | "deleted_vs_updated"
    outlookEvent: MicrosoftGraphEvent
    nokkProjectEvent: unknown
    mapping: CalendarSyncMapping
}
