import {
    createContext,
    useCallback,
    use,
    useMemo,
    useState,
    type ReactNode,
} from "react"
import type { stockViewMode, stockDisplayStyle } from "@/features/stock/types/stock.types"

interface StockUIContextType {
    viewMode: stockViewMode
    setViewMode: (mode: stockViewMode) => void
    displayStyle: stockDisplayStyle
    setDisplayStyle: (style: stockDisplayStyle) => void
    searchInput: string
    setSearchInput: (input: string) => void
    showRaw: boolean
    setShowRaw: (value: boolean) => void
}

const StockUIContext = createContext<StockUIContextType | undefined>(undefined)

export function StockUIProvider({ children }: { children: ReactNode }) {
    const [viewMode, setViewMode] = useState<stockViewMode>("balles")
    const [displayStyle, setDisplayStyle] = useState<stockDisplayStyle>("grid")
    const [searchInput, setSearchInput] = useState<string>("")
    // setShowRawState : setter brut, exposé publiquement via l'alias setShowRaw.
    // eslint-disable-next-line react-naming-convention/use-state
    const [showRaw, setShowRawState] = useState<boolean>(() => {
        try { return localStorage.getItem("stockShowRaw") === "1" } catch { return false }
    })
    const setShowRaw = useCallback((value: boolean) => {
        setShowRawState(value)
        localStorage.setItem("stockShowRaw", value ? "1" : "0")
    }, [])

    const value = useMemo(
        () => ({
            viewMode,
            setViewMode,
            displayStyle,
            setDisplayStyle,
            searchInput,
            setSearchInput,
            showRaw,
            setShowRaw,
        }),
        [viewMode, displayStyle, searchInput, showRaw, setShowRaw]
    )

    return <StockUIContext value={value}>{children}</StockUIContext>
}

export function useStockUIContext() {
    const context = use(StockUIContext)
    if (!context) {
        throw new Error("useStockUIContext must be used within a StockUIProvider")
    }
    return context
}
