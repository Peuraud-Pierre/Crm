/* ─── Task card ───────────────────────────────────────────────── */

export const taskCard = {
    root: "group relative rounded-xl border bg-card shadow-sm transition-shadow duration-fast hover:shadow-md",
    overdue: "ring-1 ring-red-300 dark:ring-red-700",
    overlay: "rotate-2 scale-105 shadow-xl opacity-90",
    body: "space-y-3 p-4",
    footer: "space-y-2 border-t border-border/40 pt-2.5 mt-0.5",
    footerRow: "flex items-center justify-between gap-2",
    footerMeta: "text-[10px] text-muted-foreground/50",
    actionsWrapper:
        "flex items-center gap-0.5 transition-opacity opacity-0 group-hover:opacity-100",
    actionBtn:
        "flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground",
    titleEditing:
        "w-full rounded border border-primary/30 bg-background px-1.5 py-0.5 text-sm font-medium outline-none focus:ring-1 focus:ring-primary",
    titleDisplay:
        "line-clamp-3 text-sm font-medium leading-snug text-foreground",
    titleInteractive: "cursor-text hover:text-primary transition-colors",
}

/* ─── Due date chip ───────────────────────────────────────────── */

export const dueDateChip = {
    root: "flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
    overdue: "bg-destructive/15 text-destructive",
    today: "bg-warning/20 text-warning",
    soon: "bg-warning/10 text-warning",
    none: "bg-muted text-muted-foreground",
}

/* ─── Sidebar ─────────────────────────────────────────────────── */

export const sidebar = {
    root: "sticky top-0 flex h-[calc(100svh-4rem)] shrink-0 flex-col border-r bg-card transition-[width] duration-base",
    expanded: "w-60",
    collapsed: "w-12",
    header: "flex h-12 items-center justify-between border-b px-2 shrink-0",
    scrollArea: "flex-1 overflow-y-auto overflow-x-hidden py-2",
    sectionLabel:
        "px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
    divider: "mx-3 my-3 border-t",
    membersFooter: "shrink-0 border-t px-4 py-3",
    navItem: {
        base: "group relative flex w-full items-center gap-2.5 px-4 py-1.5 text-sm text-left transition-colors",
        active: "bg-primary/10 text-primary font-medium",
        inactive: "text-muted-foreground hover:bg-muted hover:text-foreground",
        muted: "text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground",
        indicator: "absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-primary",
    },
    sprintItem: {
        base: "flex flex-1 min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left transition-colors",
        active: "bg-primary/10 text-primary font-medium",
        inactive: "text-muted-foreground hover:bg-muted hover:text-foreground",
        archived: "opacity-60",
    },
    actionBtn:
        "flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground",
}

/* ─── Sprint info card ────────────────────────────────────────── */

export const sprintCard = {
    root: "rounded-xl border bg-card shadow-sm",
    topRow: "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-4 pb-3",
    progressArea: "space-y-1.5 px-4 pb-3",
    progressTrack: "h-1.5 w-full overflow-hidden rounded-full bg-secondary",
    progressFill: "h-full rounded-full bg-primary transition-[width] duration-slow",
    statsToggle:
        "flex w-full items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
    statsContent: "grid gap-4 border-t px-4 py-4 sm:grid-cols-2",
}

/* ─── View toggle ─────────────────────────────────────────────── */

export const viewToggle = {
    root: "flex items-center gap-1 rounded-lg border bg-muted/50 p-1",
    button: {
        base: "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active: "bg-background text-foreground shadow-sm",
        inactive: "text-muted-foreground hover:text-foreground",
    },
}
