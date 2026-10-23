import { getUserPermissions } from "@/shared/services/permissionsService"
import { menuItems } from "@/shared/components/layout/menuItems"
import type { MenuItem } from "@/shared/components/layout/menuItems"

export async function fetchPermissions(uid: string): Promise<{
    codes: Set<string>
    allowedRoutes: MenuItem[]
}> {
    try {
        const { data, error } = await getUserPermissions(uid)

        if (error || !data || !Array.isArray(data)) {
            if (error) console.error("Erreur RPC get_user_permissions:", error)
            return { codes: new Set(), allowedRoutes: [] }
        }

        const codes = new Set(
            data.map((item: { code: string }) => String(item.code).toLowerCase())
        )

        const allowedRoutes = menuItems.filter((item) => {
            // permissionCodes (multi) prime sur permissionCode : l'entrée est
            // visible si l'utilisateur détient au moins un des codes.
            const perms = item.permissionCodes ?? [item.permissionCode]
            return perms.some((perm) => perm && codes.has(perm.toLowerCase()))
        })

        return { codes, allowedRoutes }
    } catch (err) {
        console.error("Erreur inattendue fetchPermissions:", err)
        return { codes: new Set(), allowedRoutes: [] }
    }
}

/** @deprecated Utiliser fetchPermissions à la place */
export async function checkPermission(user: { id?: string; user_id?: string }) {
    const uid = user?.user_id || user?.id
    if (!uid) return []
    const { allowedRoutes } = await fetchPermissions(uid)
    return allowedRoutes
}
