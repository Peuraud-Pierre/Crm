import {
    ARTISTIC_WEBHOOK_URL,
    CAPTION_OVERLAY_WEBHOOK_URL,
    DECOR_OPTIONS,
    DEFAULT_WEBHOOK_URL,
    IMAGE_ENHANCER_WEBHOOK_URL,
    IMAGE_TO_VIDEO_WEBHOOK_URL,
    SMART_CUTOUT_WEBHOOK_URL,
    STORY_SUGGESTER_WEBHOOK_URL,
} from "@/features/content/components/App"
import type { ToastFn } from "@/features/content/components/interface"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    createContext,
    createElement,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
    useCallback,
    use,
    useRef,
    useState,
} from "react"
import { useNavigate } from "react-router"
import { getAccessToken } from "@/features/content/services/contentGenerationService"

interface FormState {
    nom: string
    couleur: string
    genre: string
    cheveux: string
    position: string
    decor: string
    decorChoice: string
    filtre: string
    effet: string
    logoChoice: string
    captionText: string
    captionSize: string
    captionPosition: string
    captionAlignment: string
    secondaryCaptionText: string
    highlightText: string
    highlightColor: string
    secondaryCaptionSize: string
    includeCaptions: boolean
    includeAudio: boolean
    storyStyle: string
    storyTone: string
    storyPlatform: string
    storyLanguage: string
    videoSubmitting: boolean
    captionSubmitting: boolean
    cutoutSubmitting: boolean
    Submitting: boolean
    webhookUrl: string
    artisticSubmitting: boolean
    enhancerSubmitting: boolean
}

const INITIAL_FORM_STATE: FormState = {
    nom: "",
    couleur: "",
    genre: "",
    cheveux: "",
    position: "",
    decor: "",
    decorChoice: "",
    filtre: "",
    effet: "",
    logoChoice: "nokk_project",
    captionText: "",
    captionSize: "gros",
    captionPosition: "bas",
    captionAlignment: "gauche",
    secondaryCaptionText: "",
    highlightText: "",
    highlightColor: "",
    secondaryCaptionSize: "gros",
    includeCaptions: false,
    includeAudio: false,
    storyStyle: "vintage",
    storyTone: "inspirant",
    storyPlatform: "instagram",
    storyLanguage: "français",
    videoSubmitting: false,
    captionSubmitting: false,
    cutoutSubmitting: false,
    Submitting: false,
    webhookUrl: "",
    artisticSubmitting: false,
    enhancerSubmitting: false,
}

interface ContentContextType {
    formData: FormState
    updateField: (field: keyof FormState, value: string | boolean) => void
    selectedFiles: File[]
    setSelectedFiles: Dispatch<SetStateAction<File[]>>
    openDialog: number | null
    setOpenDialog: Dispatch<SetStateAction<number | null>>
    triggerFilePicker: (appId: number) => void
    fileInputRefs: React.MutableRefObject<
        Record<number, HTMLInputElement | null>
    >
    handleDecorSelect: (value: string) => void
    handleSend: (appId: number) => Promise<void>
    removeFile: (index: number) => void
    waitingOpen: boolean
    setWaitingOpen: Dispatch<SetStateAction<boolean>>
    htmlResult: string | null
    setHtmlResult: Dispatch<SetStateAction<string | null>>
    resetForm: () => void
    toast: ToastFn
}

const ContentContext = createContext<ContentContextType | null>(null)

/**
 * ContentProvider component that manages the global state for content creation and processing.
 *
 * Provides form data, file management, and webhook communication for multiple image/video processing features.
 *
 * @component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to be wrapped by the provider
 *
 * @returns {React.ReactElement} A context provider wrapping children with content management capabilities
 *
 * @example
 * ```tsx
 * <ContentProvider>
 *   <YourApp />
 * </ContentProvider>
 * ```
 *
 * @context ContentContext
 * Provides the following context value:
 * - formData: FormState - Current form state containing user inputs
 * - updateField: (field: keyof FormState, value: string | boolean) => void - Updates a form field
 * - selectedFiles: File[] - Currently selected files for processing
 * - setSelectedFiles: (files: File[]) => void - Sets the selected files
 * - openDialog: number | null - ID of currently open dialog
 * - setOpenDialog: (id: number | null) => void - Opens/closes a dialog
 * - triggerFilePicker: (appId: number) => void - Opens file picker for specific app
 * - fileInputRefs: React.MutableRefObject<Record<number, HTMLInputElement | null>> - References to file inputs
 * - handleDecorSelect: (value: string) => void - Handles decor option selection
 * - handleSend: (appId: number) => Promise<void> - Routes request to appropriate webhook based on appId
 * - removeFile: (index: number) => void - Removes file at specified index
 * - waitingOpen: boolean - Indicates if waiting/loading panel is open
 * - setWaitingOpen: (open: boolean) => void - Opens/closes waiting panel
 * - htmlResult: string | null - Generated HTML result
 * - setHtmlResult: (html: string | null) => void - Sets HTML result
 * - resetForm: () => void - Resets form to initial state
 * - toast: Toast function - Displays toast notifications
 *
 * @remarks
 * Manages webhook requests for 6 different content processing features:
 * 1. Default webhook (generic content)
 * 2. Artistic Enhancer
 * 3. Image Enhancer
 * 4. Image to Video
 * 5. Caption Overlay
 * 6. Smart Cutout
 */
export function ContentProvider({ children }: { children: ReactNode }) {
    const [formData, setFormData] = useState<FormState>(INITIAL_FORM_STATE)
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [openDialog, setOpenDialog] = useState<number | null>(null)

    const navigate = useNavigate()

    const { user } = useAuth()

    const updateField = useCallback(
        (field: keyof FormState, value: string | boolean) => {
            setFormData((prev) => {
                // Petite logique spéciale pour le décor si besoin
                if (field === "decorChoice") {
                    const selected = DECOR_OPTIONS.find(
                        (o) => o.value === value
                    )
                    return {
                        ...prev,
                        decorChoice: value as string,
                        decor: selected ? selected.label : (value as string),
                    }
                }
                return { ...prev, [field]: value }
            })
        },
        []
    )

    const [waitingOpen, setWaitingOpen] = useState(false)

    const [htmlResult, setHtmlResult] = useState<string | null>(null)

    const fileInputRef = useRef<Record<number, HTMLInputElement | null>>({})

    const triggerFilePicker = (appId: number) => {
        const input = fileInputRef.current[appId]
        if (input) input.click()
    }

    const sendImageToVideoWebhook = async () => {
        if (selectedFiles.length === 0) {
            toast.error("Image requise", { description: "Ajoutez une image à animer." })
            return
        }

        // 🎨 Construction du FormData
        const tmp = new FormData()
        tmp.append("image", selectedFiles[0], selectedFiles[0].name)
        tmp.append("genre", formData.genre || "")
        tmp.append("cheveux", formData.cheveux || "")
        tmp.append("position", formData.position || "")
        tmp.append("decor", formData.decor || "")
        tmp.append("filtre", formData.filtre || "")
        tmp.append("effet", formData.effet || "")
        tmp.append("userid", String(user?.user_id || ""))
        tmp.append("logo", formData.logoChoice)
        tmp.append("if_audio", formData.includeAudio ? "true" : "false")
        tmp.append("if_caption", formData.includeCaptions ? "true" : "false")

        const primaryCaption = (formData.captionText ?? "").trim()
        const secondaryCaption = (formData.secondaryCaptionText ?? "").trim()
        const hasPrimary = primaryCaption.length > 0
        const hasSecondary = secondaryCaption.length > 0
        const hasHighlight = Boolean(formData.highlightText?.trim().length)

        const accessToken = await getAccessToken()
        toast.info("Envoi en cours…", { description: `${selectedFiles.length} image(s) transmises.` })

        if (formData.includeCaptions) {
            if (hasPrimary) {
                tmp.append("caption", primaryCaption)
                tmp.append("caption_size", String(formData.captionSize || 1))
                tmp.append("caption_position", formData.captionPosition || "")
                tmp.append("caption_alignment", formData.captionAlignment || "")
            }
            if (hasSecondary) {
                tmp.append("caption_secondary", secondaryCaption)
                tmp.append(
                    "caption_secondary_size",
                    String(formData.secondaryCaptionSize || 1)
                )
            }
            if (hasHighlight) {
                tmp.append("highlight_text", String(formData.highlightText))
                tmp.append("highlight_color", formData.highlightColor || "")
            }
        }

        const res = await fetch(IMAGE_TO_VIDEO_WEBHOOK_URL, {
            method: "POST",
            body: tmp,
            headers: {
                include: "credentials",
                Authorization: `Bearer ${accessToken}`,
            },
        })
        const text = await res.text()
        if (res.status === 429) {
            toast.error("Limite atteinte", { description: "Veuillez patienter 60 secondes avant de réessayer." })
            return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} : ${text}`)

        toast.success("Succès ✅", { description: "Votre image est en cours de traitement." })

        navigate("/contentlist", { replace: true })

        // ⏳ Ouvre le panneau

        updateField("videoSubmitting", true)
    }

    const sendToWebhook = async ({ link }: { link: string }) => {
        if (selectedFiles.length === 0) {
            toast.error("Aucune image", { description: "Ajoutez au moins une image avant d’envoyer." })
            return
        }

        const tmp = new FormData()
        tmp.append("nom", formData.nom)
        tmp.append("couleur", formData.couleur)
        tmp.append("userid", String(user?.user_id || ""))
        tmp.append("logo", formData.logoChoice)
        selectedFiles.forEach((f) => tmp.append("files[]", f, f.name))
        setWaitingOpen(true)
        updateField("Submitting", true)

        const accessToken = await getAccessToken()
        toast.info("Envoi en cours…", { description: `${selectedFiles.length} image(s) transmises.` })

        try {
            const res = await fetch(link, {
                method: "POST",
                body: tmp,
                headers: {
                    include: "credentials",
                    Authorization: `Bearer ${accessToken}`,
                },
            })
            const text = await res.text()
            if (res.status === 429) {
                toast.error("Limite atteinte", { description: "Veuillez patienter 60 secondes avant de réessayer." })
                return
            }
            if (!res.ok) throw new Error(`HTTP ${res.status} : ${text}`)

            toast.success("Succès ✅", { description: "Votre image est en cours de traitement." })

            navigate("/contentlist", { replace: true })
        } catch (err: unknown) {
            console.error(err)
        } finally {
            updateField("Submitting", false)
        }
    }

    const resetForm = () => {
        setSelectedFiles([])

        setHtmlResult(null)
        setFormData(INITIAL_FORM_STATE)
    }

    const handleDecorSelect = (value: string) => {
        updateField("decorChoice", value)
    }

    const sendArtisticEnhancerWebhook = async () => {
        if (selectedFiles.length === 0) {
            toast.error("Photos requises", { description: "Ajoutez une photo." })
            return
        }

        if (
            !formData.genre ||
            !formData.cheveux ||
            !formData.position ||
            !formData.decor ||
            !formData.filtre ||
            !formData.effet
        ) {
            toast.error("Champs manquants", { description: "Complétez tous les champs." })
            return
        }

        const tmp = new FormData()
        tmp.append("genre", formData.genre)
        tmp.append("cheveux", formData.cheveux)
        tmp.append("position", formData.position)
        tmp.append("decor", formData.decor)
        tmp.append("filtre", formData.filtre)
        tmp.append("effet", formData.effet)
        tmp.append("userid", String(user?.user_id || ""))
        tmp.append("logo", formData.logoChoice)
        selectedFiles.forEach((f) => tmp.append("files", f, f.name))

        setWaitingOpen(true)

        try {
            const res = await fetch(ARTISTIC_WEBHOOK_URL, {
                method: "POST",
                body: tmp,
            })

            const text = await res.text()
            if (res.status === 429) {
                toast.error("Limite atteinte", { description: "Veuillez patienter 60 secondes avant de réessayer." })
                return
            }
            if (!res.ok) throw new Error(`HTTP ${res.status} : ${text}`)

            toast.success("Succès ✅", { description: "Votre image est en cours de traitement." })

            navigate("/contentlist", { replace: true })
        } catch (err: unknown) {
            console.error(err)
        }
    }

    const sendImageEnhancerWebhook = async () => {
        if (selectedFiles.length === 0) {
            toast.error("Photos requises", { description: "Ajoutez une photo." })
            return
        }

        if (
            !formData.genre ||
            !formData.cheveux ||
            !formData.position ||
            !formData.decor ||
            !formData.filtre ||
            !formData.effet
        ) {
            toast.error("Champs manquants", { description: "Complétez tous les champs." })
            return
        }

        const tmp = new FormData()
        tmp.append("genre", formData.genre)
        tmp.append("cheveux", formData.cheveux)
        tmp.append("position", formData.position)
        tmp.append("decor", formData.decor)
        tmp.append("filtre", formData.filtre)
        tmp.append("effet", formData.effet)
        tmp.append("userid", String(user?.user_id || ""))
        tmp.append("logo", formData.logoChoice)
        selectedFiles.forEach((f) => tmp.append("files", f, f.name))

        setWaitingOpen(true)

        const accessToken = await getAccessToken()

        try {
            const res = await fetch(IMAGE_ENHANCER_WEBHOOK_URL, {
                method: "POST",
                headers: {
                    include: "credentials",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: tmp,
            })

            const text = await res.text()
            if (res.status === 429) {
                toast.error("Limite atteinte", { description: "Veuillez patienter 60 secondes avant de réessayer." })
                return
            }
            if (!res.ok) throw new Error(`HTTP ${res.status} : ${text}`)

            toast.success("Succès ✅", { description: "Votre image est en cours de traitement." })

            navigate("/contentlist", { replace: true })
        } catch (err: unknown) {
            console.error(err)
        }
    }

    const sendCaptionOverlayWebhook = async () => {
        if (selectedFiles.length === 0) {
            toast.error("Image requise", { description: "Ajoutez une image à légender." })
            return
        }

        const primaryCaption = formData.captionText.trim()
        if (!primaryCaption) {
            toast.error("Texte requis", { description: "Saisissez un message." })
            return
        }

        const tmp = new FormData()
        tmp.append("image", selectedFiles[0], selectedFiles[0].name)
        tmp.append("caption", primaryCaption)
        tmp.append("caption_size", formData.captionSize)
        tmp.append("caption_position", formData.captionPosition)
        tmp.append("caption_alignment", formData.captionAlignment)
        tmp.append("userid", String(user?.user_id || ""))
        tmp.append("logo", formData.logoChoice)

        const accessToken = await getAccessToken()

        try {
            const res = await fetch(CAPTION_OVERLAY_WEBHOOK_URL, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    include: "credentials",
                },
                body: tmp,
            })

            const text = await res.text()
            if (res.status === 429) {
                toast.error("Limite atteinte", { description: "Veuillez patienter 60 secondes avant de réessayer." })
                return
            }
            if (!res.ok) throw new Error(`HTTP ${res.status} : ${text}`)

            /* Faudrais juste faire que ça ferme ensuite le Dialog et que ça laisse un message en mode c'est bon c'est fait mais que ça redirige quand même faire /contentlist */
            toast.success("Succès ✅", { description: "La légende a été ajoutée à votre image." })

            navigate("/contentlist", { replace: true })
        } catch (err: unknown) {
            console.error(err)
        }
    }

    const sendSmartCutoutWebhook = async () => {
        if (selectedFiles.length === 0) {
            toast.error("Image requise", { description: "Ajoutez une image à détourer." })
            return
        }

        const tmp = new FormData()
        tmp.append("image", selectedFiles[0], selectedFiles[0].name)
        tmp.append("userid", String(user?.user_id || ""))
        tmp.append("logo", formData.logoChoice)

        const accessToken = await getAccessToken()

        setWaitingOpen(true)

        try {
            const res = await fetch(SMART_CUTOUT_WEBHOOK_URL, {
                method: "POST",
                body: tmp,
                headers: {
                    include: "credentials",
                    Authorization: `Bearer ${accessToken}`,
                },
            })

            const ctype = res.headers.get("content-type") || ""
            const text = await res.text()

            if (res.status === 429) {
                toast.error("Limite atteinte", { description: "Veuillez patienter 60 secondes avant de réessayer." })
                return
            }
            if (!res.ok)
                throw new Error(`HTTP ${res.status} : ${text.slice(0, 300)}`)

            if (ctype.includes("application/json")) {
                const json = JSON.parse(text)
                if (json.url) {
                    return
                }
            }

            toast.success("Succès ✅", { description: "Votre image est en cours de traitement." })

            navigate("/contentlist", { replace: true })
        } catch (err: unknown) {
            console.error(err)
        }
    }

    const sendStorySuggesterWebhook = async () => {
        if (selectedFiles.length === 0) {
            toast.error("Image requise", { description: "Ajoutez une photo de vêtement." })
            return
        }

        const tmp = new FormData()
        tmp.append("files[]", selectedFiles[0], selectedFiles[0].name)
        tmp.append("userid", String(user?.user_id || ""))
        tmp.append("story_style", formData.storyStyle)
        tmp.append("story_tone", formData.storyTone)
        tmp.append("platform", formData.storyPlatform)
        tmp.append("language", formData.storyLanguage)

        const accessToken = await getAccessToken()

        toast.info("Envoi en cours…", { description: "Analyse de la photo en cours." })

        try {
            const res = await fetch(STORY_SUGGESTER_WEBHOOK_URL, {
                method: "POST",
                body: tmp,
                headers: {
                    include: "credentials",
                    Authorization: `Bearer ${accessToken}`,
                },
            })
            const text = await res.text()
            if (res.status === 429) {
                toast.error("Limite atteinte", { description: "Veuillez patienter 60 secondes avant de réessayer." })
                return
            }
            if (!res.ok) throw new Error(`HTTP ${res.status} : ${text}`)

            toast.success("Succès ✅", { description: "Suggestions story en cours de génération." })
            navigate("/contentlist", { replace: true })
        } catch (err: unknown) {
            console.error(err)
        }
    }

    const handleSend = async (appId: number) => {
        if (appId === 1) {
            if (selectedFiles.length === 0) {
                toast.error("Erreur", { description: "Veuillez sélectionner une image" })
                return
            }
            await sendToWebhook({
                link: DEFAULT_WEBHOOK_URL,
            })
            return
        }
        if (appId === 2) {
            await sendArtisticEnhancerWebhook()
            return
        }
        if (appId === 3) {
            await sendImageEnhancerWebhook()
            return
        }
        if (appId === 4) {
            await sendImageToVideoWebhook()
            return
        }
        if (appId === 5) {
            await sendCaptionOverlayWebhook()
            return
        }
        if (appId === 6) {
            await sendSmartCutoutWebhook()
            return
        }
        if (appId === 7) {
            await sendStorySuggesterWebhook()
        }
    }

    const removeFile = (index: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
    }

    return createElement(
        ContentContext,
        {
            value: {
                formData,
                updateField,
                selectedFiles,
                setSelectedFiles,
                openDialog,
                setOpenDialog,
                triggerFilePicker,
                fileInputRefs: fileInputRef,
                handleDecorSelect,
                handleSend,
                removeFile,
                waitingOpen,
                setWaitingOpen,
                htmlResult,
                setHtmlResult,
                resetForm,
                toast,
            },
        },
        children
    )
}

export const useContent = () => {
    const context = use(ContentContext)
    if (!context) {
        throw new Error("useContent must be used within a ContentProvider")
    }
    return context
}
