/**
 * Aménagements du plan 3D : bureaux, enseigne, crochets muraux, et
 * l'aiguillage `fixture()` qui construit chaque aménagement de
 * `FLOOR.fixtures` (mobilier de boutique, pièces de l'annexe…).
 *
 * Exception design system §12.4 (« couleurs d'assets non tokenisables ») pour
 * tout le fichier : voir `warehouseScene.ts`.
 */
/* eslint-disable nokk-project/no-restricted-syntax */
import * as THREE from "three"
import { C, bagPile, box, makeLabel, mat } from "./sceneParts"
import {
    bagStack,
    clearBin,
    mannequin,
    shopIsland,
    shopTable,
    sofa,
    trolley,
    wallDisplay,
    washingMachine,
    wireBin,
    woodTable,
} from "./shopParts"
import {
    denimTable,
    industrialMachine,
    jeansRail,
    muralTexture,
    roundTable,
    shoeShelf,
    walkway,
} from "./annexParts"
import type { FixtureSpec, InnerWallSpec, Rect } from "@/features/stock_handpick/utils/floorPlan"

const OFFICE_H = 2.6

export const center = (rect: Rect) => ({ x: rect.x + rect.w / 2, z: rect.z + rect.d / 2 })

/**
 * Rotation 3D (autour de y) d'un élément du plan : quart de tour si sa
 * longueur suit z, puis son angle libre. Le plan tourne dans le sens horaire
 * à l'écran (z vers le bas) ; en 3D vu du dessus, c'est un angle négatif.
 */
export const yaw = (along: boolean, rotation?: number) =>
    (along ? 0 : -Math.PI / 2) - THREE.MathUtils.degToRad(rotation ?? 0)

export function signTexture(): THREE.Texture {
    const canvas = document.createElement("canvas")
    canvas.width = 1024
    canvas.height = 146
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, 1024, 146)
    ctx.font = "bold 104px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const parts: [string, string][] = [["SEE ", "#111827"], ["YOU", C.epvRed], [" SOON", "#111827"]]
    const total = parts.reduce((sum, [text]) => sum + ctx.measureText(text).width, 0)
    let x = 512 - total / 2
    ctx.textAlign = "left"
    for (const [text, color] of parts) {
        ctx.fillStyle = color
        ctx.fillText(text, x, 78)
        x += ctx.measureText(text).width
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

/**
 * Mascotte Nokk_project (`public/mascotte.svg`) : le SVG n'a pas de taille
 * intrinsèque, on le rastérise dans un canvas au ratio de son viewBox
 * (430.6 × 417.6). La texture se met à jour une fois l'image chargée.
 */
export const MASCOT_RATIO = 430.6 / 417.6

export function mascotTexture(): THREE.Texture {
    const canvas = document.createElement("canvas")
    canvas.width = 1024
    canvas.height = Math.round(1024 / MASCOT_RATIO)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const image = new Image()
    image.onload = () => {
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        texture.needsUpdate = true
    }
    image.src = "/mascotte.svg"
    return texture
}

/** Rangée de crochets rouges au mur, au-dessus des portants (photo). */
export function wallHooks(x: number, z1: number, z2: number): THREE.Group {
    const group = new THREE.Group()
    const red = mat(C.epvRed)
    group.add(box(0.04, 0.05, z2 - z1, mat(C.brace, { metalness: 0.5 }), x, 2.6, (z1 + z2) / 2))
    for (let z = z1 + 0.4; z < z2; z += 0.9) {
        group.add(box(0.18, 0.12, 0.3, red, x - 0.09, 2.6, z))
    }
    return group
}

// ─── Aménagements ────────────────────────────────────────────────────────────

export function office(rect: Rect, label: string, rotation?: number): THREE.Group {
    const group = new THREE.Group()
    const glass = mat(C.office, { transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1 })
    const frame = mat(C.office, { roughness: 0.4 })
    // Construit autour de l'origine, puis placé et tourné.
    const c = { x: 0, z: 0 }
    group.add(box(rect.w, 0.04, rect.d, mat(C.office, { transparent: true, opacity: 0.25 }), c.x, 0.02, c.z))
    for (const side of [-1, 1]) {
        group.add(box(rect.w, OFFICE_H, 0.06, glass, c.x, OFFICE_H / 2, c.z + (side * rect.d) / 2))
        group.add(box(0.06, OFFICE_H, rect.d, glass, c.x + (side * rect.w) / 2, OFFICE_H / 2, c.z))
        group.add(box(rect.w, 0.08, 0.1, frame, c.x, OFFICE_H, c.z + (side * rect.d) / 2))
        group.add(box(0.1, 0.08, rect.d, frame, c.x + (side * rect.w) / 2, OFFICE_H, c.z))
    }
    // Bureau et écran.
    group.add(box(1.6, 0.05, 0.8, mat(C.wood), c.x, 0.75, c.z))
    group.add(box(0.05, 0.75, 0.7, mat(C.rail), c.x - 0.75, 0.37, c.z))
    group.add(box(0.05, 0.75, 0.7, mat(C.rail), c.x + 0.75, 0.37, c.z))
    group.add(box(0.6, 0.38, 0.04, mat(C.rail), c.x, 1.0, c.z - 0.25))
    const sprite = makeLabel(label, undefined, C.office)
    sprite.scale.set(2.6, 0.8, 1)
    sprite.position.set(c.x, OFFICE_H + 0.8, c.z)
    group.add(sprite)
    const at = center(rect)
    group.position.set(at.x, 0, at.z)
    group.rotation.y = yaw(true, rotation)
    return group
}

/**
 * Place un meuble au centre de son rectangle, tourné selon son axe et son
 * angle. `absolute` : meuble construit directement aux dimensions du plan
 * (largeur sur x, profondeur sur z) — seul l'angle s'applique.
 */
function placed(object: THREE.Object3D, spec: FixtureSpec, absolute = false): THREE.Object3D {
    const c = center(spec.rect)
    object.position.set(c.x, object.position.y, c.z)
    object.rotation.y = yaw(absolute || spec.axis !== "z", spec.rotation)
    return object
}

export function fixture(spec: FixtureSpec): THREE.Object3D {
    const { rect } = spec
    const length = spec.axis === "z" ? rect.d : rect.w
    const seed = Math.round(rect.x * 10 + rect.z)
    switch (spec.kind) {
        case "island":
            return placed(shopIsland(length, seed), spec)
        case "shopTable":
            return placed(shopTable(seed), spec)
        case "bagStack":
            return placed(bagStack(seed), spec)
        case "wireBin":
            return placed(wireBin(seed), spec)
        case "trolley":
            return placed(trolley(), spec)
        case "clearBin":
            return placed(clearBin(), spec)
        case "mannequin":
            return placed(mannequin(), spec)
        case "storage": {
            const pile = bagPile(
                Math.round(rect.w * rect.d * 1.6),
                rect.w - 0.3, rect.d - 0.3, 2, Math.round(rect.x * 10),
            )
            return placed(pile, spec, true)
        }
        case "platform": {
            const group = new THREE.Group()
            group.add(box(rect.w, 1.0, rect.d, mat(C.osb), 0, 0.5, 0))
            const trim = mat(C.epvRed)
            for (const side of [-1, 1]) {
                group.add(box(rect.w + 0.08, 0.16, 0.08, trim, 0, 1.0, (side * rect.d) / 2))
                group.add(box(0.08, 0.16, rect.d, trim, (side * rect.w) / 2, 1.0, 0))
            }
            return placed(group, spec, true)
        }
        case "room":
            return placed(
                box(rect.w, OFFICE_H, rect.d, mat(C.wall, { transparent: true, opacity: 0.8 }), 0, OFFICE_H / 2, 0),
                spec,
                true,
            )
        case "displayWall":
            return placed(wallDisplay(length - 0.4, seed), spec)
        case "walkway":
            return placed(walkway(length, spec.axis === "z" ? rect.w : rect.d), spec)
        case "machine":
            return placed(industrialMachine(rect.w, rect.d), spec, true)
        case "denimTable":
            return placed(denimTable(length, spec.axis === "z" ? rect.w : rect.d, seed), spec)
        case "roundTable":
            return placed(roundTable(rect.w, seed), spec, true)
        case "guard":
            return placed(box(rect.w, 1.1, rect.d, mat(C.epvRed, { roughness: 0.4 }), 0, 0.55, 0), spec, true)
        case "shoeShelf":
            return placed(shoeShelf(length, spec.axis === "z" ? rect.w : rect.d, seed), spec)
        case "jeansRail":
            return placed(jeansRail(length, seed), spec)
        case "sofa": {
            // Le canapé suit son côté long : après un quart de tour (largeur et
            // profondeur échangées), il est construit en long puis tourné,
            // dossier à l'est — les accoudoirs restent aux petits bouts.
            if (rect.w >= rect.d) return placed(sofa(rect.w, rect.d), spec, true)
            const turned = new THREE.Group()
            const body = sofa(rect.d, rect.w)
            body.rotation.y = -Math.PI / 2
            turned.add(body)
            return placed(turned, spec, true)
        }
        case "table":
            return placed(woodTable(rect.w, rect.d), spec, true)
        case "washer":
            return placed(washingMachine(rect.w, rect.d), spec, true)
    }
}

/**
 * Cloison intérieure blanche, avec la fresque « NOKK_PROJECT VINTAGE » sur sa
 * face est (côté passerelle de l'annexe).
 */
export function innerWall(spec: InnerWallSpec, height: number): THREE.Group {
    const { from, to } = spec
    const group = new THREE.Group()
    const len = Math.hypot(to[0] - from[0], to[1] - from[1])
    const angle = Math.atan2(to[1] - from[1], to[0] - from[0])
    const color = spec.tone === "black" ? C.castIron : C.wall
    const wall = box(len, height, 0.15, mat(color, { roughness: 0.95 }), 0, height / 2, 0)
    group.add(wall)
    group.position.set((from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2)
    group.rotation.y = -angle
    if (!spec.mural) return group
    const mural = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(4, len - 0.4), height * 0.55),
        new THREE.MeshBasicMaterial({ map: muralTexture(), transparent: true }),
    )
    // Tournée de -90°, la face -z locale regarde l'est (côté passerelle).
    mural.position.set(len / 2 - Math.min(4, len - 0.4) / 2 - 0.3, height * 0.6, -0.08)
    mural.rotation.y = Math.PI
    group.add(mural)
    return group
}
