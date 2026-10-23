import { expect, rstest, test } from "@rstest/core"
import { fireEvent, renderHook } from "@testing-library/react"
import { useDeleteShortcut } from "./useDeleteShortcut"

test("Suppr ou Retour arrière demandent la suppression, sauf dans un champ", () => {
    const onDelete = rstest.fn()
    renderHook(() => useDeleteShortcut(true, onDelete))
    fireEvent.keyDown(window, { key: "Delete" })
    fireEvent.keyDown(window, { key: "Backspace" })
    expect(onDelete).toHaveBeenCalledTimes(2)

    const input = document.createElement("input")
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: "Delete" })
    fireEvent.keyDown(window, { key: "a" })
    expect(onDelete).toHaveBeenCalledTimes(2)
})

test("inactif, il ne réagit pas", () => {
    const onDelete = rstest.fn()
    renderHook(() => useDeleteShortcut(false, onDelete))
    fireEvent.keyDown(window, { key: "Delete" })
    expect(onDelete).not.toHaveBeenCalled()
})
