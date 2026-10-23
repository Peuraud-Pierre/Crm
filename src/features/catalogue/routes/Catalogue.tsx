import { CatalogueTools } from "@/features/catalogue/components/Tools/Tools"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/atoms/tabs"
import { Construction } from "lucide-react"
import { useState } from "react"

export default function Catalogue() {
    const [tab, setTab] = useState("catalogue")

    return (
        <div className="max-w-6xl mx-auto py-10 px-6 space-y-8">
            <header>
                <h1 className="text-3xl font-semibold text-foreground">
                    Gestion du Catalogue
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                    Gérez, analysez et suivez vos produits en toute simplicité.
                </p>
            </header>

            <Tabs value={tab} onValueChange={setTab} className="space-y-6">
                <TabsList indicator className="bg-card shadow-sm border border-border rounded-lg">
                    <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
                    <TabsTrigger value="analyse">Outils</TabsTrigger>
                    <TabsTrigger value="..." disabled>
                        ...
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="catalogue">
                    <Card className="bg-card rounded-2xl shadow-md border border-border">
                        <CardHeader className="flex flex-row items-center gap-3">
                            <Construction className="w-5 h-5 text-muted-foreground" />
                            <CardTitle className="text-lg font-medium text-foreground">
                                Work In Progress
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="text-muted-foreground">
                            Cette section est encore en développement. Revenez
                            plus tard pour découvrir les nouvelles
                            fonctionnalités du catalogue.
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="analyse">
                    <CatalogueTools />
                </TabsContent>
            </Tabs>
        </div>
    )
}
