import { miniApps } from "@/features/content/components/App"
import { ArtisticFripeGenerator } from "@/features/content/components/App/ArtisticFripe/ArtisticFripeGenerator"
import { CinemagiqueGenerator } from "@/features/content/components/App/Cinemagique/CinemagiqueGenerator"
import { FlashCaptionGenerator } from "@/features/content/components/App/FlashCaption/FlashCaptionGenerator"
import { GhostCutoutGenerator } from "@/features/content/components/App/GhostCutout/GhostCutoutGenerator"
import { StorySuggesterGenerator } from "@/features/content/components/App/StorySuggester/StorySuggesterGenerator"
import { PhotoAnalyzerGenerator } from "@/features/content/components/App/PhotoAnalyzer/PhotoAnalyzerGenerator"
import { StudioFripesGenerator } from "@/features/content/components/App/StudioFripes/StudioFripesGenerator"
import { PageHelpBubble } from "@/shared/components/layout/PageHelpBubble"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { Dialog, DialogTrigger } from "@/shared/ui/atoms/dialog"
import { useContent } from "@/features/content/context/ContentProvider"

export default function Main() {
    const { openDialog, resetForm, setOpenDialog } = useContent()

    return (
        <div className="flex-1 flex flex-col">
            <main className="flex-1 p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        <h2 className="mb-2 text-base font-bold uppercase">
                            Avertissement et conditions d’utilisation
                        </h2>
                        <p className="font-medium">
                            Cet outil de génération d’images est mis à
                            disposition exclusivement dans le cadre d’un usage
                            professionnel, conforme aux valeurs éthiques et aux
                            règles de bonne conduite de l’entreprise. Il doit
                            être utilisé pour des finalités légitimes,
                            respectueuses des personnes, des marques et des
                            réglementations en vigueur. L’entreprise modère
                            l’ensemble des données et contenus produits. Toute
                            utilisation non éthique, inappropriée ou susceptible
                            de nuire à l’image de l’entreprise entraînera des
                            sanctions disciplinaires sévères.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {miniApps.map((app) => (
                            <Dialog
                                key={app.id}
                                open={openDialog === app.id}
                                onOpenChange={(open) => {
                                    if (open) {
                                        setOpenDialog(app.id)
                                        resetForm()
                                    } else {
                                        setOpenDialog(null)
                                    }
                                }}
                            >
                                <div className="relative">
                                    {app.helpText && (
                                        <div className="absolute right-3 top-3 z-10">
                                            <PageHelpBubble
                                                title={app.title}
                                                description={app.helpText}
                                            />
                                        </div>
                                    )}
                                    <DialogTrigger asChild>
                                        <Card
                                            variant="interactive"
                                            className={
                                                app.disabled
                                                    ? "opacity-50 pointer-events-none"
                                                    : ""
                                            }
                                        >
                                            <CardHeader className="text-center pb-4">
                                                <div className="flex justify-center mb-4">
                                                    {app.icon}
                                                </div>
                                                <CardTitle className="text-xl">
                                                    {app.title}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="text-center">
                                                <p className="text-muted-foreground">
                                                    {app.description}
                                                </p>
                                            </CardContent>
                                            {app.disabled && (
                                                // eslint-disable-next-line nokk-project/no-restricted-syntax -- scrim/overlay volontairement noir quel que soit le thème (design system §12.4)
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-lg font-semibold">
                                                    En cours de developpement
                                                </div>
                                            )}
                                        </Card>
                                    </DialogTrigger>
                                </div>

                                {/* App 1 */}
                                {app.id === 1 && (
                                    <PhotoAnalyzerGenerator MiniApp={app} />
                                )}

                                {/* App 2 */}
                                {app.id === 2 && (
                                    <ArtisticFripeGenerator MiniApp={app} />
                                )}

                                {/* App 3 - simplified, stable & responsive */}
                                {app.id === 3 && (
                                    <StudioFripesGenerator MiniApp={app} />
                                )}

                                {app.id === 4 && (
                                    <CinemagiqueGenerator MiniApp={app} />
                                )}

                                {app.id === 5 && (
                                    <FlashCaptionGenerator MiniApp={app} />
                                )}

                                {app.id === 6 && (
                                    <GhostCutoutGenerator MiniApp={app} />
                                )}

                                {app.id === 7 && (
                                    <StorySuggesterGenerator MiniApp={app} />
                                )}
                            </Dialog>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    )
}
