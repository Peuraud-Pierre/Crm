import {
    Clapperboard,
    Images,
    MapPin,
    Scissors,
    Sparkles,
    Type,
    BookImage,
} from "lucide-react"
import { createElement } from "react"

import type { MiniApp } from "./interface"

export const miniApps: MiniApp[] = [
    {
        id: 1,
        title: "Analyser une photo",
        description: "Uploadez une ou plusieurs photos",
        icon: createElement(Images, { className: "w-8 h-8 text-primary" }),
        multipleFiles: false,
        isRectoVerso: false,
        disabled: false,
        helpText:
            "Vous pouvez faire analyser un vêtement ici afin d'obtenir des renseignements.",
    },
    {
        id: 2,
        title: "Artistic Fripes",
        description: "Créez un visuel artistique.",
        icon: createElement(MapPin, { className: "w-8 h-8 text-primary" }),
        multipleFiles: false,
        isRectoVerso: false,
        disabled: true,
    },
    {
        id: 3,
        title: "Studio Fripes",
        description: "Sublimez vos pièces avec styles.",
        icon: createElement(Sparkles, { className: "w-8 h-8 text-primary" }),
        multipleFiles: false,
        isRectoVerso: true,
        disabled: false,
        helpText:
            "Mettez ici une photo d'un vêtement pour créer un contenu qui met en valeur votre vêtement prêt à être posté sur vos réseaux.",
    },
    {
        id: 4,
        title: "Cinémagique",
        description: "Générez une courte vidéo immersive à partir d'une photo.",
        icon: createElement(Clapperboard, {
            className: "w-8 h-8 text-primary",
        }),
        multipleFiles: false,
        isRectoVerso: false,
        disabled: false,
        helpText:
            "Déposez une image : elle sera animée en une boucle vidéo prête à être partagée.",
    },
    {
        id: 5,
        title: "Flash Caption",
        description: "Ajoutez un slogan court sur votre visuel en un instant.",
        icon: createElement(Type, { className: "w-8 h-8 text-primary" }),
        multipleFiles: false,
        isRectoVerso: false,
        disabled: false,
        helpText:
            "Téléchargez une image, tapez un message (60 caractères) et récupérez la version légendée.",
    },
    {
        id: 6,
        title: "Détourage Fantôme",
        description:
            "Isoler automatiquement un élément précis avec transparence.",
        icon: createElement(Scissors, { className: "w-8 h-8 text-primary" }),
        multipleFiles: false,
        isRectoVerso: false,
        disabled: false,
        helpText:
            "Indiquez la zone à conserver, nous livrons un PNG détouré prêt pour vos montages.",
    },
    {
        id: 7,
        title: "Story Creator",
        description:
            "Analysez une photo et obtenez des suggestions de texte story avec style.",
        icon: createElement(BookImage, { className: "w-8 h-8 text-primary" }),
        multipleFiles: false,
        isRectoVerso: false,
        disabled: false,
        helpText:
            "Uploadez une photo de vêtement, choisissez un style et une plateforme : l'IA suggère des captions, hashtags et concepts story prêts à poster.",
    },
]

export const DEFAULT_WEBHOOK_URL =
    "https://n8n.nokk-project.example/webhook/image_analysis"
export const ARTISTIC_WEBHOOK_URL =
    "https://n8n.nokk-project.example/webhook/artistic_enhancer"
export const IMAGE_ENHANCER_WEBHOOK_URL =
    "https://n8n.nokk-project.example/webhook/image_enhancer"
export const IMAGE_TO_VIDEO_WEBHOOK_URL =
    "https://n8n.nokk-project.example/webhook/video_creation"
export const CAPTION_OVERLAY_WEBHOOK_URL =
    "https://n8n.nokk-project.example/webhook/image_caption"
export const SMART_CUTOUT_WEBHOOK_URL =
    "https://n8n.nokk-project.example/webhook/image_smart_cutout"
export const STORY_SUGGESTER_WEBHOOK_URL =
    "https://n8n.nokk-project.example/webhook/story_suggester"

export const GENRE_OPTIONS = [
    { value: "homme", label: "Homme" },
    { value: "femme", label: "Femme" },
]

export const CHEVEUX_OPTIONS = [
    { value: "long", label: "Long" },
    { value: "court", label: "Court" },
]

export const POSITION_OPTIONS = [
    { value: "face", label: "Face" },
    { value: "dos", label: "Dos" },
]

export const FILTER_OPTIONS = [
    { value: "standard", label: "Standard" },
    { value: "sepia", label: "Sepia" },
    { value: "noir_blanc", label: "Noir et blanc" },
    { value: "rose", label: "Rose" },
]

export const EFFECT_OPTIONS = [
    { value: "standard", label: "Standard" },
    { value: "myst", label: "Myst" },
    { value: "polaroid", label: "Polaroid" },
    { value: "dreamy", label: "Dreamy" },
    { value: "appareil_jetable", label: "Appareil jetable" },
    { value: "argentic", label: "Argentic" },
    { value: "stardust", label: "Star dust" },
]

export const DECOR_OPTIONS = [
    { value: "studio_photo", label: "Studio photo" },
    { value: "universite_us", label: "Université US" },
    { value: "stade_foot", label: "Stade de foot" },
    { value: "basketball_us", label: "Basketball US" },
    { value: "las_vegas", label: "Las Vegas" },
    { value: "nevada", label: "Nevada" },
    { value: "paris_street", label: "Paris street" },
    { value: "diner", label: "Diner" },
    { value: "hotel", label: "Hotel" },
]

export const LOGO_OPTIONS = [
    { value: "nokk_project", label: "Nokk_project" },
    { value: "kiloshop", label: "Kiloshop" },
]

export const CAPTION_SIZE_OPTIONS = [
    { value: "gros", label: "Gros" },
    { value: "moyen", label: "Moyen" },
    { value: "petit", label: "Petit" },
]

export const CAPTION_POSITION_OPTIONS = [
    { value: "haut", label: "Haut" },
    { value: "milieu", label: "Milieu" },
    { value: "bas", label: "Bas" },
]

export const CAPTION_ALIGNMENT_OPTIONS = [
    { value: "gauche", label: "Gauche" },
    { value: "centre", label: "Centre" },
    { value: "droite", label: "Droite" },
]

export const HIGHLIGHT_COLOR_OPTIONS = [
    // eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4)
    { value: "#FEC10B", label: "Jaune" },
    // eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4)
    { value: "#1E1A34", label: "Bleu foncé" },
    // eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4)
    { value: "#19752A", label: "Vert" },
    // eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4)
    { value: "#FF0000", label: "Rouge" },
]

export const STORY_STYLE_OPTIONS = [
    { value: "vintage", label: "Vintage" },
    { value: "casual", label: "Casual" },
    { value: "luxe", label: "Luxe" },
    { value: "streetwear", label: "Streetwear" },
    { value: "editorial", label: "Éditorial" },
]

export const STORY_TONE_OPTIONS = [
    { value: "inspirant", label: "Inspirant" },
    { value: "fun", label: "Fun" },
    { value: "mystérieux", label: "Mystérieux" },
    { value: "minimaliste", label: "Minimaliste" },
]

export const STORY_PLATFORM_OPTIONS = [
    { value: "instagram", label: "Instagram" },
    { value: "tiktok", label: "TikTok" },
    { value: "facebook", label: "Facebook" },
]

export const STORY_LANGUAGE_OPTIONS = [
    { value: "français", label: "Français" },
    { value: "anglais", label: "Anglais" },
    { value: "franglais", label: "Franglais" },
]
