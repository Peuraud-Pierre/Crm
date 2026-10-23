export const RECHARTS_TOOLTIP_THEME = {
    contentStyle: {
        backgroundColor: "hsl(var(--popover))",
        border: "1px solid hsl(var(--border))",
        borderRadius: 8,
        color: "hsl(var(--popover-foreground))",
    },
    labelStyle: {
        color: "hsl(var(--popover-foreground))",
        fontWeight: 600,
    },
    itemStyle: {
        color: "hsl(var(--popover-foreground))",
    },
} as const
