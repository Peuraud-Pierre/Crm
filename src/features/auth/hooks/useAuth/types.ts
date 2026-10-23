import type { Dispatch, SetStateAction } from "react"
import type { MenuItem } from "@/shared/components/layout/menuItems"
import type { Session, User } from "@supabase/supabase-js"

export interface PermissionSet {
    claim?: boolean
    create?: boolean
    delete?: boolean
    update?: boolean
}

export interface AppUserExtras {
    user_id: string
    full_name?: string
    avatar_url?: string
    role?: string
    role_id?: string
    service?: string
    service_id?: string
    status?: string
    last_login?: string
    privacy_accepted_at?: string
    privacy_accepted_version?: string
}

export type AppUser = (User & AppUserExtras) | null

export interface AuthContextType {
    user: AppUser
    session: Session | null
    loading: boolean
    permissionsLoaded: boolean
    requiresMfa: boolean
    setRequiresMfa: (value: boolean) => void
    hasPermission: (code: string) => boolean

    signIn: (
        email: string,
        password: string,
        captchaToken?: string
    ) => Promise<
        | {
              /** Message français prêt à afficher (voir utils/authErrors). */
              error: string
              /** Code GoTrue ou local (`network`, `unknown`…). */
              code: string
              mfa?: undefined
              user?: undefined
          }
        | {
              mfa: {
                  factorId: string
              }
              error?: undefined
              user?: undefined
          }
        | {
              user: AppUser | null
              error?: undefined
              mfa?: undefined
          }
    >
    signUp: (
        email: string,
        password: string,
        captchaToken?: string
    ) => Promise<{ user: AppUser | null; error: string | null }>
    signOut: () => Promise<void>
    changePassword: (newPassword: string) => Promise<{ error?: boolean; success?: boolean }>
    verifyOtp: (
        code: string
    ) => Promise<{ user: AppUser | null; error: string | null; code?: string }>
    // Le provider expose directement son setter d'état : la forme updater
    // `setUser(prev => ...)` est nécessaire pour patcher le profil sans
    // écraser les champs qu'on ne modifie pas.
    setUser: Dispatch<SetStateAction<AppUser>>
    allowedRoutes: MenuItem[]
}
