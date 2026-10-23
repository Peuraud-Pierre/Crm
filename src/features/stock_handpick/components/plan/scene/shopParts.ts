/**
 * Mobilier 3D de la boutique (zone D), d'après les photos du site : portants
 * muraux surmontés d'une étagère bois chargée d'objets, îlots à plateau bois,
 * tables de t-shirts, piles de sacs verts sur palette, bac grillagé, desserte
 * roulante, poubelles transparentes, mannequin et avion suspendu.
 *
 * Exception design system §12.4 (« couleurs d'assets non tokenisables ») pour
 * tout le fichier : voir `warehouseScene.ts`.
 */
/* eslint-disable nokk-project/no-restricted-syntax */
import * as THREE from "three"
import { C, bagPile, box, clothingRail, foldTable, mat, mulberry32, palletMesh } from "./sceneParts"

const SHOP = {
    sofa: "#2f5d4a",
    sofaDark: "#244a3b",
    tableWood: "#9a6a42",
    basket: "#b08a55",
    crate: "#8a5a36",
    globeSea: "#2f6fb3",
    globeLand: "#d9c38a",
    wire: "#9ca3af",
    clear: "#e5e7eb",
    skin: "#e0b48a",
    planeRed: "#d7261e",
    planeWhite: "#f5f5f4",
}

/** Petits objets posés sur les plateaux : paniers, caisses, globes. */
function props(length: number, y: number, seed: number): THREE.Group {
    const group = new THREE.Group()
    const rand = mulberry32(seed)
    const count = Math.max(1, Math.floor(length / 0.9))
    for (let i = 0; i < count; i++) {
        const x = -length / 2 + 0.45 + i * (length / count)
        const pick = rand()
        if (pick < 0.35) {
            const basket = new THREE.Mesh(
                new THREE.CylinderGeometry(0.2, 0.15, 0.22, 14),
                mat(SHOP.basket, { roughness: 0.95 }),
            )
            basket.position.set(x, y + 0.11, 0)
            basket.castShadow = true
            group.add(basket)
        } else if (pick < 0.7) {
            group.add(box(0.35, 0.25, 0.28, mat(SHOP.crate), x, y + 0.125, 0))
        } else {
            const globe = new THREE.Mesh(
                new THREE.SphereGeometry(0.14, 16, 12),
                mat(SHOP.globeSea, { roughness: 0.4 }),
            )
            globe.position.set(x, y + 0.3, 0)
            const stand = box(0.03, 0.16, 0.03, mat(SHOP.globeLand), x, y + 0.08, 0)
            group.add(globe, stand)
        }
    }
    return group
}

/**
 * Portant mural : barre de vêtements sous une étagère bois qui porte des
 * objets de déco. `length` court selon l'axe x local.
 */
export function wallDisplay(length: number, seed: number): THREE.Group {
    const group = new THREE.Group()
    group.add(clothingRail(length, seed))
    const shelfY = 1.85
    group.add(box(length, 0.05, 0.55, mat(C.wood), 0, shelfY, 0))
    for (const x of [-length / 2, length / 2]) {
        group.add(box(0.05, 0.4, 0.05, mat(C.rail), x, shelfY - 0.2, 0))
    }
    group.add(props(length, shelfY + 0.03, seed + 7))
    return group
}

/** Îlot : deux portants dos à dos sous un plateau bois garni d'objets. */
export function shopIsland(length: number, seed: number): THREE.Group {
    const group = new THREE.Group()
    const front = clothingRail(length, seed)
    front.position.z = -0.3
    const back = clothingRail(length, seed + 1)
    back.position.z = 0.3
    const topY = 1.62
    group.add(front, back, box(length + 0.2, 0.05, 0.9, mat(C.wood), 0, topY, 0))
    group.add(props(length, topY + 0.03, seed + 3))
    return group
}

/** Table basse de t-shirts pliés, pieds en fer. */
export function shopTable(seed: number): THREE.Group {
    return foldTable(seed)
}

/** Pile de gros sacs verts sur palette, comme au pied des colonnes. */
export function bagStack(seed: number): THREE.Group {
    const group = new THREE.Group()
    group.add(palletMesh(0, 0, 1.2, 1.0))
    // Deux sacs par couche, comme sur la photo.
    const pile = bagPile(6, 1.2, 1.4, 3, seed)
    pile.position.y = 0.14
    // Que du vert : ce sont les sacs de la photo.
    pile.traverse((child) => {
        if (child instanceof THREE.Mesh) child.material = mat(C.bagGreen, { roughness: 0.55 })
    })
    group.add(pile)
    return group
}

/** Bac grillagé à roulettes rempli de fripes en vrac. */
export function wireBin(seed: number): THREE.Group {
    const group = new THREE.Group()
    const wire = mat(SHOP.wire, { wireframe: true, metalness: 0.6 })
    group.add(box(1.1, 0.7, 0.8, wire, 0, 0.5, 0))
    const rand = mulberry32(seed)
    for (let i = 0; i < 14; i++) {
        const cloth = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 8, 6),
            mat(["#b91c1c", "#1e3a8a", "#f5f5f4", "#ca8a04", "#db2777", "#65a30d"][i % 6], { roughness: 1 }),
        )
        cloth.scale.set(1.3, 0.5, 1)
        cloth.position.set((rand() - 0.5) * 0.9, 0.75 + rand() * 0.12, (rand() - 0.5) * 0.6)
        group.add(cloth)
    }
    for (const [x, z] of [[-0.5, -0.35], [0.5, -0.35], [-0.5, 0.35], [0.5, 0.35]]) {
        group.add(box(0.06, 0.15, 0.06, mat(C.rail), x, 0.08, z))
    }
    return group
}

/** Desserte roulante pliante en inox. */
export function trolley(): THREE.Group {
    const group = new THREE.Group()
    const steel = mat(SHOP.wire, { metalness: 0.8, roughness: 0.3 })
    group.add(box(1.1, 0.04, 0.6, steel, 0, 0.85, 0))
    for (const side of [-1, 1]) {
        const leg = box(0.03, 1.0, 0.03, steel, 0, 0.45, side * 0.25)
        leg.rotation.z = 0.7
        const leg2 = box(0.03, 1.0, 0.03, steel, 0, 0.45, side * 0.25)
        leg2.rotation.z = -0.7
        group.add(leg, leg2)
    }
    return group
}

/** Poubelle transparente sur pied. */
export function clearBin(): THREE.Mesh {
    return box(0.45, 0.8, 0.45, mat(SHOP.clear, { transparent: true, opacity: 0.45, roughness: 0.1 }), 0, 0.4, 0)
}

/** Mannequin stylisé (le personnage de la photo). */
export function mannequin(): THREE.Group {
    const group = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.9, 4, 12), mat(C.rackBlue))
    body.position.y = 0.75
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), mat(SHOP.skin))
    head.position.y = 1.55
    const hat = box(0.34, 0.05, 0.34, mat(C.rail), 0, 1.7, 0)
    body.castShadow = true
    group.add(body, head, hat)
    return group
}

/** Avion rouge et blanc suspendu au plafond, signature de la boutique. */
export function hangingPlane(): THREE.Group {
    const group = new THREE.Group()
    const red = mat(SHOP.planeRed, { roughness: 0.4 })
    const white = mat(SHOP.planeWhite, { roughness: 0.4 })
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.12, 3.2, 16), red)
    fuselage.rotation.z = Math.PI / 2
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), white)
    nose.position.x = 1.6
    group.add(fuselage, nose)
    // Ailes rayées : alternance rouge / blanc.
    for (let i = 0; i < 6; i++) {
        const z = -2.25 + i * 0.9
        group.add(box(0.7, 0.05, 0.9, i % 2 === 0 ? red : white, 0.4, 0.1, z))
    }
    group.add(box(0.5, 0.05, 1.4, white, -1.4, 0.05, 0))
    group.add(box(0.45, 0.6, 0.05, red, -1.45, 0.35, 0))
    const propeller = box(0.04, 0.9, 0.1, mat(C.rail), 1.9, 0, 0)
    group.add(propeller)
    // Filins.
    for (const x of [-1, 1]) {
        group.add(box(0.01, 1.0, 0.01, mat(C.rail), x * 0.8, 0.8, 0))
    }
    group.rotation.y = 0.5
    return group
}

/**
 * Lave-linge à hublot, porte tournée vers l'allée (−z, vers le haut du plan).
 * Utilisé dans la réserve, pas dans la boutique, mais il appartient au même
 * petit mobilier.
 */
export function washingMachine(w: number, d: number): THREE.Group {
    const group = new THREE.Group()
    const h = 0.85
    group.add(box(w, h, d, mat(SHOP.clear, { roughness: 0.35 }), 0, h / 2, 0))
    // Bandeau de commande.
    group.add(box(w - 0.04, 0.12, 0.02, mat(C.brace, { metalness: 0.4 }), 0, h - 0.08, -d / 2 - 0.01))
    // Hublot : couronne chromée et vitre sombre.
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(w * 0.28, 0.035, 10, 28),
        mat(C.brace, { metalness: 0.8, roughness: 0.2 }),
    )
    ring.position.set(0, h * 0.45, -d / 2 - 0.02)
    const glass = new THREE.Mesh(
        new THREE.CircleGeometry(w * 0.27, 28),
        mat(C.rail, { roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 }),
    )
    glass.position.set(0, h * 0.45, -d / 2 - 0.015)
    glass.rotation.y = Math.PI
    group.add(ring, glass)
    return group
}

/**
 * Canapé chesterfield vert, comme celui de la boutique : assise, dossier du
 * côté −z, accoudoirs, coussins. Construit aux dimensions du plan (`w` sur x,
 * `d` sur z).
 */
export function sofa(w: number, d: number): THREE.Group {
    const group = new THREE.Group()
    const leather = mat(SHOP.sofa, { roughness: 0.45 })
    const dark = mat(SHOP.sofaDark, { roughness: 0.5 })
    const arm = Math.min(0.22, w * 0.12)
    group.add(box(w, 0.42, d, leather, 0, 0.21, 0))
    group.add(box(w, 0.45, 0.22, leather, 0, 0.62, -d / 2 + 0.11))
    for (const side of [-1, 1]) {
        group.add(box(arm, 0.3, d, leather, side * (w / 2 - arm / 2), 0.57, 0))
    }
    const seats = Math.max(1, Math.round((w - arm * 2) / 0.7))
    const seatW = (w - arm * 2) / seats
    for (let i = 0; i < seats; i++) {
        group.add(box(seatW - 0.04, 0.12, d - 0.3, dark, -w / 2 + arm + seatW * (i + 0.5), 0.48, 0.05))
    }
    for (const [x, z] of [[-w / 2 + 0.08, -d / 2 + 0.08], [w / 2 - 0.08, -d / 2 + 0.08], [-w / 2 + 0.08, d / 2 - 0.08], [w / 2 - 0.08, d / 2 - 0.08]]) {
        group.add(box(0.06, 0.08, 0.06, mat(C.rail), x, 0.04, z))
    }
    return group
}

/** Table en bois sur quatre pieds, aux dimensions du plan. */
export function woodTable(w: number, d: number): THREE.Group {
    const group = new THREE.Group()
    const wood = mat(SHOP.tableWood, { roughness: 0.7 })
    group.add(box(w, 0.05, d, wood, 0, 0.75, 0))
    const inset = 0.08
    for (const x of [-w / 2 + inset, w / 2 - inset]) {
        for (const z of [-d / 2 + inset, d / 2 - inset]) {
            group.add(box(0.06, 0.73, 0.06, wood, x, 0.365, z))
        }
    }
    return group
}
