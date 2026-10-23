import { useMemo } from "react"
import {
    addServicePermissions,
    createService,
    deleteService,
    listServices,
    removeServicePermission,
    renameService,
} from "../../services/serviceService"
import type { Service } from "../../types"
import {
    type EntityApi,
    useEntityPermissionsCrud,
} from "./useEntityPermissionsCrud"

export function useServices() {
    const api = useMemo<EntityApi<Service>>(
        () => ({
            list: listServices,
            create: createService,
            rename: renameService,
            remove: deleteService,
            addPermissions: addServicePermissions,
            removePermission: removeServicePermission,
        }),
        []
    )

    const crud = useEntityPermissionsCrud(api, "service")
    return { ...crud, services: crud.entities }
}
