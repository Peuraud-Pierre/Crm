import { useMemo } from "react"
import {
    addRolePermissions,
    createRole,
    deleteRole,
    listRoles,
    removeRolePermission,
    renameRole,
} from "../../services/roleService"
import type { Role } from "../../types"
import {
    type EntityApi,
    useEntityPermissionsCrud,
} from "./useEntityPermissionsCrud"

export function useRoles() {
    const api = useMemo<EntityApi<Role>>(
        () => ({
            list: listRoles,
            create: createRole,
            rename: renameRole,
            remove: deleteRole,
            addPermissions: addRolePermissions,
            removePermission: removeRolePermission,
        }),
        []
    )

    const crud = useEntityPermissionsCrud(api, "rôle")
    return { ...crud, roles: crud.entities }
}
