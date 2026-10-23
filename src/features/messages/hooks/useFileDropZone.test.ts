import { describe, it, expect } from "@rstest/core"
import { renderHook, act } from "@testing-library/react"
import { filesFromDataTransfer, useFileDropZone } from "./useFileDropZone.js"

const file = (name: string) => new File(["x"], name, { type: "image/jpeg" })

/** DataTransfer n'est pas instanciable ici : seules les deux formes lues comptent. */
const dt = (files: File[], items: { kind: string; file: File | null }[]) =>
    ({
        files,
        items: items.map((i) => ({ kind: i.kind, getAsFile: () => i.file })),
    }) as unknown as DataTransfer

describe("filesFromDataTransfer", () => {
    it("prend `files` quand le navigateur le remplit (Chromium)", () => {
        const dropped = file("a.jpg")
        expect(filesFromDataTransfer(dt([dropped], []))).toEqual([dropped])
    })

    it("retombe sur `items` quand `files` est vide (Firefox)", () => {
        const dropped = file("b.jpg")
        expect(
            filesFromDataTransfer(dt([], [{ kind: "file", file: dropped }]))
        ).toEqual([dropped])
    })

    it("ignore les entrées non-fichier et les fichiers illisibles", () => {
        expect(
            filesFromDataTransfer(
                dt(
                    [],
                    [
                        { kind: "string", file: null },
                        { kind: "file", file: null },
                    ]
                )
            )
        ).toEqual([])
    })
})

describe("useFileDropZone — retour visuel", () => {
    const dragEvent = (target: HTMLElement, relatedTarget: Node | null) =>
        ({
            currentTarget: target,
            relatedTarget,
            dataTransfer: { types: ["Files"] },
            preventDefault: () => {},
        }) as unknown as React.DragEvent<HTMLElement>

    const zoneWithChild = () => {
        const zone = document.createElement("div")
        const child = document.createElement("span")
        zone.appendChild(child)
        return { zone, child }
    }

    it("reste allumé en passant d'un enfant à l'autre", () => {
        const { zone, child } = zoneWithChild()
        const { result } = renderHook(() =>
            useFileDropZone({ enabled: true, onFiles: () => {} })
        )

        act(() =>
            result.current.dropHandlers.onDragEnter(dragEvent(zone, null))
        )
        expect(result.current.isDragActive).toBe(true)

        act(() =>
            result.current.dropHandlers.onDragLeave(dragEvent(zone, child))
        )
        expect(result.current.isDragActive).toBe(true)
    })

    it("s'éteint dès que le curseur quitte la zone, quel que soit le nombre d'entrées", () => {
        const { zone, child } = zoneWithChild()
        const { result } = renderHook(() =>
            useFileDropZone({ enabled: true, onFiles: () => {} })
        )

        act(() => {
            result.current.dropHandlers.onDragEnter(dragEvent(zone, null))
            result.current.dropHandlers.onDragEnter(dragEvent(zone, child))
            result.current.dropHandlers.onDragEnter(dragEvent(zone, child))
        })

        act(() =>
            result.current.dropHandlers.onDragLeave(dragEvent(zone, null))
        )
        expect(result.current.isDragActive).toBe(false)
    })

    it("s'éteint sur un glisser abandonné (Échap, dépôt hors fenêtre)", () => {
        const { zone } = zoneWithChild()
        const { result } = renderHook(() =>
            useFileDropZone({ enabled: true, onFiles: () => {} })
        )

        act(() =>
            result.current.dropHandlers.onDragEnter(dragEvent(zone, null))
        )
        expect(result.current.isDragActive).toBe(true)

        act(() => {
            window.dispatchEvent(new Event("dragend"))
        })
        expect(result.current.isDragActive).toBe(false)
    })
})
