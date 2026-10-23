export interface MiniApp {
    id: number
    title: string
    description: string
    icon: React.ReactNode
    multipleFiles: boolean
    isRectoVerso: boolean
    disabled?: boolean
    helpText?: string
}

import type { toast } from "sonner"

export type ToastFn = typeof toast

export type ToastReturn = ReturnType<ToastFn>
