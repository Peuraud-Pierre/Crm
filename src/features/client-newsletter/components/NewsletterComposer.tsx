import { useState } from "react"
import { Send, FlaskConical, Users } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { ConfirmSendDialog } from "@/features/client-newsletter/components/ConfirmSendDialog"
import { useNewsletterSend } from "@/features/client-newsletter/hooks/data/useNewsletterSend"
import {
    getSubmitState,
    MAX_SUBJECT_LENGTH,
} from "@/features/client-newsletter/utils/submitState"

interface NewsletterComposerProps {
    recipientCount: number | null
    /** Échec du comptage (service injoignable, droits…) — affiché avec un bouton Réessayer. */
    countError: string | null
    onRetryCount: () => void
    hasActiveSend: boolean
    onSent: () => void
}

export function NewsletterComposer({
    recipientCount,
    countError,
    onRetryCount,
    hasActiveSend,
    onSent,
}: NewsletterComposerProps) {
    const [subject, setSubject] = useState("")
    const [message, setMessage] = useState("")
    const [confirmOpen, setConfirmOpen] = useState(false)
    const { testing, sending, sendTest, send } = useNewsletterSend()

    const state = getSubmitState({
        subject,
        message,
        recipientCount,
        hasActiveSend,
        busy: testing || sending,
    })
    const draft = { subject: subject.trim(), message: message.trim() }

    const handleConfirm = async () => {
        setConfirmOpen(false)
        if (await send(draft)) {
            setSubject("")
            setMessage("")
            onSent()
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" />
                    {countError
                        ? countError
                        : recipientCount === null
                          ? "Comptage des abonnés…"
                          : `${recipientCount} client${recipientCount > 1 ? "s" : ""} abonné${recipientCount > 1 ? "s" : ""} recevr${recipientCount > 1 ? "ont" : "a"} ce mail`}
                    {countError && (
                        <Button variant="outline" size="sm" onClick={onRetryCount}>
                            Réessayer
                        </Button>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="newsletter-subject">Sujet</Label>
                    <Input
                        id="newsletter-subject"
                        value={subject}
                        maxLength={MAX_SUBJECT_LENGTH}
                        onChange={e => setSubject(e.target.value)}
                        placeholder="Ex. : Nouvel arrivage de vestes vintage"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="newsletter-message">Message</Label>
                    <Textarea
                        id="newsletter-message"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={12}
                        placeholder={"Bonjour,\n\n…"}
                    />
                    <p className="text-xs text-muted-foreground">
                        Les retours à la ligne sont conservés. Un lien de
                        désinscription est ajouté automatiquement en bas du mail.
                    </p>
                </div>
                {state.reason && (
                    <p className="text-sm text-muted-foreground">{state.reason}</p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                    <Button
                        variant="outline"
                        disabled={!state.canTest}
                        onClick={() => void sendTest(draft)}
                    >
                        <FlaskConical className="h-4 w-4" />
                        {testing ? "Envoi du test…" : "M'envoyer un test"}
                    </Button>
                    <Button
                        disabled={!state.canSend}
                        onClick={() => setConfirmOpen(true)}
                    >
                        <Send className="h-4 w-4" />
                        {sending ? "Lancement…" : "Envoyer"}
                    </Button>
                </div>
            </CardContent>
            <ConfirmSendDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                recipientCount={recipientCount ?? 0}
                subject={draft.subject}
                onConfirm={() => void handleConfirm()}
            />
        </Card>
    )
}
