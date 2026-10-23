import type * as THREE from "three"

/**
 * Vue en coupe de la caméra libre : les murs extérieurs situés du côté de la
 * caméra sont masqués, pour voir l'intérieur ; ceux du fond restent. En
 * promenade la caméra est dans le bâtiment : aucun mur n'est « de son côté »,
 * tous restent visibles.
 */

export interface CutawayMeta {
    /** Milieu du segment de mur. */
    mx: number
    mz: number
    /** Normale sortante (vers l'extérieur du bâtiment), unitaire. */
    nx: number
    nz: number
}

/**
 * Mur de coupe pour chaque segment du contour (segment i : point i → i+1).
 * La normale sortante suit le sens de tracé du polygone (aire signée) :
 * juste aussi pour un contour concave, en L par exemple.
 */
export function outlineCutaway(points: readonly (readonly [number, number])[]): CutawayMeta[] {
    let area2 = 0
    points.forEach((a, i) => {
        const b = points[(i + 1) % points.length]
        area2 += a[0] * b[1] - b[0] * a[1]
    })
    // Aire positive : le polygone tourne de x vers z ; la normale sortante
    // est alors (dz, -dx). Sinon, son opposée.
    const sign = area2 >= 0 ? 1 : -1
    return points.map((a, i) => {
        const b = points[(i + 1) % points.length]
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
        return {
            mx: (a[0] + b[0]) / 2,
            mz: (a[1] + b[1]) / 2,
            nx: (sign * (b[1] - a[1])) / len,
            nz: (-sign * (b[0] - a[0])) / len,
        }
    })
}

/** Vrai si la caméra est dehors, du côté vers lequel le mur regarde. */
export function facesCamera(meta: CutawayMeta, camX: number, camZ: number): boolean {
    return meta.nx * (camX - meta.mx) + meta.nz * (camZ - meta.mz) > 0
}

/** Masque ou réaffiche chaque mur selon la position de la caméra. */
export function applyCutaway(walls: readonly THREE.Object3D[], camera: THREE.Vector3) {
    for (const wall of walls) {
        const meta = wall.userData.cutaway as CutawayMeta | undefined
        if (meta) wall.visible = !facesCamera(meta, camera.x, camera.z)
    }
}
