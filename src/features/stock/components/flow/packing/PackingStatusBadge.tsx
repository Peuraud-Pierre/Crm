import { StatusBadge } from "@/shared/ui/molecules/status-badge"
import { PACKING_STATUS_CONFIG } from "@/features/stock/constants"
import type { PackingListStatus } from "@/features/stock/types/packing-list.types"

export function PackingStatusBadge({ status }: { status: PackingListStatus }) {
    return <StatusBadge config={PACKING_STATUS_CONFIG[status] ?? PACKING_STATUS_CONFIG.a_verifier} />
}
