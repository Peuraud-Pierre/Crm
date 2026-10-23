import { useEffect, useState, type RefObject } from "react"

interface Stamp {
    text: string
    x: number // % of viewport
    y: number // % of viewport
    rotate: number // degrees
    size: "sm" | "md" | "lg"
    shape: "rect" | "circle" | "diamond"
    palette: "brown" | "green" | "dark"
    style: "solid" | "dashed" | "double"
}

// Light/dark color maps for each palette
const COLORS = {
    // eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4)
    light: { brown: "#8b4513", green: "#2d5016", dark: "#6b3410" },
    // eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4)
    dark: { brown: "#c4975a", green: "#7ab362", dark: "#b8864a" },
}

const STAMPS: Stamp[] = [
    {
        text: "VINTAGE",
        x: 8,
        y: 6,
        rotate: -12,
        size: "lg",
        shape: "rect",
        palette: "brown",
        style: "double",
    },
    {
        text: "EXPÉDIÉ",
        x: 78,
        y: 4,
        rotate: 8,
        size: "md",
        shape: "rect",
        palette: "green",
        style: "solid",
    },
    {
        text: "1ER CHOIX",
        x: 88,
        y: 28,
        rotate: -6,
        size: "sm",
        shape: "circle",
        palette: "brown",
        style: "dashed",
    },
    {
        text: "DÉPÔT",
        x: 5,
        y: 52,
        rotate: 15,
        size: "md",
        shape: "rect",
        palette: "dark",
        style: "double",
    },
    {
        text: "FRIPERIE",
        x: 72,
        y: 55,
        rotate: -18,
        size: "lg",
        shape: "rect",
        palette: "green",
        style: "solid",
    },
    {
        text: "GROSSISTE",
        x: 40,
        y: 88,
        rotate: 5,
        size: "md",
        shape: "rect",
        palette: "brown",
        style: "double",
    },
    {
        text: "LOT N°42",
        x: 12,
        y: 82,
        rotate: -8,
        size: "sm",
        shape: "rect",
        palette: "dark",
        style: "dashed",
    },
    {
        text: "TRIÉ",
        x: 55,
        y: 12,
        rotate: 22,
        size: "sm",
        shape: "circle",
        palette: "green",
        style: "solid",
    },
    {
        text: "AUTHENTIQUE",
        x: 30,
        y: 42,
        rotate: -4,
        size: "md",
        shape: "diamond",
        palette: "brown",
        style: "dashed",
    },
    {
        text: "IMPORT",
        x: 90,
        y: 75,
        rotate: 12,
        size: "sm",
        shape: "rect",
        palette: "dark",
        style: "solid",
    },
    {
        text: "QUALITÉ A",
        x: 60,
        y: 70,
        rotate: -15,
        size: "sm",
        shape: "circle",
        palette: "green",
        style: "double",
    },
    {
        text: "EUR€KA",
        x: 42,
        y: 2,
        rotate: 3,
        size: "lg",
        shape: "rect",
        palette: "green",
        style: "double",
    },
]

export function BioModeOverlay({
    containerRef: _containerRef,
}: {
    containerRef: RefObject<HTMLElement | null>
}) {
    void _containerRef
    const [enabled, setEnabled] = useState(false)
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
        const root = document.documentElement
        const update = () => {
            // Syncing local state from an external store (DOM class list observed
            // via MutationObserver); not derivable during render.
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setEnabled(root.classList.contains("bio-mode"))
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setIsDark(root.classList.contains("dark"))
        }
        update()
        const observer = new MutationObserver(update)
        observer.observe(root, { attributes: true, attributeFilter: ["class"] })
        return () => observer.disconnect()
    }, [])

    if (!enabled) return null

    return (
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
            {STAMPS.map((stamp, i) => (
                <StampElement
                    key={stamp.text}
                    stamp={stamp}
                    index={i}
                    isDark={isDark}
                />
            ))}

            {/* Scotch tape strips */}
            <div
                className="bio-tape"
                style={{ top: "18%", left: "15%", transform: "rotate(-25deg)" }}
            />
            <div
                className="bio-tape"
                style={{ top: "62%", right: "8%", transform: "rotate(15deg)" }}
            />
            <div
                className="bio-tape bio-tape-sm"
                style={{
                    bottom: "22%",
                    left: "35%",
                    transform: "rotate(-8deg)",
                }}
            />

            {/* Coffee ring stains */}
            <div
                className="bio-coffee-ring"
                style={{ top: "30%", left: "60%" }}
            />
            <div
                className="bio-coffee-ring bio-coffee-ring-sm"
                style={{ top: "75%", left: "20%" }}
            />
        </div>
    )
}

function StampElement({
    stamp,
    index,
    isDark,
}: {
    stamp: Stamp
    index: number
    isDark: boolean
}) {
    // Échelle de tampon, sur les tokens : `text-3xs` (10px) existe déjà, et
    // le pas suivant tombe à 1px près sur `text-sm`/`text-lg`. Un écart
    // d'un pixel sur un tampon décoratif ne se voit pas ; trois tailles
    // arbitraires de plus dans le dépôt, si.
    const sizeMap = { sm: "text-3xs", md: "text-sm", lg: "text-lg" }
    const paddingMap = { sm: "px-3 py-1.5", md: "px-4 py-2", lg: "px-5 py-2.5" }

    const color = COLORS[isDark ? "dark" : "light"][stamp.palette]

    const borderStyle =
        stamp.style === "double"
            ? `3px double ${color}`
            : stamp.style === "dashed"
              ? `2px dashed ${color}`
              : `2px solid ${color}`

    const isCircle = stamp.shape === "circle"
    const isDiamond = stamp.shape === "diamond"

    return (
        <div
            className={`absolute bio-stamp`}
            style={{
                left: `${stamp.x}%`,
                top: `${stamp.y}%`,
                transform: `rotate(${stamp.rotate}deg)${isDiamond ? " rotate(45deg)" : ""}`,
                animationDelay: `${index * 0.15}s`,
            }}
        >
            <div
                className={`
                    ${sizeMap[stamp.size]}
                    ${paddingMap[stamp.size]}
                    ${/* 0.2em : le double de `tracking-widest`. Un tampon encreur espace ses lettres bien au-delà de l'échelle typographique de l'application. */ ""}
                    font-mono font-bold tracking-[0.2em] uppercase
                    whitespace-nowrap select-none
                    ${isCircle ? "rounded-full aspect-square flex items-center justify-center" : ""}
                    ${isDiamond ? "flex items-center justify-center" : ""}
                `}
                style={{
                    color,
                    border: borderStyle,
                    borderRadius: isCircle ? "50%" : isDiamond ? "4px" : "3px",
                    opacity: isDark
                        ? 0.3 + (index % 3) * 0.06
                        : 0.35 + (index % 3) * 0.08,
                    boxShadow: `inset 0 0 0 ${stamp.style === "double" ? "1px" : "0px"} ${color}22`,
                    transform: isDiamond ? "rotate(-45deg)" : undefined,
                }}
            >
                {stamp.text}
            </div>
        </div>
    )
}
