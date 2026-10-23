/**
 * Modèles 3D des équipements du plan : comptoir de caisse et portes.
 *
 * Comme le portant (`portant.ts`), chaque modèle suit la plus grande
 * dimension de son rectangle au sol et se construit centré sur l'origine, au
 * sol ; l'appelant le positionne et le tourne. Cotes en mètres.
 */
import * as THREE from "three"

export interface EquipementSpec {
    w: number
    d: number
    /** Couleur du rôle (caisse, entrée, sortie…). */
    color: THREE.Color
    /** Teinte des parties neutres (métal, verre, écran). */
    neutral: THREE.Color
    opacity: number
}

export const COUNTER_HEIGHT = 0.95
export const DOOR_HEIGHT = 2.1

function material(color: THREE.Color, opacity: number, extra: THREE.MeshStandardMaterialParameters = {}) {
    return new THREE.MeshStandardMaterial({ color, transparent: opacity < 1, opacity, ...extra })
}

/** Repère local : u le long de l'équipement, v en travers. */
function axes(w: number, d: number) {
    const alongX = w >= d
    return {
        length: Math.max(w, d),
        depth: Math.min(w, d),
        box: (u: number, y: number, v: number) =>
            alongX ? new THREE.BoxGeometry(u, y, v) : new THREE.BoxGeometry(v, y, u),
        at: (u: number, y: number, v: number) =>
            alongX ? new THREE.Vector3(u, y, v) : new THREE.Vector3(v, y, u),
    }
}

function place(group: THREE.Group, geometry: THREE.BufferGeometry, mat: THREE.Material, position: THREE.Vector3) {
    const mesh = new THREE.Mesh(geometry, mat)
    mesh.position.copy(position)
    group.add(mesh)
    return mesh
}

/**
 * Comptoir de caisse : caisson, plateau débordant, écran sur pied et
 * terminal de paiement.
 */
export function buildCaisse({ w, d, color, neutral, opacity }: EquipementSpec): THREE.Group {
    const group = new THREE.Group()
    const { length, depth, box, at } = axes(w, d)
    const body = material(color, opacity, { roughness: 0.7 })
    const top = material(color.clone().offsetHSL(0, -0.2, 0.25), opacity, { roughness: 0.4 })
    const dark = material(neutral.clone().multiplyScalar(0.35), opacity, { roughness: 0.3, metalness: 0.4 })

    place(group, box(length, COUNTER_HEIGHT - 0.04, depth), body, at(0, (COUNTER_HEIGHT - 0.04) / 2, 0))
    place(group, box(length + 0.06, 0.04, depth + 0.06), top, at(0, COUNTER_HEIGHT - 0.02, 0))

    // Écran de caisse, côté vendeur, incliné vers lui.
    const u = length / 2 - Math.min(0.35, length / 4)
    place(group, box(0.06, 0.18, 0.06), dark, at(u, COUNTER_HEIGHT + 0.09, 0))
    const screen = place(group, box(0.36, 0.26, 0.03), dark, at(u, COUNTER_HEIGHT + 0.3, 0))
    screen.rotation.set(w >= d ? 0 : -0.25, 0, w >= d ? -0.25 : 0)
    // Terminal de paiement, côté client.
    place(group, box(0.09, 0.03, 0.16), dark, at(-u, COUNTER_HEIGHT + 0.015, depth / 4))

    return group
}

/**
 * Porte : cadre (deux montants et un linteau), un ou deux vantaux vitrés, un
 * panneau de la couleur du rôle au-dessus, et un tapis au sol de la même
 * couleur, visible de loin.
 */
export function buildPorte({ w, d, color, neutral, opacity }: EquipementSpec): THREE.Group {
    const group = new THREE.Group()
    const { length, box, at } = axes(w, d)
    const frame = material(neutral.clone().multiplyScalar(0.5), opacity, { metalness: 0.6, roughness: 0.4 })
    const glass = material(neutral.clone().lerp(new THREE.Color(1, 1, 1), 0.6), Math.min(opacity, 0.3), {
        roughness: 0.05,
        depthWrite: false,
    })
    const role = material(color, opacity, { roughness: 0.6 })

    const post = 0.08
    const half = length / 2 - post / 2
    for (const end of [-half, half]) {
        place(group, box(post, DOOR_HEIGHT, post), frame, at(end, DOOR_HEIGHT / 2, 0))
    }
    place(group, box(length, post, post), frame, at(0, DOOR_HEIGHT - post / 2, 0))

    // Vantaux : deux au-delà de 1,2 m de passage, sinon un seul.
    const opening = length - 2 * post
    const leaves = opening > 1.2 ? 2 : 1
    const leaf = opening / leaves
    for (let i = 0; i < leaves; i++) {
        const u = -opening / 2 + leaf * (i + 0.5)
        place(group, box(leaf - 0.02, DOOR_HEIGHT - post - 0.02, 0.03), glass, at(u, (DOOR_HEIGHT - post) / 2, 0))
    }

    // Panneau au-dessus du linteau, et tapis au sol.
    place(group, box(Math.min(0.7, length * 0.6), 0.2, 0.04), role, at(0, DOOR_HEIGHT + 0.14, 0))
    place(group, box(length, 0.01, 0.9), role, at(0, 0.005, 0))

    return group
}

/** Hauteur d'une marche courante, en mètres. */
const RISER = 0.18

/**
 * Escalier droit : une marche par giron, de plus en plus haute dans le sens de
 * la longueur (vers +x ou +z du repère local avant rotation), jusqu'à
 * `height`, avec une main courante côté gauche.
 */
/**
 * `start` : niveau de départ de la volée, pour un escalier fusionné dont elle
 * prolonge la précédente ; ses marches restent pleines jusqu'au sol.
 * `down` : l'escalier descend vers l'étage du dessous, dans le sens de la
 * flèche — ses marches s'enfoncent sous le sol, vues par la trémie, et restent
 * pleines jusqu'au sol de l'étage du dessous.
 */
export function buildEscalier(
    { w, d, color, neutral, opacity }: EquipementSpec,
    height: number,
    start = 0,
    down = false,
): THREE.Group {
    const group = new THREE.Group()
    const { length, depth, box, at } = axes(w, d)
    const steps = Math.max(2, Math.round(height / RISER))
    const run = length / steps
    const rise = height / steps
    const tread = material(color, opacity, { roughness: 0.8 })
    for (let i = 0; i < steps; i++) {
        const top = down ? start - rise * (i + 1) : start + rise * (i + 1)
        // Marche pleine jusqu'au sol : l'escalier se lit comme un bloc en gradins.
        const floor = down ? start - height : 0
        place(group, box(run, top - floor, depth), tread, at(-length / 2 + run * (i + 0.5), (top + floor) / 2, 0))
    }
    // Descente simulée dans une trémie : pas de main courante qui dépasse du sol.
    if (down) return group
    // Main courante, parallèle à la pente, à 90 cm au-dessus des nez de marche.
    const rail = material(neutral.clone().multiplyScalar(0.5), opacity, { metalness: 0.6, roughness: 0.4 })
    const slope = Math.hypot(length, height)
    const handrail = place(group, box(slope, 0.04, 0.04), rail, at(0, (down ? start - height / 2 : start + height / 2) + 0.9, -depth / 2 + 0.03))
    const angle = Math.atan2(down ? -height : height, length)
    // La pente monte selon l'axe de la longueur : rotation autour de l'axe en travers.
    if (w >= d) handrail.rotation.z = angle
    else handrail.rotation.x = -angle
    return group
}

/** Tour d'un colimaçon, en degrés : un tour moins le palier d'arrivée. */
const SPIRAL_TURN_DEG = 330

/**
 * Escalier en colimaçon : un poteau central et des marches en éventail qui
 * montent en tournant dans le sens horaire vu de dessus, en partant du haut
 * du cercle (−z) — le sens de l'arc fléché du plan 2D.
 */
export function buildColimacon({ w, d, color, neutral, opacity }: EquipementSpec, height: number): THREE.Group {
    const group = new THREE.Group()
    const radius = Math.min(w, d) / 2
    const steps = Math.max(4, Math.round(height / RISER))
    const sweep = (SPIRAL_TURN_DEG * Math.PI) / 180 / steps
    const metal = material(neutral.clone().multiplyScalar(0.5), opacity, { metalness: 0.6, roughness: 0.4 })
    const tread = material(color, opacity, { roughness: 0.8 })

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.07, radius * 0.07, height + 0.9, 16), metal)
    pole.position.y = (height + 0.9) / 2
    group.add(pole)

    for (let i = 0; i < steps; i++) {
        // Marche en coin : un secteur de disque, épais de 5 cm.
        const shape = new THREE.Shape()
        shape.moveTo(0, 0)
        shape.absarc(0, 0, radius, 0, sweep * 1.05, false)
        shape.lineTo(0, 0)
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false })
        const marche = new THREE.Mesh(geometry, tread)
        // Couchée à plat (le secteur dans le plan XZ), puis tournée à sa place.
        marche.rotation.x = Math.PI / 2
        const pivot = new THREE.Group()
        pivot.add(marche)
        pivot.position.y = (height / steps) * (i + 1)
        // Rotation θ autour de Y : un point d'angle a (de +x vers +z) passe à
        // a − θ. Avec θ = π/2 − i·sweep, la marche i couvre [−π/2 + i·sweep,
        // −π/2 + (i+1)·sweep] : départ en haut (−z), puis sens horaire.
        pivot.rotation.y = Math.PI / 2 - i * sweep
        group.add(pivot)
    }
    return group
}

