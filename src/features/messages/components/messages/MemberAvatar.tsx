import type { ReactNode } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/atoms/avatar"
import { resolveAvatarUrl } from "@/shared/lib/avatar"
import { cn } from "@/shared/lib/utils"
import { getInitials } from "../../utils/messageUtils"

export type MemberAvatarSize = "sm" | "md"

export type MemberAvatarProps = {
    /** Nom affiché : sert au fallback en initiales et au texte alternatif. */
    name: string
    avatarUrl?: string | null
    size?: MemberAvatarSize
    className?: string
    fallbackClassName?: string
    /**
     * Pastille de présence (ou tout autre marqueur) posée en bas à droite.
     * Le conteneur porte déjà `relative`, l'appelant n'a qu'à positionner.
     */
    badge?: ReactNode
    /**
     * Avatar purement décoratif : le nom est déjà écrit à côté. Évite qu'un
     * lecteur d'écran annonce deux fois la même personne.
     */
    decorative?: boolean
}

const SIZE_CLASSES: Record<MemberAvatarSize, string> = {
    sm: "size-7",
    md: "size-9",
}

const FALLBACK_TEXT: Record<MemberAvatarSize, string> = {
    sm: "text-3xs",
    md: "text-xs",
}

/**
 * Avatar d'un membre de conversation (contact, membre de groupe, expéditeur
 * d'un message).
 *
 * Existe parce que le même markup était recopié à quatre endroits de la
 * feature en `<img src={profile.avatar_url}>` brut — donc sans passer par
 * `resolveAvatarUrl()`, ce qui cassait tout avatar stocké en chemin relatif
 * plutôt qu'en URL absolue.
 *
 * Reste dans la feature et ne remonte pas dans le design system : il connaît
 * la notion de membre (DESIGN_SYSTEM.md §4, critère 1).
 */
export function MemberAvatar({
    name,
    avatarUrl,
    size = "md",
    className,
    fallbackClassName,
    badge,
    decorative,
}: MemberAvatarProps) {
    const src = resolveAvatarUrl(avatarUrl)

    return (
        <span className="relative inline-flex shrink-0">
            <Avatar
                className={cn(SIZE_CLASSES[size], className)}
                aria-hidden={decorative || undefined}
            >
                {src ? (
                    <AvatarImage
                        src={src}
                        alt={decorative ? "" : name}
                        className="object-cover"
                    />
                ) : null}
                <AvatarFallback
                    className={cn(
                        "font-semibold text-muted-foreground",
                        FALLBACK_TEXT[size],
                        fallbackClassName
                    )}
                >
                    {getInitials(name)}
                </AvatarFallback>
            </Avatar>
            {badge}
        </span>
    )
}
