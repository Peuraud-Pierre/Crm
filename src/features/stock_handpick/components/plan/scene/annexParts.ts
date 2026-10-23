/**
 * Pièces 3D de l'annexe (zone A), d'après les photos du site : passerelle en
 * caillebotis noir à rambardes rouges, ancienne machine industrielle rouge
 * (plateforme, escalier, trémies, caissons blancs « à yeux », tuyaux),
 * étagères à chaussures, tables et portant de jeans, fresque murale.
 *
 * Exception design system §12.4 (« couleurs d'assets non tokenisables ») pour
 * tout le fichier : voir `warehouseScene.ts`.
 */
/* eslint-disable nokk-project/no-restricted-syntax */
import * as THREE from "three"
import { C, box, clothingRail, mat, mulberry32 } from "./sceneParts"

const ANNEX = {
    grating: "#1f1f1f",
    gratingLine: "#4b4b4b",
    steel: "#2a2a2a",
    boxWhite: "#f3f4f6",
    eye: "#111827",
    eyeBlue: "#60a5fa",
    shoeWhite: "#f5f5f4",
    shoeBrown: "#7c4a2a",
    shoeBlack: "#1c1917",
}

const DENIM = ["#1e3a5f", "#274b7a", "#3b6aa0", "#6f94c2", "#a9c1dd", "#1f2937"]

/** Hauteur de la passerelle à son extrémité haute. */
const WALKWAY_RISE = 1.0
const RAIL_H = 1.0

function gratingTexture(repeatX: number, repeatY: number): THREE.Texture {
    const canvas = document.createElement("canvas")
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
    ctx.fillStyle = ANNEX.grating
    ctx.fillRect(0, 0, 64, 64)
    ctx.strokeStyle = ANNEX.gratingLine
    ctx.lineWidth = 3
    for (let i = 0; i <= 64; i += 16) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, 64)
        ctx.moveTo(0, i)
        ctx.lineTo(64, i)
        ctx.stroke()
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeatX, repeatY)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

/**
 * Passerelle en pente, longueur sur x local : haute en −x, au ras du sol en
 * +x, où une tôle larmée fait la jonction.
 */
export function walkway(length: number, width: number): THREE.Group {
    const group = new THREE.Group()
    const slope = Math.atan2(WALKWAY_RISE, length)
    const red = mat(C.epvRed, { roughness: 0.45, metalness: 0.3 })
    const heightAt = (x: number) => WALKWAY_RISE / 2 - (x * WALKWAY_RISE) / length

    const deck = new THREE.Mesh(
        new THREE.BoxGeometry(Math.hypot(length, WALKWAY_RISE), 0.06, width),
        new THREE.MeshStandardMaterial({
            map: gratingTexture(length * 2, width * 2),
            roughness: 0.6,
            metalness: 0.4,
        }),
    )
    deck.rotation.z = -slope
    deck.position.y = WALKWAY_RISE / 2
    deck.receiveShadow = true
    group.add(deck)

    // Tôle larmée au pied de la rampe.
    group.add(box(1.2, 0.03, width, mat(ANNEX.steel, { metalness: 0.6 }), length / 2 + 0.6, 0.015, 0))
    // Piètement sous la partie haute.
    for (let x = -length / 2 + 0.4; x < length / 2 - 1; x += 2) {
        const h = heightAt(x)
        for (const side of [-1, 1]) {
            group.add(box(0.06, h, 0.06, mat(ANNEX.steel), x, h / 2, (side * (width - 0.1)) / 2))
        }
    }

    // Rambardes rouges des deux côtés : poteaux, main courante, lisse.
    for (const side of [-1, 1]) {
        const z = (side * width) / 2
        for (let x = -length / 2; x <= length / 2 + 0.01; x += 1.2) {
            group.add(box(0.07, RAIL_H, 0.07, red, x, heightAt(x) + RAIL_H / 2, z))
        }
        for (const offset of [RAIL_H, RAIL_H / 2]) {
            const rail = box(Math.hypot(length, WALKWAY_RISE), 0.07, 0.07, red, 0, WALKWAY_RISE / 2 + offset, z)
            rail.rotation.z = -slope
            group.add(rail)
        }
    }
    return group
}

function eyesTexture(blue: boolean): THREE.Texture {
    const canvas = document.createElement("canvas")
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
    ctx.fillStyle = ANNEX.boxWhite
    ctx.fillRect(0, 0, 128, 128)
    for (const x of [24, 72]) {
        ctx.fillStyle = blue ? ANNEX.eyeBlue : ANNEX.boxWhite
        ctx.fillRect(x, 40, 32, 22)
        ctx.strokeStyle = ANNEX.eye
        ctx.lineWidth = 5
        ctx.strokeRect(x, 40, 32, 22)
        ctx.fillStyle = ANNEX.eye
        ctx.fillRect(x + 8, 50, 16, 12)
    }
    ctx.fillRect(56, 84, 16, 16)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

/**
 * Ancienne machine industrielle rouge : ossature, plateforme en caillebotis à
 * 2,4 m, garde-corps, caissons blancs « à yeux », trémies, tuyaux jusqu'au
 * plafond.
 *
 * Comme sur la photo prise depuis la rampe, l'escalier longe la face OUEST
 * (−x) : il part du sol côté sud (+z) et monte vers le nord jusqu'au palier.
 * Il occupe une bande de `STAIR_W` à l'intérieur du rectangle.
 */
const STAIR_W = 0.9

export function industrialMachine(w: number, d: number): THREE.Group {
    const group = new THREE.Group()
    const red = mat(C.epvRed, { roughness: 0.45, metalness: 0.3 })
    const white = mat(ANNEX.boxWhite, { roughness: 0.6 })
    const deckY = 2.4
    const stairRun = Math.min(d - 0.6, 4.2)

    // Plateforme : tout le rectangle sauf la bande d'escalier à l'ouest.
    const px0 = -w / 2 + STAIR_W
    const pw = w - STAIR_W
    const pcx = px0 + pw / 2
    const pz0 = -d / 2
    const pd = d
    const pcz = 0

    // Ossature.
    for (const x of [px0, pcx, w / 2]) {
        for (const z of [pz0, pz0 + pd]) {
            group.add(box(0.14, deckY, 0.14, red, x, deckY / 2, z))
        }
        group.add(box(0.1, 0.1, pd, red, x, 1.2, pcz))
    }
    group.add(box(pw, 0.12, 0.12, red, pcx, 1.2, pz0), box(pw, 0.12, 0.12, red, pcx, 1.2, pz0 + pd))

    // Plateforme et garde-corps (ouvert à l'ouest, au débouché de l'escalier).
    group.add(box(pw + 0.2, 0.08, pd + 0.2, mat(ANNEX.grating, { metalness: 0.4 }), pcx, deckY, pcz))
    for (const [len, x, z, alongX] of [
        [pw, pcx, pz0, true], [pw, pcx, pz0 + pd, true], [pd, w / 2, pcz, false],
    ] as [number, number, number, boolean][]) {
        group.add(
            alongX
                ? box(len, 0.06, 0.06, red, x, deckY + 1, z)
                : box(0.06, 0.06, len, red, x, deckY + 1, z),
        )
    }
    for (const [x, z] of [[px0, pz0], [w / 2, pz0], [px0, pz0 + pd], [w / 2, pz0 + pd]]) {
        group.add(box(0.06, 1, 0.06, red, x, deckY + 0.5, z))
    }

    // Caissons blancs à yeux, face vers le sud (+z), et trémies dessous.
    const count = 3
    for (let i = 0; i < count; i++) {
        const x = px0 + (i + 0.5) * (pw / count)
        const caisson = box(0.8, 0.9, 0.8, white, x, deckY + 0.49, pcz)
        const face = new THREE.Mesh(
            new THREE.PlaneGeometry(0.7, 0.7),
            new THREE.MeshBasicMaterial({ map: eyesTexture(i === 1) }),
        )
        face.position.set(x, deckY + 0.5, pcz + 0.41)
        const hopper = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4), white)
        hopper.rotation.set(Math.PI, Math.PI / 4, 0)
        hopper.position.set(x, 1.75, pcz)
        const lowBox = box(0.7, 0.8, 0.7, white, x, 0.4, pcz + (i % 2 === 0 ? 0.4 : -0.2))
        group.add(caisson, face, hopper, lowBox)
    }

    // Tuyaux rouges montant au plafond puis partant vers l'est.
    const pipe = (len: number, radius: number) =>
        new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 12), red)
    const vertical = pipe(2.6, 0.12)
    vertical.position.set(w / 2 - 0.3, deckY + 1.3, pcz)
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), red)
    elbow.position.set(w / 2 - 0.3, deckY + 2.6, pcz)
    const horizontal = pipe(2.2, 0.12)
    horizontal.rotation.z = Math.PI / 2
    horizontal.position.set(w / 2 + 0.8, deckY + 2.6, pcz)
    const drop = pipe(2.2, 0.08)
    drop.rotation.z = 0.5
    drop.position.set(pcx, deckY - 1.0, pz0 + pd - 0.2)
    group.add(vertical, elbow, horizontal, drop)

    // Escalier rouge, face ouest : du sol (sud, +z) au palier (nord, −z).
    const sx = -w / 2 + STAIR_W / 2
    const zBottom = d / 2
    const zTop = d / 2 - stairRun
    const steps = 12
    for (let i = 0; i < steps; i++) {
        const y = ((i + 1) * deckY) / steps
        const z = zBottom - ((i + 0.5) * stairRun) / steps
        group.add(box(STAIR_W - 0.15, 0.05, stairRun / steps + 0.02, red, sx, y, z))
    }
    // Palier au débouché, raccordé à la plateforme.
    group.add(box(STAIR_W, 0.06, 0.8, mat(ANNEX.grating, { metalness: 0.4 }), sx, deckY, zTop - 0.4))
    const slope = Math.atan2(deckY, stairRun)
    const stringerLen = Math.hypot(stairRun, deckY)
    for (const side of [-1, 1]) {
        const x = sx + (side * (STAIR_W - 0.1)) / 2
        // Monte vers −z : rotation positive autour de x.
        const stringer = box(0.05, 0.14, stringerLen, red, x, deckY / 2, (zBottom + zTop) / 2)
        stringer.rotation.x = slope
        const handrail = box(0.05, 0.05, stringerLen, red, x, deckY / 2 + 0.95, (zBottom + zTop) / 2)
        handrail.rotation.x = slope
        group.add(stringer, handrail)
    }

    return group
}

/**
 * Étagère métallique à chaussures, longueur sur x local : cinq niveaux de
 * paires blanches, marron et noires.
 */
export function shoeShelf(length: number, depth: number, seed: number): THREE.Group {
    const group = new THREE.Group()
    const steel = mat(ANNEX.steel, { metalness: 0.5, roughness: 0.4 })
    const height = 2.0
    for (const x of [-length / 2, length / 2]) {
        for (const z of [-depth / 2, depth / 2]) {
            group.add(box(0.04, height, 0.04, steel, x, height / 2, z))
        }
    }
    const rand = mulberry32(seed)
    const colors = [ANNEX.shoeWhite, ANNEX.shoeWhite, ANNEX.shoeBrown, ANNEX.shoeBlack]
    for (let level = 0; level < 5; level++) {
        const y = 0.3 + level * 0.4
        group.add(box(length, 0.03, depth, steel, 0, y, 0))
        const pairs = Math.max(1, Math.floor(length / 0.32))
        for (let i = 0; i < pairs; i++) {
            if (rand() < 0.2) continue
            const shoe = mat(colors[Math.floor(rand() * colors.length)], { roughness: 0.7 })
            const x = -length / 2 + 0.16 + i * (length / pairs)
            group.add(
                box(0.1, 0.1, Math.min(0.28, depth - 0.05), shoe, x - 0.05, y + 0.065, 0),
                box(0.1, 0.1, Math.min(0.28, depth - 0.05), shoe, x + 0.06, y + 0.065, 0),
            )
        }
    }
    return group
}

/** Pile de jeans pliés, dans les nuances de bleu. */
function denimPile(w: number, d: number, y: number, seed: number): THREE.Group {
    const group = new THREE.Group()
    const rand = mulberry32(seed)
    const cols = Math.max(1, Math.floor(w / 0.35))
    const rows = Math.max(1, Math.floor(d / 0.3))
    for (let ix = 0; ix < cols; ix++) {
        for (let iz = 0; iz < rows; iz++) {
            const stack = 1 + Math.floor(rand() * 4)
            for (let k = 0; k < stack; k++) {
                const color = DENIM[Math.floor(rand() * DENIM.length)]
                group.add(box(
                    0.3, 0.05, 0.25, mat(color, { roughness: 0.95 }),
                    -w / 2 + (ix + 0.5) * (w / cols), y + 0.025 + k * 0.05, -d / 2 + (iz + 0.5) * (d / rows),
                ))
            }
        }
    }
    return group
}

/** Table métallique noire chargée de jeans pliés. */
export function denimTable(w: number, d: number, seed: number): THREE.Group {
    const group = new THREE.Group()
    const steel = mat(ANNEX.steel, { metalness: 0.5, roughness: 0.4 })
    group.add(box(w, 0.04, d, steel, 0, 0.75, 0))
    for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) {
        for (const z of [-d / 2 + 0.03, d / 2 - 0.03]) {
            group.add(box(0.04, 0.75, 0.04, steel, x, 0.375, z))
        }
    }
    group.add(denimPile(w - 0.1, d - 0.1, 0.77, seed))
    return group
}

/** Table ronde sur pied central, garnie de jeans. */
export function roundTable(diameter: number, seed: number): THREE.Group {
    const group = new THREE.Group()
    const steel = mat(ANNEX.steel, { metalness: 0.5, roughness: 0.4 })
    const top = new THREE.Mesh(new THREE.CylinderGeometry(diameter / 2, diameter / 2, 0.04, 28), steel)
    top.position.y = 0.75
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 10), steel)
    leg.position.y = 0.375
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 20), steel)
    foot.position.y = 0.015
    group.add(top, leg, foot, denimPile(diameter * 0.6, diameter * 0.6, 0.77, seed))
    return group
}

/** Portant de jeans. */
export function jeansRail(length: number, seed: number): THREE.Group {
    return clothingRail(length, seed, DENIM)
}

/** Fresque « NOKK_PROJECT VINTAGE » en lettres noires et rouges. */
export function muralTexture(): THREE.Texture {
    const canvas = document.createElement("canvas")
    canvas.width = 512
    canvas.height = 256
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
    ctx.fillStyle = ANNEX.boxWhite
    ctx.fillRect(0, 0, 512, 256)
    ctx.textAlign = "center"
    ctx.fillStyle = ANNEX.eye
    ctx.font = "bold 96px sans-serif"
    ctx.fillText("NOKK_PROJECT", 256, 110)
    ctx.fillStyle = C.epvRed
    ctx.font = "bold 64px sans-serif"
    ctx.fillText("VINTAGE", 256, 200)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}
