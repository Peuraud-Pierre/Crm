/**
 * Types pour l'authentification OAuth Microsoft Graph API
 */

export interface OutlookAuthConfig {
    clientId: string
    redirectUri: string
    authority: string
    scopes: string[]
}

export interface TokenResponse {
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: string
    scope: string
}

export interface OutlookConnection {
    id: string
    user_id: string
    access_token: string
    refresh_token: string
    token_expires_at: string
    email: string
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface PKCEChallenge {
    codeVerifier: string
    codeChallenge: string
}

export interface OAuthState {
    state: string
    codeVerifier: string
    timestamp: number
}
