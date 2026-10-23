import React, { memo, useCallback, useRef, useState } from "react"
import { useCustomers } from "../../context/CustomerContext"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { type Client } from "@/features/crm/hooks/CRM_hook/use_client"
import { COLUMN_NAMES } from "@/shared/utils/CrmTab"
import { KanbanColumn } from "./KanbanColumn"
import { AssignOwnerModal } from "./AssignModal"
import { getErrorMessage } from "@/features/crm/utils/errors"

export const CustomersBoard = memo(function CustomersBoard() {
    // Récupération des données depuis le contexte
    const { boardData, activeTab, refreshCounts } = useCustomers()
    const { update_fiche_client, search } = useCRMContext()

    // --- ÉTATS DRAG & DROP ---
    const [draggedClient, setDraggedClient] = useState<Client>()
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const lastScrollTimeRef = useRef<number>(0)

    // --- ÉTATS MODALE ---
    const [assignModalOpen, setAssignModalOpen] = useState(false)
    const [pendingMove, setPendingMove] = useState<{
        client: Client
        colIndex: number
    } | null>(null)

    // --- ACTIONS DRAG & DROP ---
    const handleDragStart = useCallback((client: Client) => {
        setDraggedClient(client)
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        // Sans dropEffect explicite, Firefox affiche le curseur « interdit »
        // au-dessus des colonnes.
        e.dataTransfer.dropEffect = "move"
        const now = Date.now()
        if (now - lastScrollTimeRef.current < 20) return
        lastScrollTimeRef.current = now
        const box = scrollContainerRef.current
        if (!box) return
        const { left, width } = box.getBoundingClientRect()
        const offsetX = e.clientX - left
        if (offsetX < 150) box.scrollBy({ left: -15, behavior: "smooth" })
        else if (offsetX > width - 150)
            box.scrollBy({ left: 15, behavior: "smooth" })
    }, [])

    const handleDrop = useCallback(
        async (colName: string) => {
            if (!draggedClient) return

            const newColIndex = COLUMN_NAMES.indexOf(colName)
            const oldColIndex = draggedClient.collum || 0

            // Déclenchement de la modale d'assignation Closer
            if (
                (newColIndex === 3 || newColIndex === 4) &&
                activeTab === "acquisition" &&
                newColIndex > oldColIndex
            ) {
                setPendingMove({ client: draggedClient, colIndex: newColIndex })
                setAssignModalOpen(true)
                setDraggedClient(undefined)
                return
            }

            if (!draggedClient.id) return

            try {
                await update_fiche_client({
                    id: draggedClient.id,
                    collum: newColIndex,
                })
                // ⚠️ Surtout PAS refreshData() ici : update_fiche_client a
                // déjà fait l'update optimiste + le refetch du seul client
                // concerné. Un reset complet effacerait toute la pagination
                // accumulée via loadMoreInColumn (cards perdues !).
                refreshCounts()
            } catch (error: unknown) {
                console.error(
                    "Erreur lors du déplacement du client :",
                    getErrorMessage(error)
                )
            } finally {
                setDraggedClient(undefined)
            }
        },
        [draggedClient, update_fiche_client, activeTab, refreshCounts]
    )

    const handleAssignConfirm = useCallback(
        async (selectedUserId: string) => {
            if (!pendingMove || !pendingMove.client.id) return
            try {
                // closers stocke un UUID côté DB (le type Client.closers décrit l'objet joint à la lecture).
                await update_fiche_client({
                    id: pendingMove.client.id,
                    collum: pendingMove.colIndex,
                    ...(selectedUserId ? { closers: selectedUserId } : {}),
                } as Parameters<typeof update_fiche_client>[0])
                setAssignModalOpen(false)
                setPendingMove(null)
                // ⚠️ Surtout PAS refreshData() ici : update_fiche_client a
                // déjà fait l'update optimiste + le refetch du seul client
                // concerné. Un reset complet effacerait toute la pagination
                // accumulée via loadMoreInColumn (cards perdues !).
                refreshCounts()
            } catch (error: unknown) {
                console.error(
                    "Erreur lors de l'assignation :",
                    getErrorMessage(error)
                )
            }
        },
        [pendingMove, update_fiche_client, refreshCounts]
    )

    return (
        <>
            <div
                ref={scrollContainerRef}
                className="flex gap-3 sm:gap-4 overflow-x-auto overflow-y-hidden h-[calc(100vh-270px)] pb-2 min-h-0 animate-in fade-in"
            >
                {boardData.visibleCols?.map((colName, index) => (
                    <KanbanColumn
                        key={colName}
                        colName={colName}
                        index={index}
                        clients={boardData.groups[colName] || []}
                        draggedClientId={draggedClient?.id}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onDragStart={handleDragStart}
                    />
                ))}
            </div>

            <AssignOwnerModal
                open={assignModalOpen}
                onOpenChange={setAssignModalOpen}
                onConfirm={handleAssignConfirm}
                users={search}
                clientName={pendingMove?.client.nom}
            />
        </>
    )
})
