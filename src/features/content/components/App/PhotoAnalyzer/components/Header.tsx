import { Button } from "@/shared/ui/atoms/button"
import { DialogTitle } from "@/shared/ui/atoms/dialog"
import { useContent } from "@/features/content/context/ContentProvider"
import { X, Download } from "lucide-react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { useCallback } from "react"

import { type MiniApp } from "../../../interface"

export function PhotoAnalyzerHeader({ MiniApp }: { MiniApp: MiniApp }) {
    const { htmlResult, setHtmlResult, setOpenDialog } = useContent()

    const downloadPdf = useCallback(async () => {
        if (!htmlResult) return

        const title = `${MiniApp.title} — Analyse photo`
        const footer = `Généré le ${new Date().toLocaleString("fr-FR")}`
        const fileName = `photo-analyzer-${new Date()
            .toISOString()
            .replace(/[:.]/g, "-")}.pdf`

        const container = document.createElement("div")
        container.style.position = "fixed"
        container.style.top = "-9999px"
        container.style.left = "-9999px"
        container.style.width = "1200px"
        container.innerHTML = htmlResult
        document.body.appendChild(container)

        const doc = new jsPDF("p", "pt", "a4")
        const pageWidth = doc.internal.pageSize.getWidth()
        const pageHeight = doc.internal.pageSize.getHeight()
        const contentY = 60

        doc.setFont("helvetica", "bold")
        doc.setFontSize(16)
        doc.text(title, 40, 30)
        doc.setFontSize(10)
        doc.setFont("helvetica", "normal")
        doc.text(footer, pageWidth - 40, 30, { align: "right" })

        try {
            const canvas = await html2canvas(container, {
                scale: 2,
                // eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4)
                backgroundColor: "#ffffff",
                width: container.scrollWidth,
                windowWidth: container.scrollWidth,
            })

            const imgData = canvas.toDataURL("image/png")
            const availableWidth = pageWidth - 80
            const aspectRatio = canvas.height / canvas.width
            let imgHeight = availableWidth * aspectRatio
            let imgWidth = availableWidth
            const maxImageHeight = pageHeight - contentY - 40

            if (imgHeight > maxImageHeight) {
                const scaleDown = maxImageHeight / imgHeight
                imgHeight = maxImageHeight
                imgWidth = imgWidth * scaleDown
            }

            doc.addImage(imgData, "PNG", 40, contentY, imgWidth, imgHeight)
        } catch (error) {
            console.error("Failed to render analysis for PDF download:", error)
            const sanitize = htmlResult
                .replace(/<br\s*\/?>/gi, "\n")
                .replace(/<[^>]+>/g, " ")
                .replace(/&nbsp;/gi, " ")
                .replace(/\s+/g, " ")
                .trim()

            const fallbackContent = sanitize || "Contenu indisponible"
            const lines = doc.splitTextToSize(fallbackContent, pageWidth - 80)
            let cursorY = contentY
            const lineHeight = 14

            lines.forEach((line: string) => {
                if (cursorY > pageHeight - 40) {
                    doc.addPage()
                    cursorY = contentY
                }
                doc.text(line, 40, cursorY)
                cursorY += lineHeight
            })
        } finally {
            document.body.removeChild(container)
        }

        doc.save(fileName)
    }, [htmlResult, MiniApp.title])

    return (
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-b">
            <DialogTitle className="flex items-center gap-2 !text-base font-semibold [&>svg]:h-5 [&>svg]:w-5">
                {MiniApp.icon}
                <span>{MiniApp.title}</span>
            </DialogTitle>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3"
                    onClick={downloadPdf}
                    disabled={!htmlResult}
                >
                    <Download className="w-4 h-4 mr-2" /> Télécharger
                </Button>
                <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 px-3"
                    onClick={() => {
                        setHtmlResult("")
                        setOpenDialog(null)
                    }}
                >
                    <X className="w-5 h-5 mr-2" /> Close
                </Button>
            </div>
        </div>
    )
}
