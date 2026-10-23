/**
 * Pièces détachées du décor 3D de l'entrepôt : matériaux, étiquettes, sacs,
 * palettes, colonnes EPV et mobilier de boutique. L'assemblage vit dans
 * `warehouseScene.ts`.
 *
 * Exception design system §12.4 (« couleurs d'assets non tokenisables ») pour
 * tout le fichier : voir `warehouseScene.ts`.
 */
/* eslint-disable nokk-project/no-restricted-syntax */
import * as THREE from "three"
import { DEFAULT_FLOOR } from "@/features/stock_handpick/utils/floorPlan"
import { PILE_MAX_COLS, pileSlots } from "@/features/stock_handpick/utils/pileLayout"

/** Hauteur sous plafond : les colonnes montent jusque-là. */
export const SITE = { width: DEFAULT_FLOOR.width, depth: DEFAULT_FLOOR.depth, wallHeight: 5.4 }

export const C = {
    rackBlue: "#1d4fa8",
    beamOrange: "#e2601c",
    slat: "#c9a36b",
    pallet: "#b8894d",
    brace: "#9aa3ad",
    concrete: "#b9bab5",
    shopFloor: "#eef0f0",
    wall: "#f4f4f2",
    castIron: "#1c1c1e",
    epvRed: "#e0301e",
    osb: "#caa56b",
    bagGreen: "#27b28a",
    bagPlastic: "#dde2e6",
    rail: "#161616",
    wood: "#a8744a",
    darkConcrete: "#7c7b77",
    office: "#3b82f6",
    door: "#0a0a0a",
    highlight: "#22c55e",
    selected: "#facc15",
}

const CLOTH_PALETTE = [
    "#b91c1c", "#1e3a8a", "#f5f5f4", "#111827", "#65a30d", "#ca8a04",
    "#7c3aed", "#db2777", "#0e7490", "#78350f", "#9ca3af", "#ea580c",
]

// ─── Outils ──────────────────────────────────────────────────────────────────

/** PRNG déterministe : le décor ne « bouge » pas d'un rendu à l'autre. */
export function mulberry32(seed: number) {
    let a = seed
    return () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

export const materialCache = new Map<string, THREE.MeshStandardMaterial>()
export function mat(color: string, opts: THREE.MeshStandardMaterialParameters = {}) {
    const key = `${color}|${JSON.stringify(opts)}`
    let material = materialCache.get(key)
    if (!material) {
        material = new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts })
        materialCache.set(key, material)
    }
    return material
}

/** À appeler au démontage : le cache survit sinon à la scène. */
export function disposeMaterialCache() {
    for (const material of materialCache.values()) material.dispose()
    materialCache.clear()
}

export function box(
    w: number, h: number, d: number,
    material: THREE.Material,
    x: number, y: number, z: number,
): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
}

/** Étiquette flottante, toujours face caméra. */
export function makeLabel(text: string, sub?: string, accent = "#111827"): THREE.Sprite {
    const canvas = document.createElement("canvas")
    canvas.width = 512
    canvas.height = 160
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
    ctx.fillStyle = "rgba(255,255,255,0.92)"
    ctx.beginPath()
    ctx.roundRect(8, 8, 496, 144, 36)
    ctx.fill()
    ctx.fillStyle = accent
    ctx.fillRect(8, 8, 18, 144)
    ctx.fillStyle = "#111827"
    ctx.textAlign = "center"
    ctx.font = "bold 64px sans-serif"
    ctx.fillText(text, 266, sub ? 78 : 100)
    if (sub) {
        ctx.fillStyle = "#6b7280"
        ctx.font = "40px sans-serif"
        ctx.fillText(sub, 266, 130)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }),
    )
    sprite.scale.set(3.2, 1, 1)
    sprite.renderOrder = 10
    return sprite
}

export function epvTexture(): THREE.Texture {
    const canvas = document.createElement("canvas")
    canvas.width = 128
    canvas.height = 256
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
    ctx.fillStyle = C.epvRed
    ctx.fillRect(0, 0, 128, 256)
    ctx.fillStyle = "#1c1c1e"
    ctx.font = "bold 44px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("EPV", 64, 80)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

// ─── Éléments ────────────────────────────────────────────────────────────────

/** Colonne en fonte sur socle rouge, signature du lieu. */
export function pillar(x: number, z: number, epv: THREE.Material): THREE.Group {
    const group = new THREE.Group()
    const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, SITE.wallHeight, 16),
        mat(C.castIron, { roughness: 0.4, metalness: 0.4 }),
    )
    shaft.position.y = SITE.wallHeight / 2
    shaft.castShadow = true
    const capital = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.12, 0.4, 16),
        mat(C.castIron, { roughness: 0.4, metalness: 0.4 }),
    )
    capital.position.y = SITE.wallHeight - 0.2
    const base = box(0.46, 1.1, 0.46, epv, 0, 0.55, 0)
    group.add(shaft, capital, base)
    group.position.set(x, 0, z)
    return group
}

/** Un sac : ellipsoïde écrasé, vert ou plastique transparent. */
function bag(rand: () => number, x: number, y: number, z: number): THREE.Mesh {
    const plastic = rand() < 0.45
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 14, 10),
        plastic
            ? mat(C.bagPlastic, { transparent: true, opacity: 0.88, roughness: 0.25 })
            : mat(C.bagGreen, { roughness: 0.55 }),
    )
    mesh.scale.set(0.95 + rand() * 0.2, 0.42 + rand() * 0.1, 0.62 + rand() * 0.1)
    mesh.rotation.y = (rand() - 0.5) * 0.5
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    return mesh
}

/** Pile de sacs sur une surface de `w` × `d`, jusqu'à `count` sacs. */
export function bagPile(
    count: number, w: number, d: number, maxLayers: number, seed: number,
): THREE.Group {
    const group = new THREE.Group()
    const rand = mulberry32(seed)
    const perLayerX = Math.max(1, Math.floor(w / 1.0))
    const perLayerZ = Math.max(1, Math.floor(d / 0.7))
    const perLayer = perLayerX * perLayerZ
    const shown = Math.min(count, perLayer * maxLayers)
    for (let i = 0; i < shown; i++) {
        const layer = Math.floor(i / perLayer)
        const slot = i % perLayer
        const ix = slot % perLayerX
        const iz = Math.floor(slot / perLayerX)
        group.add(bag(
            rand,
            (ix - (perLayerX - 1) / 2) * (w / perLayerX),
            0.21 + layer * 0.4,
            (iz - (perLayerZ - 1) / 2) * (d / perLayerZ),
        ))
    }
    return group
}

/** Encombrement d'une balle en longueur et en hauteur, à l'échelle 1. */
const BALE_LENGTH = 1.05
const BALE_LAYER_H = 0.4

/**
 * Balles RÉELLES d'un emplacement : un sac dessiné pour deux balles, rangés
 * sur une seule rangée en longueur puis empilés, 3 × 3 au plus (`pileSlots`).
 * Sur une travée trop courte pour trois balles, elles sont resserrées.
 * `bagPile`, lui, reste pour les piles de décor.
 */
export function balePile(count: number, length: number, seed: number): THREE.Group {
    const group = new THREE.Group()
    const rand = mulberry32(seed)
    const pitch = Math.min(BALE_LENGTH, length / PILE_MAX_COLS)
    const squeeze = pitch / BALE_LENGTH
    for (const { col, layer } of pileSlots(count)) {
        const mesh = bag(rand, col * pitch, 0.21 + layer * BALE_LAYER_H, 0)
        mesh.scale.x *= squeeze
        group.add(mesh)
    }
    return group
}

export function palletMesh(x: number, z: number, w = 1.2, d = 1.0): THREE.Mesh {
    return box(w, 0.14, d, mat(C.pallet), x, 0.07, z)
}

/** Portant noir chargé de vêtements (une seule InstancedMesh par portant). */
export function clothingRail(
    length: number,
    seed: number,
    palette: readonly string[] = CLOTH_PALETTE,
): THREE.Group {
    const group = new THREE.Group()
    const black = mat(C.rail, { metalness: 0.5, roughness: 0.35 })
    for (const x of [-length / 2, length / 2]) {
        group.add(box(0.05, 1.5, 0.05, black, x, 0.75, 0))
        group.add(box(0.05, 0.05, 0.55, black, x, 0.03, 0))
    }
    group.add(box(length, 0.04, 0.04, black, 0, 1.48, 0))

    const rand = mulberry32(seed)
    const count = Math.floor(length / 0.07)
    const garments = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.035, 1, 0.5),
        new THREE.MeshStandardMaterial({ roughness: 0.9 }),
        count,
    )
    const matrix = new THREE.Matrix4()
    const color = new THREE.Color()
    for (let i = 0; i < count; i++) {
        const h = 0.75 + rand() * 0.35
        matrix.compose(
            new THREE.Vector3(-length / 2 + 0.08 + i * 0.07, 1.46 - h / 2, 0),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (rand() - 0.5) * 0.25, 0)),
            new THREE.Vector3(1, h, 0.9 + rand() * 0.2),
        )
        garments.setMatrixAt(i, matrix)
        garments.setColorAt(i, color.set(palette[Math.floor(rand() * palette.length)]))
    }
    garments.castShadow = true
    group.add(garments)
    return group
}

/** Îlot : deux portants dos à dos sous un plateau bois. */
export function island(length: number, seed: number): THREE.Group {
    const group = new THREE.Group()
    const front = clothingRail(length, seed)
    front.position.z = -0.32
    const back = clothingRail(length, seed + 1)
    back.position.z = 0.32
    group.add(front, back, box(length + 0.2, 0.05, 0.5, mat(C.wood), 0, 1.62, 0))
    return group
}

/** Table basse de t-shirts pliés. */
export function foldTable(seed: number): THREE.Group {
    const group = new THREE.Group()
    const iron = mat(C.wood, { metalness: 0.3 })
    group.add(box(2.3, 0.05, 1.0, mat(C.wood), 0, 0.8, 0))
    for (const [x, z] of [[-1.1, -0.45], [1.1, -0.45], [-1.1, 0.45], [1.1, 0.45]]) {
        group.add(box(0.04, 0.8, 0.04, iron, x, 0.4, z))
    }
    const rand = mulberry32(seed)
    for (let ix = 0; ix < 6; ix++) {
        for (let iz = 0; iz < 3; iz++) {
            const stack = 1 + Math.floor(rand() * 3)
            for (let k = 0; k < stack; k++) {
                const colorIndex = Math.floor(rand() * CLOTH_PALETTE.length)
                group.add(box(
                    0.32, 0.04, 0.26, mat(CLOTH_PALETTE[colorIndex], { roughness: 0.95 }),
                    -0.9 + ix * 0.36, 0.845 + k * 0.045, -0.32 + iz * 0.32,
                ))
            }
        }
    }
    return group
}

/** Libère récursivement géométries, matériaux et textures non mis en cache. */
export function disposeObject(object: THREE.Object3D) {
    const cached = new Set<THREE.Material>(materialCache.values())
    object.traverse((child) => {
        const mesh = child as THREE.Mesh
        // La géométrie d'un Sprite est partagée par tous les sprites.
        if (!(child instanceof THREE.Sprite)) mesh.geometry?.dispose()
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
        for (const material of materials) {
            if (cached.has(material)) continue
            ;(material as THREE.MeshBasicMaterial).map?.dispose()
            material.dispose()
        }
    })
}
