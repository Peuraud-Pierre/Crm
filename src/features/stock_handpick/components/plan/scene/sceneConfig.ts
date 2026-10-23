/**
 * Réglages de la scène 3D : points de vue des photos, centre de la scène,
 * couleurs de sélection et ambiance lumineuse.
 *
 * Exception design system §12.4 (« couleurs d'assets non tokenisables ») :
 * voir `warehouseScene.ts`.
 */
/* eslint-disable nokk-project/no-restricted-syntax */
import * as THREE from "three"
import { C } from "./sceneParts"
import { DEFAULT_FLOOR, FLOOR_VIEWS } from "@/features/stock_handpick/utils/floorPlan"

export type ViewpointId = keyof typeof FLOOR_VIEWS

/** Points de vue des photos ; la vue d'ouverture est celle de l'entrée. */
export const VIEWPOINTS = Object.fromEntries(
    (Object.keys(FLOOR_VIEWS) as ViewpointId[]).map((id) => [
        id,
        {
            label: FLOOR_VIEWS[id].label,
            camera: new THREE.Vector3(...FLOOR_VIEWS[id].camera),
            target: new THREE.Vector3(...FLOOR_VIEWS[id].target),
        },
    ]),
) as Record<ViewpointId, { label: string; camera: THREE.Vector3; target: THREE.Vector3 }>

/** Centre de la scène : cible du soleil et de ses ombres. */
export const SCENE_CENTER = new THREE.Vector3(DEFAULT_FLOOR.width / 2, 0, DEFAULT_FLOOR.depth / 2)
export const HIGHLIGHT_COLORS = { hover: C.highlight, selected: C.selected }

/** Ambiance : brume de fond, verrière (ciel / sol) et soleil. */
export const LIGHTING = { fog: "#e9ecef", sky: "#ffffff", ground: "#9ca3af", sun: "#ffffff" }
