/**
 * Plateau La Tournée 3D — Three.js brut (déjà en dépendance, pas de r3f).
 * Rectangle 8×6 façon jeu de l'oie : parcours de 24 cases, pièges aux coins.
 *
 * Chargé en lazy depuis TourneeTab : le chunk three (~600 Ko) ne pèse que si
 * l'utilisateur active la vue 3D. Le composant est un pur rendu de l'état du
 * jeu : scène statique construite au montage, cases + pions reconstruits à
 * chaque changement de `game` (rare : refetch Realtime débouncé).
 *
 * Exception design system §12.4 (« couleurs d'assets non tokenisables ») valable
 * pour tout le fichier : les couleurs ci-dessous alimentent des matériaux
 * three.js et des contextes canvas 2D, qui n'acceptent que des valeurs
 * littérales — aucune résolution de `var(--token)` n'y est possible. Le plateau
 * est un décor de jeu, volontairement indépendant du thème clair/sombre.
 */
/* eslint-disable nokk-project/no-restricted-syntax */
import { useEffect, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { TourneeGame } from "../types"
import { BOARD_CELLS, BOARD_SIZE, cellGridPosition } from "../utils/board"
import type { BoardCell } from "../types"

// Classe Tailwind d'un pion → hex (three ne connaît pas les classes utilitaires).
const COLOR_HEX: Record<string, string> = {
    "bg-red-500": "#ef4444",
    "bg-blue-500": "#3b82f6",
    "bg-emerald-500": "#10b981",
    "bg-amber-500": "#f59e0b",
    "bg-purple-500": "#a855f7",
    "bg-pink-500": "#ec4899",
    "bg-cyan-500": "#06b6d4",
    "bg-orange-500": "#f97316",
}

const KIND_EMOJI: Record<string, string> = {
    start: "🚀",
    jail: "🧊",
    parking: "🌀",
    gotojail: "📵",
    chance: "⚡",
    community: "🎁",
    station: "📡",
}

const CELL_STEP = 1.03

function cellWorldPosition(index: number): { x: number; z: number } {
    const { row, col } = cellGridPosition(index)
    return { x: (col - 4.5) * CELL_STEP, z: (row - 3.5) * CELL_STEP }
}

/** Rotation Y pour que le texte de la case soit lisible depuis le centre. */
function cellRotationY(index: number): number {
    if (index <= 7) return 0 // ligne du bas
    if (index <= 11) return -Math.PI / 2 // colonne gauche
    if (index <= 19) return Math.PI // ligne du haut
    return Math.PI / 2 // colonne droite
}

/** Texture canvas d'une case : bandeau du groupe de propriétés, emoji, nom. */
function makeCellTexture(cell: BoardCell): THREE.Texture {
    const size = 256
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D

    ctx.fillStyle = cell.kind === "property" || cell.kind === "station" ? "#f5f0e6" : "#e8e2d2"
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = "#00000022"
    ctx.lineWidth = 6
    ctx.strokeRect(0, 0, size, size)

    const textTop = 34

    const emoji = KIND_EMOJI[cell.kind]
    if (emoji) {
        ctx.font = "64px sans-serif"
        ctx.textAlign = "center"
        ctx.fillText(emoji, size / 2, size / 2 + 24)
    }

    ctx.fillStyle = "#1c1917"
    ctx.font = "bold 27px sans-serif"
    ctx.textAlign = "center"
    const words = cell.name.split(" ")
    let line = ""
    let y = textTop
    for (const word of words) {
        const attempt = line ? `${line} ${word}` : word
        if (ctx.measureText(attempt).width > size - 24 && line) {
            ctx.fillText(line, size / 2, y)
            line = word
            y += 30
        } else {
            line = attempt
        }
    }
    ctx.fillText(line, size / 2, y)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
}

/** Petite maison façon jeu de plateau (corps + toit pyramidal) aux couleurs du proprio. */
function makeHouse(colorHex: string): THREE.Group {
    const house = new THREE.Group()
    const material = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.4,
    })
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 0.18), material)
    body.position.y = 0.065
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.13, 4), material)
    roof.position.y = 0.13 + 0.065
    roof.rotation.y = Math.PI / 4
    house.add(body, roof)
    return house
}

/** Étiquette de pseudo affichée au-dessus d'un pion (pastille colorée). */
function makeNameTexture(name: string, colorHex: string): THREE.Texture {
    const canvas = document.createElement("canvas")
    canvas.width = 512
    canvas.height = 128
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D

    ctx.font = "bold 56px sans-serif"
    const label = name.length > 16 ? `${name.slice(0, 15)}…` : name
    const textWidth = ctx.measureText(label).width
    const paddingX = 36
    const pillWidth = Math.min(512, textWidth + paddingX * 2)
    const x = (512 - pillWidth) / 2

    // Pastille arrondie couleur joueur, texte blanc.
    ctx.beginPath()
    ctx.roundRect(x, 16, pillWidth, 96, 48)
    ctx.fillStyle = colorHex
    ctx.fill()
    ctx.strokeStyle = "#ffffffaa"
    ctx.lineWidth = 6
    ctx.stroke()

    ctx.fillStyle = "#ffffff"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(label, 256, 66)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

// ── Dés animés (lancer au centre lors d'un nouveau coup) ─────────────────────

/** Face de dé : fond blanc arrondi + points noirs. */
function makePipTexture(value: number): THREE.Texture {
    const size = 128
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
    ctx.fillStyle = "#f8f7f2"
    ctx.beginPath()
    ctx.roundRect(0, 0, size, size, 22)
    ctx.fill()
    const c = size / 2
    const o = 32
    const PIPS: Record<number, [number, number][]> = {
        1: [[c, c]],
        2: [[o, o], [size - o, size - o]],
        3: [[o, o], [c, c], [size - o, size - o]],
        4: [[o, o], [size - o, o], [o, size - o], [size - o, size - o]],
        5: [[o, o], [size - o, o], [c, c], [o, size - o], [size - o, size - o]],
        6: [[o, o], [size - o, o], [o, c], [size - o, c], [o, size - o], [size - o, size - o]],
    }
    ctx.fillStyle = "#1c1917"
    for (const [px, py] of PIPS[value] ?? []) {
        ctx.beginPath()
        ctx.arc(px, py, 11, 0, Math.PI * 2)
        ctx.fill()
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

/** Valeurs portées par les faces [+x, -x, +y, -y, +z, -z] du cube. */
const DIE_FACE_VALUES = [1, 6, 2, 5, 3, 4]

/** Rotation à appliquer au dé pour que `value` se retrouve face vers le haut. */
const DIE_TOP_ROTATION: Record<number, [number, number, number]> = {
    1: [0, 0, Math.PI / 2], // +x → +y
    6: [0, 0, -Math.PI / 2], // -x → +y
    2: [0, 0, 0], // +y déjà en haut
    5: [Math.PI, 0, 0], // -y → +y
    3: [-Math.PI / 2, 0, 0], // +z → +y
    4: [Math.PI / 2, 0, 0], // -z → +y
}

function makeDie(): THREE.Mesh {
    return new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        DIE_FACE_VALUES.map(
            (v) =>
                new THREE.MeshStandardMaterial({
                    map: makePipTexture(v),
                    roughness: 0.3,
                })
        )
    )
}

/** État d'un lancer en cours (machine à états lue par la boucle de rendu). */
interface DiceRoll {
    startedAt: number
    values: [number, number]
    dice: [THREE.Mesh, THREE.Mesh]
    group: THREE.Group
    /** Vitesses de culbute par dé (rad, déphasées pour varier les lancers). */
    spins: [number, number]
}

const DICE_ROLL_DURATION = 1.3
const DICE_HOLD_DURATION = 1.4

/** Marche du pion (après les dés) : un saut par case. */
interface TokenWalk {
    token: THREE.Object3D
    startPos: THREE.Vector3
    /** Centres des cases traversées, la dernière = position finale exacte. */
    path: THREE.Vector3[]
    finalPos: THREE.Vector3
    /** Démarre après la stabilisation des dés (secondes écoulées). */
    startAt: number
    stepDur: number
}

const WALK_STEP_DURATION = 0.26
const WALK_START_DELAY = 0.2
const WALK_HOP_HEIGHT = 0.3

/** Texture du logo central. */
function makeLogoTexture(periodLabel: string): THREE.Texture {
    const canvas = document.createElement("canvas")
    canvas.width = 1024
    canvas.height = 288
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
    ctx.fillStyle = "#1d4ed8"
    ctx.fillRect(0, 0, 1024, 288)
    ctx.fillStyle = "#ffffff"
    ctx.textAlign = "center"
    ctx.font = "bold 120px sans-serif"
    ctx.fillText("LA TOURNÉE", 512, 148)
    ctx.font = "44px sans-serif"
    ctx.fillText(`Le jeu des setters — ${periodLabel}`, 512, 232)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

function disposeGroup(group: THREE.Group) {
    group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
            if (obj instanceof THREE.Mesh) obj.geometry.dispose()
            const materials = Array.isArray(obj.material)
                ? obj.material
                : [obj.material]
            for (const material of materials) {
                if ("map" in material && material.map) {
                    ;(material.map as THREE.Texture).dispose()
                }
                material.dispose()
            }
        }
    })
    group.clear()
}

export function Board3D({ game }: { game: TourneeGame }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const dynamicGroupRef = useRef<THREE.Group | null>(null)
    const tokensGroupRef = useRef<THREE.Group | null>(null)
    const sceneRef = useRef<THREE.Scene | null>(null)
    /** Secondes écoulées depuis le montage (remplace THREE.Clock, déprécié). */
    const getElapsedRef = useRef<(() => number) | null>(null)
    const diceRollRef = useRef<DiceRoll | null>(null)
    const tokenWalkRef = useRef<TokenWalk | null>(null)
    const reducedMotionRef = useRef(false)
    const lastMoveIdRef = useRef<string | null>(null)

    // ── Scène statique : une seule fois au montage ──────────────────────────
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
        camera.position.set(8, 8.5, 7)

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        container.appendChild(renderer.domElement)

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.maxPolarAngle = Math.PI / 2.15
        controls.minDistance = 5
        controls.maxDistance = 18
        const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches
        reducedMotionRef.current = reducedMotion
        controls.autoRotate = !reducedMotion
        controls.autoRotateSpeed = 0.6

        // Ne pas confisquer le scroll de la page : la molette ne zoome que
        // si Ctrl/Cmd est enfoncé, sinon elle scrolle normalement.
        controls.enableZoom = false
        const syncZoomModifier = (e: KeyboardEvent) => {
            controls.enableZoom = e.ctrlKey || e.metaKey
        }
        window.addEventListener("keydown", syncZoomModifier)
        window.addEventListener("keyup", syncZoomModifier)
        // Tactile : un doigt = scroll de page (aucune action), deux doigts =
        // rotation + zoom du plateau.
        controls.touches.ONE = null as unknown as THREE.TOUCH
        controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE
        // OrbitControls force touch-action:none — on rétablit le scroll
        // vertical au doigt sur le canvas.
        renderer.domElement.style.touchAction = "pan-y"

        scene.add(new THREE.AmbientLight(0xffffff, 1.1))
        const sun = new THREE.DirectionalLight(0xffffff, 1.6)
        sun.position.set(5, 10, 4)
        scene.add(sun)

        // Socle du plateau + tapis central vert.
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(8.6, 0.24, 6.6),
            new THREE.MeshStandardMaterial({ color: "#134e35" })
        )
        base.position.y = -0.13
        scene.add(base)
        const felt = new THREE.Mesh(
            new THREE.BoxGeometry(6.0, 0.06, 4.0),
            new THREE.MeshStandardMaterial({ color: "#cde6d0" })
        )
        felt.position.y = 0.02
        scene.add(felt)

        const logo = new THREE.Mesh(
            new THREE.PlaneGeometry(4.2, 1.18),
            new THREE.MeshBasicMaterial({
                map: makeLogoTexture(game.periodLabel),
                transparent: true,
            })
        )
        logo.rotation.x = -Math.PI / 2
        logo.rotation.z = -Math.PI / 24
        logo.position.y = 0.07
        scene.add(logo)

        const dynamicGroup = new THREE.Group()
        const tokensGroup = new THREE.Group()
        scene.add(dynamicGroup, tokensGroup)
        dynamicGroupRef.current = dynamicGroup
        tokensGroupRef.current = tokensGroup
        sceneRef.current = scene

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

        // Boucle de rendu : damping caméra + flottement doux des pions
        // + animation du lancer de dés au centre quand un coup arrive.
        const t0 = performance.now()
        const getElapsed = () => (performance.now() - t0) / 1000
        getElapsedRef.current = getElapsed
        let frameId = 0
        const easeOutCubic = (p: number) => 1 - (1 - p) ** 3
        const animate = () => {
            frameId = requestAnimationFrame(animate)
            const t = getElapsed()
            controls.update()
            if (!reducedMotion) {
                tokensGroup.children.forEach((token, i) => {
                    // Le pion en train de marcher est piloté plus bas.
                    if (token.userData.walking) return
                    token.position.y =
                        (token.userData.baseY as number) +
                        Math.sin(t * 2 + i * 1.7) * 0.03
                })
            }

            // Marche du pion : un saut parabolique par case, déclenché après
            // la stabilisation des dés.
            const walk = tokenWalkRef.current
            if (walk) {
                const wt = t - walk.startAt
                if (wt >= 0) {
                    const idx = Math.floor(wt / walk.stepDur)
                    if (idx >= walk.path.length) {
                        walk.token.position.copy(walk.finalPos)
                        walk.token.userData.walking = false
                        tokenWalkRef.current = null
                    } else {
                        const p = (wt % walk.stepDur) / walk.stepDur
                        const fromPos =
                            idx === 0 ? walk.startPos : walk.path[idx - 1]
                        const toPos = walk.path[idx]
                        walk.token.position.set(
                            fromPos.x + (toPos.x - fromPos.x) * p,
                            (walk.token.userData.baseY as number) +
                                Math.sin(p * Math.PI) * WALK_HOP_HEIGHT,
                            fromPos.z + (toPos.z - fromPos.z) * p
                        )
                    }
                }
            }

            const roll = diceRollRef.current
            if (roll) {
                const dt = t - roll.startedAt
                if (dt < DICE_ROLL_DURATION) {
                    // Chute + culbute qui se stabilise sur la valeur finale.
                    const p = easeOutCubic(
                        Math.min(dt / DICE_ROLL_DURATION, 1)
                    )
                    roll.dice.forEach((die, i) => {
                        const [rx, ry, rz] =
                            DIE_TOP_ROTATION[roll.values[i]] ?? [0, 0, 0]
                        const remaining = 1 - p
                        die.position.y =
                            0.45 +
                            remaining * 2.4 * Math.abs(Math.sin(p * Math.PI * 2.4))
                        die.rotation.set(
                            rx + remaining * roll.spins[i],
                            ry + remaining * roll.spins[i] * 0.7,
                            rz + remaining * roll.spins[i] * 1.3
                        )
                    })
                } else if (dt > DICE_ROLL_DURATION + DICE_HOLD_DURATION) {
                    // Fin de l'animation : retirer et libérer les dés.
                    roll.group.removeFromParent()
                    disposeGroup(roll.group)
                    diceRollRef.current = null
                }
            }

            renderer.render(scene, camera)
        }
        animate()

        return () => {
            cancelAnimationFrame(frameId)
            observer.disconnect()
            window.removeEventListener("keydown", syncZoomModifier)
            window.removeEventListener("keyup", syncZoomModifier)
            controls.dispose()
            disposeGroup(dynamicGroup)
            disposeGroup(tokensGroup)
            scene.traverse((obj) => {
                if (obj instanceof THREE.Mesh) {
                    obj.geometry.dispose()
                    const materials = Array.isArray(obj.material)
                        ? obj.material
                        : [obj.material]
                    for (const material of materials) {
                        if ("map" in material && material.map) {
                            ;(material.map as THREE.Texture).dispose()
                        }
                        material.dispose()
                    }
                }
            })
            if (diceRollRef.current) {
                disposeGroup(diceRollRef.current.group)
                diceRollRef.current = null
            }
            renderer.dispose()
            renderer.domElement.remove()
            dynamicGroupRef.current = null
            tokensGroupRef.current = null
            sceneRef.current = null
            getElapsedRef.current = null
        }
        // Le logo utilise periodLabel figé au montage : le mois ne change pas
        // pendant la vie du composant.
    }, [])

    // ── Cases + pions : reconstruits à chaque mise à jour du jeu ────────────
    useEffect(() => {
        const dynamicGroup = dynamicGroupRef.current
        const tokensGroup = tokensGroupRef.current
        if (!dynamicGroup || !tokensGroup) return

        disposeGroup(dynamicGroup)
        disposeGroup(tokensGroup)
        // Une marche de pion en attente porte sur des meshes qu'on vient de
        // libérer : on l'abandonne.
        tokenWalkRef.current = null

        // Nouveau coup détecté (Realtime) → lancer de dés animé au centre,
        // avec les vraies valeurs du coup, PUIS marche du pion case par case
        // (configurée après la construction des pions, plus bas). Pas
        // d'animation au premier rendu ni si l'utilisateur préfère les
        // animations réduites.
        const lastMove = game.moves[game.moves.length - 1] ?? null
        const scene = sceneRef.current
        const getElapsed = getElapsedRef.current
        let rollingMove: typeof lastMove | null = null
        let diceStartAt = 0
        if (
            lastMove &&
            lastMoveIdRef.current !== null &&
            lastMove.eventId !== lastMoveIdRef.current &&
            !reducedMotionRef.current &&
            scene &&
            getElapsed
        ) {
            if (diceRollRef.current) {
                // Un lancer était déjà en cours : on le remplace.
                diceRollRef.current.group.removeFromParent()
                disposeGroup(diceRollRef.current.group)
            }
            const group = new THREE.Group()
            const die1 = makeDie()
            const die2 = makeDie()
            die1.position.set(-0.45, 3, 0.2)
            die2.position.set(0.45, 3, -0.2)
            group.add(die1, die2)
            scene.add(group)
            diceStartAt = getElapsed()
            diceRollRef.current = {
                startedAt: diceStartAt,
                values: lastMove.dice,
                dice: [die1, die2],
                group,
                // Culbutes déphasées selon les valeurs : chaque lancer varie.
                spins: [
                    Math.PI * (3 + lastMove.dice[0] * 0.6),
                    Math.PI * (3.8 + lastMove.dice[1] * 0.5),
                ],
            }
            rollingMove = lastMove
        }
        lastMoveIdRef.current = lastMove?.eventId ?? null

        const playerById = new Map(game.players.map((p) => [p.id, p]))
        const sideMaterial = new THREE.MeshStandardMaterial({ color: "#efe9da" })

        for (const cell of BOARD_CELLS) {
            const owner = game.ownership[cell.index]
                ? playerById.get(game.ownership[cell.index])
                : null
            const topMaterial = new THREE.MeshStandardMaterial({
                map: makeCellTexture(cell),
            })
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.98, 0.14, 0.98),
                // Ordre des faces : +x, -x, +y (dessus), -y, +z, -z.
                [sideMaterial, sideMaterial, topMaterial, sideMaterial, sideMaterial, sideMaterial]
            )
            const { x, z } = cellWorldPosition(cell.index)
            mesh.position.set(x, 0.07, z)
            mesh.rotation.y = cellRotationY(cell.index)
            dynamicGroup.add(mesh)

            // Case possédée → petite maison aux couleurs du propriétaire.
            // Enfant du mesh de la case : son offset est LOCAL, donc la
            // maison reste en bas à gauche de la case quelle que soit la
            // rotation du côté du plateau (les pions restent au centre).
            if (owner) {
                const house = makeHouse(COLOR_HEX[owner.color] ?? "#888888")
                house.position.set(-0.32, 0.07, 0.32)
                mesh.add(house)
            }
        }

        // Pions : plusieurs joueurs sur une même case → répartis en cercle.
        const tokenByPlayer = new Map<string, THREE.Mesh>()
        const byCell = new Map<number, typeof game.players>()
        for (const player of game.players) {
            const list = byCell.get(player.position) ?? []
            list.push(player)
            byCell.set(player.position, list)
        }
        for (const [cellIndex, players] of byCell) {
            const { x, z } = cellWorldPosition(cellIndex)
            players.forEach((player, i) => {
                const token = new THREE.Mesh(
                    new THREE.CapsuleGeometry(0.11, 0.2, 6, 14),
                    new THREE.MeshStandardMaterial({
                        color: COLOR_HEX[player.color] ?? "#888888",
                        roughness: 0.35,
                    })
                )
                const angle = (i / players.length) * Math.PI * 2
                const spread = players.length > 1 ? 0.24 : 0
                const baseY = 0.34
                token.position.set(
                    x + Math.cos(angle) * spread,
                    baseY,
                    z + Math.sin(angle) * spread
                )
                token.userData.baseY = baseY

                // Pseudo au-dessus du pion : sprite (toujours face caméra),
                // enfant du pion pour suivre son flottement.
                const label = new THREE.Sprite(
                    new THREE.SpriteMaterial({
                        map: makeNameTexture(
                            player.name,
                            COLOR_HEX[player.color] ?? "#888888"
                        ),
                        depthTest: false,
                    })
                )
                label.scale.set(1.15, 0.29, 1)
                label.position.y = 0.45
                token.add(label)

                tokenByPlayer.set(player.id, token)
                tokensGroup.add(token)
            })
        }

        // Chorégraphie du nouveau coup : le pion du joueur attend sur sa case
        // de DÉPART pendant que les dés roulent, puis avance case par case
        // (un no-show file directement au Frigo en un seul grand saut).
        if (rollingMove) {
            const token = tokenByPlayer.get(rollingMove.playerId)
            if (token) {
                const finalPos = token.position.clone()
                const baseY = token.userData.baseY as number
                const startCell = cellWorldPosition(rollingMove.from)
                token.position.set(startCell.x, baseY, startCell.z)
                token.userData.walking = true

                const path: THREE.Vector3[] = []
                if (!rollingMove.sentToJail) {
                    const steps =
                        (rollingMove.to - rollingMove.from + BOARD_SIZE) %
                        BOARD_SIZE
                    for (let s = 1; s < steps; s++) {
                        const { x, z } = cellWorldPosition(
                            (rollingMove.from + s) % BOARD_SIZE
                        )
                        path.push(new THREE.Vector3(x, baseY, z))
                    }
                }
                // Dernière étape : la position finale exacte (avec l'offset
                // de répartition si plusieurs pions partagent la case).
                path.push(finalPos.clone())

                tokenWalkRef.current = {
                    token,
                    startPos: token.position.clone(),
                    path,
                    finalPos,
                    startAt:
                        diceStartAt + DICE_ROLL_DURATION + WALK_START_DELAY,
                    stepDur: WALK_STEP_DURATION,
                }
            }
        }
    }, [game])

    return (
        <div className="space-y-1">
            <div
                ref={containerRef}
                className="aspect-[4/3] w-full overflow-hidden rounded-lg border bg-muted/30"
            />
            <p className="text-center text-2xs text-muted-foreground">
                Glisser pour tourner · Ctrl + molette pour zoomer
            </p>
        </div>
    )
}

export default Board3D
