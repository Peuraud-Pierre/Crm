import { useState, useCallback, useEffect } from "react"
import type { Delivery, DeliveryFormInput } from "@/features/stock/types/stock.types"
import * as livraisonService from "@/features/stock/services/livraisonService"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"

export function useDelivery() {
    const [deliveries, setDeliveries] = useState<Delivery[] | undefined>()

    const { user } = useAuth()

    const fetchDeliveryByDIN = useCallback(
        async (din: string) => {
            try {
                return await livraisonService.fetchDeliveryByDIN(din)
            } catch {
                return null
            }
        },
        []
    )

    const fetchSingleDelivery = useCallback(async (id: string) => {
        return livraisonService.fetchSingleDelivery(id)
    }, [])

    const fetchDeliveries = useCallback(async () => {
        try {
            const data = await livraisonService.fetchDeliveries()
            setDeliveries(data)
        } catch (err) {
            toast.error("Erreur lors du chargement des livraisons")
            console.error("[useDelivery] fetchDeliveries:", err)
        }
    }, [])

    const createDelivery = useCallback(
        async (delivery: DeliveryFormInput) => {
            if (!user?.user_id) return null

            return livraisonService.insertDelivery(delivery, user.user_id)
        },
        [user]
    )

    const updateDelivery = useCallback(
        async (id: string, delivery: Partial<Delivery>) => {
            await livraisonService.patchDelivery(id, delivery)
        },
        []
    )

    const deleteDelivery = useCallback(
        async (id: string) => {
            await livraisonService.removeDelivery(id)
        },
        []
    )

    useEffect(() => {
        if (!user) return
        fetchDeliveries()

        const unsubscribe = livraisonService.subscribeToDeliveries(
            user.user_id,
            async (payload) => {
                if (payload.eventType === "DELETE") {
                    const oldId = (payload.old as { id?: string }).id
                    setDeliveries((prev) =>
                        prev?.filter((b) => b.id !== oldId)
                    )
                } else if (payload.new && "id" in payload.new) {
                    const freshDelivery = await fetchSingleDelivery(
                        (payload.new as { id: string }).id
                    )
                    if (freshDelivery) {
                        setDeliveries((prev) => {
                            if (payload.eventType === "INSERT") {
                                if (
                                    prev?.some(
                                        (b) => b.id === freshDelivery.id
                                    )
                                )
                                    return prev
                                return [freshDelivery, ...(prev || [])]
                            }
                            return prev?.map((b) =>
                                b.id === freshDelivery.id
                                    ? freshDelivery
                                    : b
                            )
                        })
                    }
                }
            }
        )

        return () => {
            unsubscribe()
        }
    }, [user?.user_id, fetchSingleDelivery, fetchDeliveries])

    return {
        deliveries,
        fetchDeliveryByDIN,
        fetchSingleDelivery,
        fetchDeliveries,
        createDelivery,
        updateDelivery,
        deleteDelivery,
    }
}
