import { useCallback, useEffect, useState } from "react"
import type { CryptedMessage } from "../hooks/useCryptedChat"

export type ZoomedImage = {
    url: string
    name?: string | null
}

export function useMessageAttachments() {
    const [zoomedImage, setZoomedImage] = useState<ZoomedImage | null>(null)

    const openImage = useCallback((url: string, name?: string | null) => {
        setZoomedImage({ url, name })
    }, [])

    const closeImage = useCallback(() => {
        setZoomedImage(null)
    }, [])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setZoomedImage(null)
            }
        }

        if (zoomedImage) {
            window.addEventListener("keydown", handleKeyDown)
        }

        return () => {
            window.removeEventListener("keydown", handleKeyDown)
        }
    }, [zoomedImage])

    const getMessagePreviewData = useCallback((message: CryptedMessage) => {
        const hasImage = !!message.image_url
        const hasFile = !!message.file_url
        return {
            isImage: hasImage,
            isFile: hasFile,
            hasText: !hasImage && !hasFile,
        }
    }, [])

    return {
        zoomedImage,
        openImage,
        closeImage,
        getMessagePreviewData,
    }
}
