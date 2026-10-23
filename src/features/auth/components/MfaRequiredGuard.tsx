import { Link } from "react-router"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"

export function MfaRequiredGuard() {
    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
            <Card className="max-w-md w-full">
                <CardHeader className="flex flex-row items-center gap-3">
                    <ShieldAlert className="h-6 w-6 text-amber-500" />
                    <CardTitle>Authentification à deux facteurs requise</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Cette section contient des données sensibles. Pour y
                        accéder, vous devez activer la double authentification
                        (2FA) sur votre compte.
                    </p>
                    <Button asChild className="w-full">
                        <Link to="/profile">Activer la 2FA</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
