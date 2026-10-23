import { useEffect, type RefObject } from "react"
import * as THREE from "three"
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { FloorLayout } from "@/features/stock_handpick/utils/floorPlan"
import type { PlanFocus } from "@/features/stock_handpick/utils/planFocus"
import { buildFocusMarker } from "./scene/focusMarker"
import { focusPosition } from "./scene/warehouseScene"
import { disposeObject } from "./scene/sceneParts"

/** Recul de la caméra par rapport au repère : de biais et en hauteur. */
const CAMERA_OFFSET = new THREE.Vector3(5, 6, 8)

export interface PlanCameraFlight {
    fromCamera: THREE.Vector3
    fromTarget: THREE.Vector3
    toCamera: THREE.Vector3
    toTarget: THREE.Vector3
    startedAt: number
}

/**
 * « Voir dans le plan 3D » : pose le repère lumineux sur la balle ciblée et
 * y amène la caméra. Le repère est retiré quand la cible change ou disparaît.
 * Local à `Plan3D` : il manipule directement sa scène three.js.
 */
export function usePlan3DFocus(
    sceneRef: RefObject<THREE.Scene | null>,
    cameraRef: RefObject<THREE.PerspectiveCamera | null>,
    controlsRef: RefObject<OrbitControls | null>,
    flightRef: RefObject<PlanCameraFlight | null>,
    floor: FloorLayout,
    focus: PlanFocus | null,
    label: string,
) {
    useEffect(() => {
        const scene = sceneRef.current
        if (!scene || !focus) return
        const position = focusPosition(floor, focus)
        if (!position) return

        const marker = buildFocusMarker(position, label)
        scene.add(marker)

        const camera = cameraRef.current
        const controls = controlsRef.current
        if (camera && controls) {
            const toCamera = position.clone().add(CAMERA_OFFSET)
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                camera.position.copy(toCamera)
                controls.target.copy(position)
            } else {
                flightRef.current = {
                    fromCamera: camera.position.clone(),
                    fromTarget: controls.target.clone(),
                    toCamera,
                    toTarget: position,
                    startedAt: performance.now(),
                }
            }
        }

        return () => {
            scene.remove(marker)
            disposeObject(marker)
        }
    }, [sceneRef, cameraRef, controlsRef, flightRef, floor, focus, label])
}
