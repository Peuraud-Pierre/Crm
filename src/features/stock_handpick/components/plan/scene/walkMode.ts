import * as THREE from "three"
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { FloorLayout } from "@/features/stock_handpick/utils/floorPlan"
import { stepWalker, walkObstacles, walkStart, type Obstacle } from "@/features/stock_handpick/utils/walkCollision"

/**
 * Promenade en vue subjective (FPS) dans la vue 3D.
 *
 *  • ZQSD / WASD : avancer, reculer, pas de côté ; Maj : courir ;
 *  • flèches : ↑ ↓ avancer / reculer, ← → tourner ;
 *  • glisser (souris ou doigt) : regarder autour de soi.
 *
 * OrbitControls est suspendu pendant la promenade : la caméra EST le
 * visiteur. Les étiquettes flottantes sont masquées, elles gêneraient la vue
 * à hauteur d'homme.
 */

export type WalkKey = "forward" | "back" | "left" | "right" | "turnLeft" | "turnRight" | "run"

/** Touches physiques (`event.code`) : ZQSD sur AZERTY = WASD sur QWERTY. */
const KEY_CODES: Record<string, WalkKey> = {
    KeyW: "forward",
    ArrowUp: "forward",
    KeyS: "back",
    ArrowDown: "back",
    KeyA: "left",
    KeyD: "right",
    ArrowLeft: "turnLeft",
    ArrowRight: "turnRight",
    ShiftLeft: "run",
    ShiftRight: "run",
}

/** Visiteur de petite taille : yeux à 1,50 m, encombrement réduit. */
const EYE_HEIGHT = 1.5
const RADIUS = 0.22
const WALK_SPEED = 1.9
const RUN_SPEED = 4
const TURN_SPEED = 1.9
const LOOK_SENSITIVITY = 0.004
const MAX_PITCH = 1.2
const FPS_FOV = 70

export interface WalkMode {
    start: (floor: FloorLayout) => void
    stop: () => void
    setFloor: (floor: FloorLayout) => void
    setKey: (key: WalkKey, down: boolean) => void
    update: (dt: number) => void
    dispose: () => void
}

export function createWalkMode(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    canvas: HTMLCanvasElement,
): WalkMode {
    const keys = new Set<WalkKey>()
    let active = false
    let obstacles: Obstacle[] = []
    let outline: [number, number][] = []
    const position = { x: 0, z: 0 }
    let yaw = 0
    let pitch = 0
    let bob = 0
    const saved = { fov: camera.fov, near: camera.near }
    const hiddenSprites = new Set<THREE.Object3D>()

    // ── Clavier ──
    const isTyping = (target: EventTarget | null) =>
        target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable=true]"))
    const onKeyDown = (event: KeyboardEvent) => {
        const key = KEY_CODES[event.code]
        if (!key || isTyping(event.target)) return
        // Les flèches ne font pas défiler la page pendant la promenade.
        event.preventDefault()
        keys.add(key)
    }
    const onKeyUp = (event: KeyboardEvent) => {
        const key = KEY_CODES[event.code]
        if (key) keys.delete(key)
    }
    // Fenêtre qui perd le focus : on relâche tout, sinon le visiteur file.
    const onBlur = () => keys.clear()

    // ── Regard à la souris / au doigt ──
    let dragging: { x: number; y: number } | null = null
    const onPointerDown = (event: PointerEvent) => {
        dragging = { x: event.clientX, y: event.clientY }
    }
    const onPointerMove = (event: PointerEvent) => {
        if (!dragging) return
        yaw -= (event.clientX - dragging.x) * LOOK_SENSITIVITY
        pitch = THREE.MathUtils.clamp(pitch - (event.clientY - dragging.y) * LOOK_SENSITIVITY, -MAX_PITCH, MAX_PITCH)
        dragging = { x: event.clientX, y: event.clientY }
    }
    const onPointerUp = () => {
        dragging = null
    }

    const hideLabels = () => {
        scene.traverse((object) => {
            if (object instanceof THREE.Sprite && object.visible) {
                object.visible = false
                hiddenSprites.add(object)
            }
        })
    }
    const showLabels = () => {
        for (const sprite of hiddenSprites) sprite.visible = true
        hiddenSprites.clear()
    }

    const placeCamera = () => {
        camera.position.set(position.x, EYE_HEIGHT + Math.sin(bob) * 0.025, position.z)
        camera.rotation.set(pitch, yaw, 0, "YXZ")
    }

    const setFloor = (floor: FloorLayout) => {
        obstacles = walkObstacles(floor)
        outline = floor.outline
        // Le décor vient d'être reconstruit : ses nouvelles étiquettes aussi.
        if (active) hideLabels()
    }

    const start = (floor: FloorLayout) => {
        setFloor(floor)
        Object.assign(position, walkStart(floor, RADIUS))
        yaw = 0 // regard vers le fond (−z)
        pitch = -0.05
        controls.enabled = false
        camera.fov = FPS_FOV
        camera.near = 0.05
        camera.updateProjectionMatrix()
        hideLabels()
        placeCamera()
        window.addEventListener("keydown", onKeyDown)
        window.addEventListener("keyup", onKeyUp)
        window.addEventListener("blur", onBlur)
        canvas.addEventListener("pointerdown", onPointerDown)
        window.addEventListener("pointermove", onPointerMove)
        window.addEventListener("pointerup", onPointerUp)
        active = true
    }

    const stop = () => {
        if (!active) return
        active = false
        keys.clear()
        dragging = null
        window.removeEventListener("keydown", onKeyDown)
        window.removeEventListener("keyup", onKeyUp)
        window.removeEventListener("blur", onBlur)
        canvas.removeEventListener("pointerdown", onPointerDown)
        window.removeEventListener("pointermove", onPointerMove)
        window.removeEventListener("pointerup", onPointerUp)
        showLabels()
        camera.fov = saved.fov
        camera.near = saved.near
        camera.updateProjectionMatrix()
        // L'orbite reprend autour d'un point devant le visiteur : la vue ne
        // saute pas au moment de quitter.
        const ahead = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).multiplyScalar(6)
        controls.target.set(position.x + ahead.x, 0.5, position.z + ahead.z)
        camera.position.y = Math.max(camera.position.y, 3)
        controls.enabled = true
    }

    const update = (dt: number) => {
        if (!active) return
        const step = Math.min(dt, 0.1)
        const turn = (keys.has("turnLeft") ? 1 : 0) - (keys.has("turnRight") ? 1 : 0)
        yaw += turn * TURN_SPEED * step

        const ahead = (keys.has("forward") ? 1 : 0) - (keys.has("back") ? 1 : 0)
        const side = (keys.has("right") ? 1 : 0) - (keys.has("left") ? 1 : 0)
        if (ahead !== 0 || side !== 0) {
            // Avant = −z tourné de `yaw` ; droite = +x tourné de `yaw`.
            const fx = -Math.sin(yaw)
            const fz = -Math.cos(yaw)
            const rx = Math.cos(yaw)
            const rz = -Math.sin(yaw)
            let mx = fx * ahead + rx * side
            let mz = fz * ahead + rz * side
            const length = Math.hypot(mx, mz)
            mx /= length
            mz /= length
            const distance = (keys.has("run") ? RUN_SPEED : WALK_SPEED) * step
            const next = stepWalker(position, mx * distance, mz * distance, RADIUS, obstacles, outline)
            const moved = Math.hypot(next.x - position.x, next.z - position.z)
            Object.assign(position, next)
            bob += moved * 7
        }
        placeCamera()
    }

    return {
        start,
        stop,
        setFloor,
        setKey: (key, down) => {
            if (down) keys.add(key)
            else keys.delete(key)
        },
        update,
        dispose: stop,
    }
}
