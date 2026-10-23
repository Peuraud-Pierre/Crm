/**
 * Plan 3D du magasin — mêmes données et même sélection que `PlanSvg`. Chargé
 * en lazy depuis `PlanTab` : le chunk three ne pèse que si la vue 3D s'ouvre.
 *
 * Chaque élément placé devient un volume : la zone est un aplat au sol, un
 * rayon un meuble, un portant un vrai portant à vêtements (`scene/portant.ts`)
 * et un emplacement un bloc posé sur son meuble — sur un portant, la section
 * de vêtements qu'il désigne. Caisses et portes ont leur modèle
 * (`scene/equipements.ts`), dans la couleur de leur rôle. Les couleurs
 * viennent des tokens du thème (`--chart-N`, `--muted`…) lus à l'exécution :
 * three n'accepte pas de classes, et aucune couleur n'est codée en dur.
 */
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { Mur, PlanItem, Point } from "@/features/magasins/types/magasin.types"
import { murKey } from "@/features/magasins/utils/wall"
import { stairLevels } from "@/features/magasins/utils/stairs"
import { buildWall, extrudedShape } from "./scene/walls"
import { CHART_COLOR_COUNT, EQUIPEMENT_COLOR_VAR, isEquipementKind, STAIRS_DOWN_COLOR_VAR } from "@/features/magasins/theme"
import { HEIGHT_3D, rectOf, type Bounds } from "@/features/magasins/utils/planGeometry"
import { effectiveContour } from "@/features/magasins/utils/contour"
import { buildPortant, GARMENT_BOTTOM, GARMENT_TOP } from "./scene/portant"
import { selectionKeys } from "@/features/magasins/utils/group"
import { buildCaisse, buildColimacon, buildEscalier, buildPorte } from "./scene/equipements"
import { buildMannequin } from "./scene/mannequin"
import { buildFloor, buildPitWalls, DESCENT_DEPTH, descentHoles, maskedByHoles } from "./scene/floor"

interface Plan3DProps {
    bounds: Bounds
    /** Contour de l'étage ; `null` = le rectangle du magasin. */
    contour?: readonly Point[] | null
    items: readonly PlanItem[]
    /** Murs de l'étage : un volume par segment, sélectionnable (`m:<id>`). */
    walls?: readonly Mur[]
    selectedKey: string | null
    onSelect: (key: string | null) => void
}

/** `--chart-1: 131 65% 32%` → `hsl(131, 65%, 32%)`, que three sait lire. */
function cssColor(variable: string, fallback = "grey"): THREE.Color {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
    const parts = raw.split(/\s+/)
    const color = new THREE.Color(fallback)
    if (parts.length >= 3) color.setStyle(`hsl(${parts[0]}, ${parts[1]}, ${parts[2]})`)
    return color
}

function itemColor(item: PlanItem): THREE.Color {
    if (item.descend) return cssColor(STAIRS_DOWN_COLOR_VAR)
    if (isEquipementKind(item.kind)) return cssColor(EQUIPEMENT_COLOR_VAR[item.kind])
    if (item.color) return new THREE.Color(item.color)
    return cssColor(`--chart-${(item.colorIndex % CHART_COLOR_COUNT) + 1}`)
}

interface Volume {
    key: string
    kind: PlanItem["kind"]
    x: number
    z: number
    w: number
    d: number
    base: number
    height: number
    rotation: number
    /** Escalier qui descend : une trémie et son garde-corps. */
    descend: boolean
    color: THREE.Color
    opacity: number
    /** Forme libre relative au rectangle (zones), extrudée à sa hauteur. */
    forme: readonly Point[] | null
}

/** Volumes à dessiner, dans le repère three centré sur le magasin. */
function volumesOf(items: readonly PlanItem[], bounds: Bounds): Volume[] {
    const byKey = new Map(items.map((i) => [i.key, i]))
    // Escaliers fusionnés : chaque volée repart de l'arrivée de la précédente.
    const levels = stairLevels(items, HEIGHT_3D.escalier)
    return items.flatMap((item) => {
        const rect = rectOf(item.geometry)
        if (!rect) return []
        let base = 0
        let height = HEIGHT_3D[item.kind]
        let opacity = item.is_active ? 1 : 0.35
        if (item.kind === "emplacement") {
            const parent = item.parentKey ? byKey.get(item.parentKey) : undefined
            const parentPlaced = Boolean(parent && rectOf(parent.geometry))
            if (parent?.kind === "etagere" && parentPlaced) {
                // Sur un portant : la bande des vêtements qu'il désigne, en
                // voile pour laisser voir les pièces suspendues.
                base = GARMENT_BOTTOM
                height = GARMENT_TOP - GARMENT_BOTTOM
                opacity = Math.min(opacity, 0.35)
            } else if (parent?.kind === "rayon" && parentPlaced) {
                // Sur un rayon : un bloc posé dessus.
                base = HEIGHT_3D.rayon
                height = 0.25
            }
        }
        if (item.kind === "rayon" || item.kind === "etagere") base = 0.02
        const level = levels.get(item.key)
        if (level) {
            base = level.start
            height = level.height
        }
        if (item.descend) {
            // Qui descend : une descente simulée, peu profonde, dans la trémie.
            const scale = DESCENT_DEPTH / HEIGHT_3D[item.kind]
            base *= scale
            height *= scale
        }
        return [{
            key: item.key,
            kind: item.kind,
            x: rect.x + rect.w / 2 - bounds.width / 2,
            z: rect.y + rect.h / 2 - bounds.depth / 2,
            w: rect.w,
            d: rect.h,
            base,
            height,
            rotation: item.geometry.rotation,
            descend: item.descend,
            color: itemColor(item),
            opacity,
            forme: item.forme,
        }]
    })
}

/** Libère géométries et matériaux d'un objet et de ses enfants. */
function disposeTree(object: THREE.Object3D) {
    object.traverse((child) => {
        const mesh = child as THREE.Mesh
        mesh.geometry?.dispose()
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(material)) material.forEach((m) => m.dispose())
        else material?.dispose()
    })
}

export default function Plan3D({ bounds, contour = null, items, walls = [], selectedKey, onSelect }: Plan3DProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const sceneRef = useRef<{
        scene: THREE.Scene
        group: THREE.Group
        objects: Map<string, THREE.Object3D>
        render: () => void
    } | null>(null)
    const onSelectRef = useRef(onSelect)
    useEffect(() => {
        onSelectRef.current = onSelect
    }, [onSelect])

    const volumes = useMemo(() => volumesOf(items, bounds), [items, bounds])
    // Le décor lit le contour par une ref et se reconstruit sur sa clé :
    // un tableau recréé à chaque rendu ne relance pas toute la scène.
    const contourRef = useRef(contour)
    contourRef.current = contour
    const contourKey = contour ? JSON.stringify(contour) : ""

    // Scène, caméra, contrôles : une fois par emprise de magasin.
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const scene = new THREE.Scene()
        scene.background = cssColor("--background", "white")

        const span = Math.max(bounds.width, bounds.depth)
        const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, span * 20)
        camera.position.set(0, span * 0.9, span * 0.9)

        // Stencil : les trémies y marquent l'écran pour percer le sol (scene/floor.ts).
        const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        container.appendChild(renderer.domElement)

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.target.set(0, 0, 0)
        controls.maxPolarAngle = Math.PI / 2.05
        controls.enableDamping = true

        scene.add(new THREE.AmbientLight(0xffffff, 1.6))
        const sun = new THREE.DirectionalLight(0xffffff, 1.4)
        sun.position.set(span, span * 2, span * 0.5)
        scene.add(sun)

        // Contour de l'étage, dans le repère de la scène (y du plan → −y).
        const outlinePoints = effectiveContour(contourRef.current, bounds).map(
            ([x, y]) => new THREE.Vector2(x - bounds.width / 2, -(y - bounds.depth / 2)),
        )
        const grid = new THREE.GridHelper(span, Math.round(span), cssColor("--border"), cssColor("--border"))
        // La grille s'interrompt elle aussi au-dessus des trémies.
        maskedByHoles(grid.material as THREE.Material)
        grid.position.y = 0.005
        scene.add(grid)
        // Murs esquissés : le contour au sol et à 60 cm, reliés aux angles.
        const wall = new THREE.LineBasicMaterial({ color: cssColor("--foreground", "black") })
        const at = (p: THREE.Vector2, h: number) => new THREE.Vector3(p.x, h, -p.y)
        for (const h of [0.01, 0.6]) {
            scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(outlinePoints.map((p) => at(p, h))), wall))
        }
        scene.add(
            new THREE.LineSegments(
                new THREE.BufferGeometry().setFromPoints(outlinePoints.flatMap((p) => [at(p, 0.01), at(p, 0.6)])),
                wall,
            ),
        )

        const group = new THREE.Group()
        scene.add(group)

        const render = () => renderer.render(scene, camera)
        const resize = () => {
            const width = container.clientWidth
            // Même hauteur maximale que le plan 2D (30rem) : elle suit le zoom du navigateur.
            const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
            const height = Math.min(Math.round((width * 9) / 16), 30 * rem)
            renderer.setSize(width, height)
            camera.aspect = width / height
            camera.updateProjectionMatrix()
            render()
        }
        const observer = new ResizeObserver(resize)
        observer.observe(container)
        resize()

        let frame = 0
        const loop = () => {
            controls.update()
            render()
            frame = requestAnimationFrame(loop)
        }
        loop()

        // Clic (sans glisser) : sélection par lancer de rayon.
        const raycaster = new THREE.Raycaster()
        let down: { x: number; y: number } | null = null
        const onDown = (e: PointerEvent) => {
            down = { x: e.clientX, y: e.clientY }
        }
        const onUp = (e: PointerEvent) => {
            if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return
            const box = renderer.domElement.getBoundingClientRect()
            const pointer = new THREE.Vector2(
                ((e.clientX - box.left) / box.width) * 2 - 1,
                -((e.clientY - box.top) / box.height) * 2 + 1,
            )
            raycaster.setFromCamera(pointer, camera)
            // Un portant est un groupe de pièces : on remonte jusqu'à l'objet
            // qui porte la clé de l'élément.
            let target: THREE.Object3D | null = raycaster.intersectObjects(group.children, true)[0]?.object ?? null
            while (target && target.userData.key === undefined) target = target.parent
            onSelectRef.current((target?.userData.key as string | undefined) ?? null)
        }
        renderer.domElement.addEventListener("pointerdown", onDown)
        renderer.domElement.addEventListener("pointerup", onUp)

        sceneRef.current = { scene, group, objects: new Map(), render }

        return () => {
            cancelAnimationFrame(frame)
            observer.disconnect()
            renderer.domElement.removeEventListener("pointerdown", onDown)
            renderer.domElement.removeEventListener("pointerup", onUp)
            controls.dispose()
            disposeTree(scene)
            renderer.dispose()
            renderer.domElement.remove()
            sceneRef.current = null
        }
        // Le contour fait partie du décor : un nouveau contour reconstruit la scène.
    }, [bounds, contourKey])

    // Sol, percé là où un escalier descend : reconstruit quand les trémies changent.
    const holes = useMemo(() => descentHoles(items), [items])
    const holesKey = JSON.stringify(holes)
    useEffect(() => {
        const ctx = sceneRef.current
        if (!ctx) return
        const material = new THREE.MeshStandardMaterial({ color: cssColor("--muted", "lightgrey"), side: THREE.DoubleSide })
        const floor = buildFloor(effectiveContour(contourRef.current, bounds), holes, bounds, material)
        // Parois sombres sous les bords des trémies : on y voit un trou, pas le vide.
        const pit = new THREE.MeshStandardMaterial({ color: cssColor("--foreground", "black"), side: THREE.DoubleSide })
        const walls = buildPitWalls(holes, bounds, pit)
        ctx.scene.add(floor, walls)
        return () => {
            ctx.scene.remove(floor, walls)
            disposeTree(floor)
            disposeTree(walls)
        }
        // `holes` suit `holesKey` ; le contour, `contourKey`.
    }, [bounds, contourKey, holesKey])

    // Volumes : reconstruits quand les éléments changent.
    useEffect(() => {
        const ctx = sceneRef.current
        if (!ctx) return
        for (const object of ctx.objects.values()) {
            ctx.group.remove(object)
            disposeTree(object)
        }
        ctx.objects.clear()
        const metal = cssColor("--muted-foreground")
        for (const v of volumes) {
            let object: THREE.Object3D
            const spec = { w: v.w, d: v.d, color: v.color, opacity: v.opacity }
            if (v.forme) {
                // Forme libre (zone ou équipement) : son tracé, extrudé à sa hauteur.
                const material = new THREE.MeshStandardMaterial({
                    color: v.color,
                    transparent: v.opacity < 1,
                    opacity: v.opacity,
                    depthWrite: v.opacity >= 1,
                })
                object = extrudedShape(v.forme, v.w, v.d, v.height, material)
                object.position.set(v.x, v.base, v.z)
            } else if (v.descend && v.kind === "escalier_colimacon") {
                // Vers l'étage du dessous : le colimaçon arrive au ras du sol.
                object = buildColimacon({ ...spec, neutral: metal }, v.height)
                object.position.set(v.x, v.base - v.height, v.z)
            } else if (v.descend) {
                object = buildEscalier({ ...spec, neutral: metal }, v.height, v.base, true)
                object.position.set(v.x, 0, v.z)
            } else if (v.kind === "etagere") {
                object = buildPortant({ ...spec, metal })
                object.position.set(v.x, 0, v.z)
            } else if (v.kind === "escalier_colimacon") {
                object = buildColimacon({ ...spec, neutral: metal }, v.height)
                object.position.set(v.x, v.base, v.z)
            } else if (v.kind === "escalier") {
                object = buildEscalier({ ...spec, neutral: metal }, v.height, v.base)
                object.position.set(v.x, 0, v.z)
            } else if (v.kind === "mannequin") {
                object = buildMannequin({ ...spec, neutral: metal })
                object.position.set(v.x, 0, v.z)
            } else if (v.kind === "caisse") {
                object = buildCaisse({ ...spec, neutral: metal })
                object.position.set(v.x, 0, v.z)
            } else if (isEquipementKind(v.kind)) {
                object = buildPorte({ ...spec, neutral: metal })
                object.position.set(v.x, 0, v.z)
            } else {
                const material = new THREE.MeshStandardMaterial({
                    color: v.color,
                    transparent: v.opacity < 1,
                    opacity: v.opacity,
                    depthWrite: v.opacity >= 1,
                })
                // Les formes libres sont traitées plus haut : ici, un simple bloc.
                object = new THREE.Mesh(new THREE.BoxGeometry(v.w, v.height, v.d), material)
                object.position.set(v.x, v.base + v.height / 2, v.z)
            }
            object.rotation.y = (-v.rotation * Math.PI) / 180
            object.userData.key = v.key
            ctx.group.add(object)
            ctx.objects.set(v.key, object)
        }
        const wallMaterial = new THREE.MeshStandardMaterial({ color: cssColor("--muted-foreground").lerp(new THREE.Color(1, 1, 1), 0.55) })
        for (const mur of walls) {
            const object = buildWall(mur, bounds, wallMaterial.clone())
            object.userData.key = murKey(mur.id)
            ctx.group.add(object)
            ctx.objects.set(murKey(mur.id), object)
        }
        wallMaterial.dispose()
        ctx.render()
        // Après une reconstruction du décor (contour), les volumes sont à reposer.
    }, [volumes, walls, bounds, contourKey])

    // Sélection : seul l'éclat des pièces de l'élément change.
    useEffect(() => {
        const ctx = sceneRef.current
        if (!ctx) return
        const glow = cssColor("--primary")
        const none = new THREE.Color(0, 0, 0)
        // Un escalier fusionné s'éclaire en entier.
        const lit = selectionKeys(selectedKey, items)
        for (const [key, object] of ctx.objects) {
            const selected = lit.has(key)
            object.traverse((child) => {
                const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
                if (!material?.isMeshStandardMaterial) return
                material.emissive = selected ? glow : none
                material.emissiveIntensity = selected ? 0.6 : 0
            })
        }
        ctx.render()
    }, [selectedKey, items, volumes, walls, contourKey])

    return (
        <div
            ref={containerRef}
            className="w-full overflow-hidden rounded-2xl border border-border"
            aria-label="Plan 3D du magasin : glisser pour tourner, molette pour zoomer, cliquer un élément pour le sélectionner"
            role="img"
        />
    )
}
