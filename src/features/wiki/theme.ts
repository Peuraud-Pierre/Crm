// Tokens visuels propres à la feature wiki.
// Classes Tailwind regroupées par région d'UI (cf. stock/theme.ts).
// Reste sur les tokens shadcn de l'app (primary vert, muted, card, border).

export const WIKI_THEME = {
    layout: {
        // padding interne de la colonne de navigation arborescente
        sidebarInner: "p-3 md:p-4",
    },
    tree: {
        // rail vertical de profondeur
        rail: "border-l border-border/60",
        row: "group/row relative flex items-center gap-1 rounded-md pr-2 py-1.5 text-sm transition-colors cursor-pointer select-none",
        rowIdle: "text-foreground/80 hover:bg-muted hover:text-foreground",
        rowActive: "bg-primary/10 text-primary font-medium",
        // barre d'accent à gauche d'une ligne active
        activeBar:
            "absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-primary",
        chevron:
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-base",
        count: "ml-auto rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground tabular-nums",
        countActive: "bg-primary/15 text-primary",
    },
    card: {
        category:
            "group flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-[transform,box-shadow,border-color] hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5",
        article:
            "group flex flex-col gap-1.5 rounded-xl border bg-card p-4 text-left transition-[transform,box-shadow,border-color] hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5",
        iconWrap:
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground",
    },
    badge: {
        draft: "bg-warning-light text-warning border-warning/30",
        published: "bg-success-light text-success border-success/30",
    },
    // styling du markdown rendu (pas de @tailwindcss/typography dans le projet)
    markdown:
        "max-w-none text-[15px] leading-7 text-foreground/90 " +
        "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:mt-8 [&_h1]:mb-3 [&_h1]:text-foreground " +
        "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-7 [&_h2]:mb-2 [&_h2]:text-foreground [&_h2]:border-b [&_h2]:pb-1.5 " +
        "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-foreground " +
        "[&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 " +
        "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5 [&_li]:marker:text-muted-foreground " +
        "[&_a]:text-primary [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/30 hover:[&_a]:decoration-primary " +
        "[&_strong]:font-semibold [&_strong]:text-foreground " +
        "[&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-4 " +
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_code]:font-mono [&_code]:text-foreground " +
        "[&_pre]:rounded-xl [&_pre]:bg-foreground/[0.04] [&_pre]:border [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:my-4 [&_pre>code]:bg-transparent [&_pre>code]:p-0 " +
        "[&_table]:w-full [&_table]:my-4 [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:bg-muted/60 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 " +
        "[&_hr]:my-6 [&_hr]:border-border [&_img]:max-w-full [&_img]:rounded-xl [&_img]:border [&_img]:my-4",
} as const
