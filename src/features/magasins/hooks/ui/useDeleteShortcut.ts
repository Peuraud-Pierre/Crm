import { useEffect } from "react"

/**
 * Touche Suppr (ou Retour arrière) : demande la suppression de l'élément
 * sélectionné. Inactive pendant une saisie, et quand un outil se sert déjà de
 * ces touches (le tracé point par point retire son dernier point au Retour
 * arrière).
 */
export function useDeleteShortcut(enabled: boolean, onDelete: () => void) {
    useEffect(() => {
        if (!enabled) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Delete" && e.key !== "Backspace") return
            const target = e.target
            if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return
            e.preventDefault()
            onDelete()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [enabled, onDelete])
}
