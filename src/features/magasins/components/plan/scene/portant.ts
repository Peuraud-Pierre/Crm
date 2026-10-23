/**
 * Modèle 3D d'un portant à vêtements, construit en primitives three.
 *
 *        ┌──────────────── barre ────────────────┐
 *        │  ╿ ╿ ╿ ╿ ╿ ╿ ╿ ╿ ╿ ╿ ╿ ╿ ╿ ╿ ╿ ╿ ╿ ╿  │   ← cintres
 *        │  ▌ ▌ ▌ ▌ ▌ ▌ ▌ ▌ ▌ ▌ ▌ ▌ ▌ ▌ ▌ ▌ ▌ ▌  │   ← vêtements
 *        │                                        │
 *      ══╧══                                    ══╧══ ← pieds
 *
 * Le portant suit la plus grande dimension de son rectangle au sol : posé en
 * long ou en travers, il se dessine dans le bon sens sans réglage. Toutes les
 * cotes sont en mètres.
 */
import * as THREE from "three"

/** Hauteur de la barre : celle d'un portant de boutique standard. */
export const PORTANT_HEIGHT = 1.6
/** Bande des vêtements suspendus, utilisée aussi pour les emplacements. */
export const GARMENT_TOP = 1.48
export const GARMENT_BOTTOM = 0.62

const TUBE = 0.02
const GARMENT_STEP = 0.11
const MAX_GARMENTS = 60

export interface PortantSpec {
    /** Emprise au sol, le long des axes x et z de la scène. */
    w: number
    d: number
    /** Couleur de la zone : décline la teinte des vêtements. */
    color: THREE.Color
    /** Teinte du métal (tubes, cintres). */
    metal: THREE.Color
    opacity: number
}

function material(color: THREE.Color, opacity: number, extra: THREE.MeshStandardMaterialParameters = {}) {
    return new THREE.MeshStandardMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        ...extra,
    })
}

/** Tube entre deux points (cylindre orienté). */
function tube(from: THREE.Vector3, to: THREE.Vector3, mat: THREE.Material): THREE.Mesh {
    const length = from.distanceTo(to)
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(TUBE, TUBE, length, 10), mat)
    mesh.position.copy(from).add(to).multiplyScalar(0.5)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize())
    return mesh
}

/**
 * Groupe centré sur l'origine, au sol (y = 0). L'appelant le positionne et
 * le tourne comme n'importe quel volume du plan.
 */
export function buildPortant({ w, d, color, metal, opacity }: PortantSpec): THREE.Group {
    const group = new THREE.Group()
    const metalMat = material(metal, opacity, { metalness: 0.7, roughness: 0.35 })

    // Repère local : le long du portant = axe u, en travers = axe v.
    const alongX = w >= d
    const length = Math.max(w, d)
    const depth = Math.min(w, d)
    const at = (u: number, y: number, v: number) =>
        alongX ? new THREE.Vector3(u, y, v) : new THREE.Vector3(v, y, u)

    const half = length / 2 - TUBE
    const footHalf = Math.max(depth / 2, 0.2)

    // Montants, barre et pieds.
    for (const end of [-half, half]) {
        group.add(tube(at(end, 0.03, 0), at(end, PORTANT_HEIGHT, 0), metalMat))
        group.add(tube(at(end, 0.03, -footHalf), at(end, 0.03, footHalf), metalMat))
    }
    group.add(tube(at(-half, PORTANT_HEIGHT, 0), at(half, PORTANT_HEIGHT, 0), metalMat))

    // Vêtements : une rangée de pièces suspendues, teintes déclinées de la
    // couleur de la zone pour qu'on reconnaisse le rayon d'un coup d'œil.
    const usable = length - 0.2
    const count = Math.max(1, Math.min(MAX_GARMENTS, Math.floor(usable / GARMENT_STEP)))
    const spacing = usable / count
    const garmentWidth = Math.min(Math.max(depth * 0.85, 0.35), 0.55)
    const hsl = { h: 0, s: 0, l: 0 }
    color.getHSL(hsl)

    for (let i = 0; i < count; i++) {
        const u = -usable / 2 + spacing * (i + 0.5)
        // Longueur variable : robes, vestes, chemises ne tombent pas pareil.
        const drop = 0.55 + ((i * 37) % 7) * 0.045
        const shade = new THREE.Color().setHSL(
            hsl.h,
            hsl.s * (0.75 + ((i * 13) % 5) * 0.06),
            Math.min(0.85, Math.max(0.2, hsl.l + (((i * 7) % 5) - 2) * 0.06)),
        )
        const garment = new THREE.Mesh(
            alongX
                ? new THREE.BoxGeometry(0.035, drop, garmentWidth)
                : new THREE.BoxGeometry(garmentWidth, drop, 0.035),
            material(shade, opacity, { roughness: 0.9 }),
        )
        garment.position.copy(at(u, GARMENT_TOP - drop / 2, 0))
        group.add(garment)

        // Cintre : un crochet au-dessus de chaque pièce.
        group.add(tube(at(u, GARMENT_TOP, 0), at(u, PORTANT_HEIGHT, 0), metalMat))
    }

    return group
}
