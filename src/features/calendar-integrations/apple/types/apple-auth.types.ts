/**
 * Types for Apple iCloud Calendar authentication and connection
 */

export interface AppleConnection {
    id: string
    email: string
    is_active: boolean
    last_sync_at: string | null
    created_at: string
    updated_at: string
}

export interface AppleConnectRequest {
    email: string
    app_password: string
}

export interface AppleConnectResponse {
    status: string
    connection_id: string
    email: string
}

export interface AppleDisconnectResponse {
    status: string
}

export interface AppleDeleteResponse {
    status: string
}

export interface AppleSyncResponse {
    status: string
    message: string
}

export type AppleSyncEventAction = "create" | "update" | "delete"

export interface AppleSyncEventRequest {
    creator_event: string | undefined
    event_id: string
    action: AppleSyncEventAction
    Attribution_Id: string | undefined
}

export interface AppleSyncEventResponse {
    status: string
    message?: string
    apple_event_id?: string
}
