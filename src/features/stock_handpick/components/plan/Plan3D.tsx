/**
 * Plan 3D de l'entrepôt — pendant de `PlanFloor`, mêmes données, même
 * sélection. Chargé en lazy depuis `PlanTab` : le chunk three ne pèse que si
 * l'utilisateur active la vue 3D.
 *
 * Le décor est construit une fois au montage (`buildWarehouse`) ; seules les
 * balles sont reconstruites quand les données changent, et seuls les volumes
 * de sélection changent d'apparence avec la sélection.
 *
 * Exception design system §12.4 : voir `scene/warehouseScene.ts`.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { Footprints } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import {
    shelfLevelKey,
    type PlanIndex,
    type PlanSelection,
} from "@/features/stock_handpick/utils/planLayout"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import type { FloorLayout } from "@/features/stock_handpick/utils/floorPlan"
import {
    LIGHTING,
    SCENE_CENTER,
    SITE,
    VIEWPOINTS,
    buildBales,
    buildWarehouse,
    disposeMaterialCache,
    disposeObject,
    type BaleCounts,
    type BayHit,
    type ViewpointId,
} from "./scene/warehouseScene"
import { createWalkMode, type WalkMode } from "./scene/walkMode"
import { WalkPad } from "./WalkPad"
import { usePlan3DFocus, type PlanCameraFlight } from "./usePlan3DFocus"
import { applyCutaway } from "./scene/cutaway"
import { paintHits } from "./scene/paintHits"
import type { PlanFocus } from "@/features/stock_handpick/utils/planFocus"

interface Plan3DProps {
    /** Disposition à dessiner : le décor est reconstruit quand elle change. */
    floor: FloorLayout
    index: PlanIndex
    ballesIn: (ids: readonly (string | undefined)[]) => BalleHandpick[]
    selection: PlanSelection | null
    onSelect: (selection: PlanSelection) => void
    /** Balle à faire briller (« Voir dans le plan 3D »), et son libellé. */
    focus?: PlanFocus | null
    focusLabel?: string
}

/** Déplacement maximal (px) entre appui et relâché pour compter un clic. */
const CLICK_TOLERANCE = 5
/** Durée du déplacement de caméra entre deux points de vue, en secondes. */
const FLY_DURATION = 0.9

export function Plan3D({
    floor, index, ballesIn, selection, onSelect, focus = null, focusLabel = "Balle",
}: Plan3DProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const sceneRef = useRef<THREE.Scene | null>(null)
    const balesRef = useRef<THREE.Group | null>(null)
    const hitsRef = useRef<THREE.Mesh[]>([])
    const hoveredRef = useRef<THREE.Mesh | null>(null)
    const selectionRef = useRef(selection)
    const onSelectRef = useRef(onSelect)
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
    const controlsRef = useRef<OrbitControls | null>(null)
    const flightRef = useRef<PlanCameraFlight | null>(null)
    const [viewpoint, setViewpoint] = useState<ViewpointId | null>("entrance")
    // Promenade en vue subjective : la caméra devient le visiteur.
    const walkRef = useRef<WalkMode | null>(null)
    const floorRef = useRef(floor)
    const [walking, setWalking] = useState(false)

    useEffect(() => {
        onSelectRef.current = onSelect
    }, [onSelect])

    // ── Scène statique : une seule fois ─────────────────────────────────────
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const scene = new THREE.Scene()
        scene.fog = new THREE.Fog(LIGHTING.fog, 70, 150)
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)
        camera.position.copy(VIEWPOINTS.entrance.camera)

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        container.appendChild(renderer.domElement)

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.target.copy(VIEWPOINTS.entrance.target)
        controls.enableDamping = true
        controls.maxPolarAngle = Math.PI / 2.1
        controls.minDistance = 6
        controls.maxDistance = 95
        // Commandes d'origine d'OrbitControls : molette / pincer pour zoomer,
        // clic gauche pour tourner, clic droit pour se déplacer. Toute prise
        // en main interrompt un changement de point de vue en cours.
        const stopFlight = () => {
            flightRef.current = null
        }
        controls.addEventListener("start", stopFlight)

        // Verrière : lumière zénithale diffuse, plus un soleil pour les ombres.
        scene.add(new THREE.HemisphereLight(LIGHTING.sky, LIGHTING.ground, 1.4))
        const sun = new THREE.DirectionalLight(LIGHTING.sun, 1.8)
        sun.position.set(SCENE_CENTER.x + 12, 34, SCENE_CENTER.z + 10)
        sun.target.position.copy(SCENE_CENTER)
        sun.castShadow = true
        sun.shadow.mapSize.set(2048, 2048)
        Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, far: 100 })
        scene.add(sun, sun.target)

        sceneRef.current = scene
        cameraRef.current = camera
        controlsRef.current = controls
        const walk = createWalkMode(scene, camera, controls, renderer.domElement)
        walkRef.current = walk

        const resize = () => {
            const { clientWidth: w, clientHeight: h } = container
            if (!w || !h) return
            camera.aspect = w / h
            camera.updateProjectionMatrix()
            renderer.setSize(w, h)
        }
        resize()
        const observer = new ResizeObserver(resize)
        observer.observe(container)

        // ── Survol et clic ──
        const raycaster = new THREE.Raycaster()
        const pointer = new THREE.Vector2()
        const pick = (event: PointerEvent): THREE.Mesh | null => {
            const rect = renderer.domElement.getBoundingClientRect()
            pointer.set(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1,
            )
            raycaster.setFromCamera(pointer, camera)
            const [hit] = raycaster.intersectObjects(hitsRef.current, false)
            return (hit?.object as THREE.Mesh | undefined) ?? null
        }

        const onMove = (event: PointerEvent) => {
            const target = pick(event)
            const bay = target?.userData.hit ? target : null
            if (bay !== hoveredRef.current) {
                hoveredRef.current = bay
                paintHits(hitsRef.current, selectionRef.current, bay)
            }
            renderer.domElement.style.cursor = target ? "pointer" : "grab"
        }

        let downAt: { x: number; y: number } | null = null
        const onDown = (event: PointerEvent) => {
            downAt = { x: event.clientX, y: event.clientY }
        }
        const onUp = (event: PointerEvent) => {
            if (!downAt) return
            const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y)
            downAt = null
            if (moved > CLICK_TOLERANCE) return
            const target = pick(event)
            if (!target) return
            const bay = target.userData.hit as BayHit | undefined
            if (bay) onSelectRef.current({ kind: "shelf", row: bay.row, shelf: bay.shelf })
            else if (target.userData.zone) {
                onSelectRef.current({ kind: "zone", zone: target.userData.zone })
            }
        }
        const canvas = renderer.domElement

        canvas.addEventListener("pointermove", onMove)
        canvas.addEventListener("pointerdown", onDown)
        canvas.addEventListener("pointerup", onUp)

        let frameId = 0
        let last = performance.now()
        const animate = () => {
            frameId = requestAnimationFrame(animate)
            const now = performance.now()
            walk.update((now - last) / 1000)
            last = now
            const flight = flightRef.current
            if (flight) {
                const p = Math.min(1, (performance.now() - flight.startedAt) / 1000 / FLY_DURATION)
                const eased = 1 - (1 - p) ** 3
                camera.position.lerpVectors(flight.fromCamera, flight.toCamera, eased)
                controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased)
                if (p >= 1) flightRef.current = null
            }
            // Suspendu pendant la promenade : update() recadrerait la caméra
            // sur la cible de l'orbite, même commandes désactivées.
            if (controls.enabled) controls.update()
            renderer.render(scene, camera)
        }
        animate()

        return () => {
            cancelAnimationFrame(frameId)
            observer.disconnect()
            controls.removeEventListener("start", stopFlight)
            canvas.removeEventListener("pointermove", onMove)
            canvas.removeEventListener("pointerdown", onDown)
            canvas.removeEventListener("pointerup", onUp)
            controls.dispose()
            disposeObject(scene)
            walk.dispose()
            walkRef.current = null
            disposeMaterialCache()
            renderer.dispose()
            container.removeChild(canvas)
            sceneRef.current = null
            cameraRef.current = null
            controlsRef.current = null
            flightRef.current = null
            balesRef.current = null
            hitsRef.current = []
        }
    }, [])

    // ── Promenade ───────────────────────────────────────────────────────────
    useEffect(() => {
        floorRef.current = floor
        walkRef.current?.setFloor(floor)
    }, [floor])

    const toggleWalk = () => {
        const walk = walkRef.current
        if (!walk) return
        if (walking) {
            walk.stop()
            setWalking(false)
            return
        }
        flightRef.current = null
        walk.start(floorRef.current)
        setViewpoint(null)
        setWalking(true)
    }

    // ── Points de vue des photos ────────────────────────────────────────────
    const goTo = (id: ViewpointId) => {
        if (walking) {
            walkRef.current?.stop()
            setWalking(false)
        }
        setViewpoint(id)
        const camera = cameraRef.current
        const controls = controlsRef.current
        if (!camera || !controls) return
        const view = VIEWPOINTS[id]
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            camera.position.copy(view.camera)
            controls.target.copy(view.target)
            return
        }
        flightRef.current = {
            fromCamera: camera.position.clone(),
            fromTarget: controls.target.clone(),
            toCamera: view.camera,
            toTarget: view.target,
            startedAt: performance.now(),
        }
    }

    // ── Décor : reconstruit quand la disposition change ─────────────────────
    // Déclaré avant les balles : au montage, les effets s'exécutent dans
    // l'ordre, et la scène existe déjà (effet précédent).
    useEffect(() => {
        const scene = sceneRef.current
        if (!scene) return
        const warehouse = buildWarehouse(floor)
        scene.add(warehouse.root)
        // Vue en coupe : avant chaque rendu, les murs du côté de la caméra
        // sont masqués (aucun en promenade, la caméra étant dedans).
        scene.onBeforeRender = (_renderer, _scene, camera) =>
            applyCutaway(warehouse.outerWalls, camera.position)
        hitsRef.current = [...warehouse.bayHits, ...warehouse.zoneHits]
        hoveredRef.current = null
        paintHits(hitsRef.current, selectionRef.current, null)
        return () => {
            scene.onBeforeRender = () => {}
            scene.remove(warehouse.root)
            disposeObject(warehouse.root)
            hitsRef.current = []
        }
    }, [floor])

    // ── Balles : reconstruites quand les comptes changent ───────────────────
    const counts = useMemo<BaleCounts>(
        () => ({
            at: (row, shelf, level) =>
                ballesIn([index.byPath.get(shelfLevelKey(row, shelf, level))]).length,
            zone: (zone) => ballesIn(index.byZone.get(zone) ?? []).length,
        }),
        [index, ballesIn],
    )

    useEffect(() => {
        const scene = sceneRef.current
        if (!scene) return
        const bales = buildBales(floor, counts)
        scene.add(bales)
        balesRef.current = bales
        return () => {
            scene.remove(bales)
            disposeObject(bales)
        }
    }, [floor, counts])

    // ── Balle ciblée : repère lumineux et caméra ─────────────────────────────
    usePlan3DFocus(sceneRef, cameraRef, controlsRef, flightRef, floor, focus, focusLabel)

    // ── Sélection ───────────────────────────────────────────────────────────
    useEffect(() => {
        selectionRef.current = selection
        paintHits(hitsRef.current, selection, hoveredRef.current)
    }, [selection])

    return (
        <div className="space-y-1">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Point de vue">
                {(Object.keys(VIEWPOINTS) as ViewpointId[]).map((id) => (
                    <Button
                        key={id}
                        size="sm"
                        variant={viewpoint === id ? "default" : "outline"}
                        aria-pressed={viewpoint === id}
                        onClick={() => goTo(id)}
                        className="h-7 text-xs"
                    >
                        {VIEWPOINTS[id].label}
                    </Button>
                ))}
                <Button
                    size="sm"
                    variant={walking ? "default" : "outline"}
                    aria-pressed={walking}
                    onClick={toggleWalk}
                    className="ml-auto h-7 gap-1.5 text-xs"
                >
                    <Footprints size={13} aria-hidden />
                    {walking ? "Arrêter la promenade" : "Se promener"}
                </Button>
            </div>
            <div className="relative">
                <div
                    ref={containerRef}
                    className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-muted/40"
                    role="img"
                    aria-label={`Plan 3D de l'entrepôt, ${SITE.width} × ${SITE.depth} m`}
                />
                {walking && <WalkPad onKey={(key, down) => walkRef.current?.setKey(key, down)} />}
            </div>
            <p className="text-center text-2xs text-muted-foreground">
                {walking
                    ? "ZQSD / WASD pour marcher · ← → pour tourner · Maj pour courir · glisser pour regarder autour de soi"
                    : "Glisser pour tourner · clic droit pour se déplacer · molette pour zoomer · cliquer une travée ou un sol pour voir ses balles"}
            </p>
        </div>
    )
}

export default Plan3D
