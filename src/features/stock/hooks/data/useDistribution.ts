import { useCallback, useMemo } from "react"
import type { CategoryDistribution, DeliveryFormInput } from "@/features/stock/types/stock.types"

type DistributionFormData = Partial<DeliveryFormInput> | undefined

export function useDistributions(
    formData: DistributionFormData,
    setFormData: (data: Partial<DeliveryFormInput>) => void
) {

    const addRow = useCallback(() => {
        const newDistribution: CategoryDistribution = {
            category_id: "",
            count: 1,
        }
        setFormData({
            ...formData,
            distributions: [...(formData?.distributions || []), newDistribution],
        })
    }, [formData, setFormData])

    const removeRow = useCallback(
        (index: number) => {
            const updatedDistributions = formData?.distributions?.filter(
                (_, i) => i !== index
            )
            setFormData({
                ...formData,
                distributions: updatedDistributions || [],
            })
        },
        [formData, setFormData]
    )

    const updateRow = useCallback(
        (index: number, field: keyof CategoryDistribution, value: CategoryDistribution[keyof CategoryDistribution]) => {
            const updatedDistributions = formData?.distributions?.map(
                (dist, i) =>
                    i === index ? { ...dist, [field]: value } : dist
            )
            setFormData({
                ...formData,
                distributions: updatedDistributions || [],
            })
        },
        [formData, setFormData]
    )

    const totalDistributed = useMemo(() => {
        return (formData?.distributions || []).reduce(
            (acc: number, dist: CategoryDistribution) => acc + (Number(dist.count) || 0),
            0
        )
    }, [formData?.distributions])

    const isOverDistributed = totalDistributed > (formData?.balles_count || 0)
    const isUnderDistributed = totalDistributed < (formData?.balles_count || 0)

    const isValid = useMemo(() => {
        const distributions = formData?.distributions || []
        return (
            distributions.length > 0 &&
            distributions.every((dist: CategoryDistribution) => dist.category_id !== "" && dist.count > 0) &&
            !isOverDistributed &&
            !isUnderDistributed
        )
    }, [formData?.distributions, isOverDistributed, isUnderDistributed])

    return {
        addRow,
        removeRow,
        updateRow,
        totalDistributed,
        isOverDistributed,
        isUnderDistributed,
        isValid,
    }
}
