import { Button } from "@/shared/ui/atoms/button"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/shared/ui/atoms/sheet"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { useProjectListContext } from "@/features/projects/hooks/context/projectListContext"
import { useProjectMembersContext } from "@/features/projects/hooks/context/projectMembersContext"
import { cn } from "@/shared/lib/utils"

export function InviteMember() {
    const { submitting, handleInviteFromDirectory } = useProjectListContext()
    const {
        inviteMemberOpen,
        setInviteMemberOpen,
        inviteSearch,
        setInviteSearch,
        filteredInviteMembers,
    } = useProjectMembersContext()

    return (
        <Sheet open={inviteMemberOpen} onOpenChange={setInviteMemberOpen}>
            <SheetContent className="flex w-full flex-col sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>Inviter un membre</SheetTitle>
                    <SheetDescription>
                        Sélectionnez un collaborateur du service IT pour
                        l'ajouter au projet.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 space-y-4 overflow-y-auto py-2">
                    <div className="space-y-2">
                        <Label htmlFor="invite-search">Rechercher</Label>
                        <Input
                            id="invite-search"
                            placeholder="Nom ou email"
                            value={inviteSearch}
                            onChange={(event) =>
                                setInviteSearch(event.target.value)
                            }
                        />
                    </div>

                    {filteredInviteMembers.length > 0 ? (
                        <div className="space-y-2">
                            <Label>Membres IT disponibles</Label>
                            <div className="space-y-1 rounded-md border border-dashed bg-muted/30 p-2">
                                {filteredInviteMembers.map((member) => {
                                    const disabled =
                                        submitting === `invite:${member.user_id}`
                                    return (
                                        <button
                                            type="button"
                                            key={member.user_id}
                                            disabled={disabled}
                                            onClick={() =>
                                                handleInviteFromDirectory(member)
                                            }
                                            className={cn(
                                                "flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-left text-xs transition",
                                                disabled
                                                    ? "cursor-not-allowed opacity-70"
                                                    : "border-transparent hover:border-primary/40 hover:bg-primary/5"
                                            )}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-medium text-foreground">
                                                    {member.full_name ??
                                                        member.email ??
                                                        "Collaborateur"}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground">
                                                    {member.email ??
                                                        "Email manquant"}
                                                </span>
                                            </div>
                                            <span className="text-[11px] font-medium">
                                                Ajouter
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            Aucun membre IT disponible à ajouter.
                        </p>
                    )}
                </div>

                <SheetFooter>
                    <Button
                        variant="outline"
                        onClick={() => setInviteMemberOpen(false)}
                    >
                        Fermer
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
