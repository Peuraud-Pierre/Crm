export const isVideoUrl = (url: string) => {
    try {
        const pathname = new URL(url).pathname.toLowerCase()
        return pathname.endsWith(".mp4")
    } catch {
        // fallback si url relative ou invalide
        return /\.mp4(\?|#|$)/i.test(url)
    }
}
