export const TICKET_THEME = {
  page: {
    background: "bg-background",
    text: "text-foreground",
  },
  bar: {
    container: "bg-card border-border",
    separator: "bg-border",
    icon: "text-muted-foreground",
  },
  input: {
    base: "bg-background border-border",
    text: "text-foreground placeholder:text-muted-foreground",
    focus: "focus-visible:ring-ring/20"
  },
  toggleGroup: {
    container: "bg-muted/50 border-border",
    item: "text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
  },

  button: {
    primary: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm transition-colors font-bold",
    secondary: "bg-background text-foreground border border-border hover:bg-muted",
    success: "bg-success-light text-success border border-success/20 hover:bg-success/20",
    outline: "bg-background border-border text-foreground hover:bg-muted",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  },
  chat: {
    bubbleMe: "bg-primary text-primary-foreground",
    bubbleOthers: "bg-card border-border text-foreground"
  },

  kanban: {
    column: {
      bg: "bg-card",
      border: "border-border",
      headerBorder: "border-border",
      title: "text-foreground",
      scrollArea: "bg-muted/50"
    },
    emptyState: {
      text: "text-muted-foreground"
    }
  },
  colors: {
    priority: {
      nouveau: "bg-chart-4/20",
      urgente: "bg-destructive/20",
      haute: "bg-warning/20",
      moyenne: "bg-chart-2/20",
      basse: "bg-muted"
    },
    dot: {
      ouvert: "bg-chart-2",
      en_cours: "bg-warning",
      résolu: "bg-success",
      clos: "bg-muted-foreground"
    },
    countBadge: {
      nouveau: "bg-chart-4/15 text-chart-4",
      urgente: "bg-destructive-light text-destructive",
      haute: "bg-warning-light text-warning",
      moyenne: "bg-chart-2/15 text-chart-2",
      basse: "bg-muted text-muted-foreground"
    },
    category: {
      bug: "bg-destructive-light border-destructive/20 text-destructive",
      amelioration: "bg-chart-4/10 border-chart-4/20 text-chart-4",
      feedback: "bg-chart-2/10 border-chart-2/20 text-chart-2",
      autre: "bg-muted border-border text-muted-foreground"
    },
    statusBadge: {
      ouvert: "bg-chart-2/10 border-chart-2/20 text-chart-2",
      en_cours: "bg-warning-light border-warning/20 text-warning",
      résolu: "bg-success-light border-success/20 text-success",
      clos: "bg-muted border-border text-muted-foreground"
    }
  },

  card: {
    nouveau: {
      bg: "bg-card",
      border: "border-chart-4/20 hover:border-chart-4/60",
      text: "text-foreground",
      mutedText: "text-muted-foreground",
      icon: "text-chart-4",
      footerBorder: "border-chart-4/10",
      badge: "bg-chart-4/10 border-chart-4/20 text-chart-4",
      avatarBg: "bg-chart-4/10 border-chart-4/20 text-chart-4",
      timerBg: "bg-chart-4/10 text-chart-4",
      statusDot: "bg-chart-4"
    },
    urgente: {
      bg: "bg-card",
      border: "border-destructive/20 hover:border-destructive/60",
      text: "text-foreground",
      mutedText: "text-muted-foreground",
      icon: "text-destructive",
      footerBorder: "border-destructive/10",
      badge: "bg-destructive-light border-destructive/20 text-destructive",
      avatarBg: "bg-destructive-light border-destructive/20 text-destructive",
      timerBg: "bg-destructive-light text-destructive",
      statusDot: "bg-destructive"
    },
    haute: {
      bg: "bg-card",
      border: "border-warning/20 hover:border-warning/60",
      text: "text-foreground",
      mutedText: "text-muted-foreground",
      icon: "text-warning",
      footerBorder: "border-warning/10",
      badge: "bg-warning-light border-warning/20 text-warning",
      avatarBg: "bg-warning-light border-warning/20 text-warning",
      timerBg: "bg-warning-light text-warning",
      statusDot: "bg-warning"
    },
    moyenne: {
      bg: "bg-card",
      border: "border-chart-2/20 hover:border-chart-2/60",
      text: "text-foreground",
      mutedText: "text-muted-foreground",
      icon: "text-chart-2",
      footerBorder: "border-chart-2/10",
      badge: "bg-chart-2/10 border-chart-2/20 text-chart-2",
      avatarBg: "bg-chart-2/10 border-chart-2/20 text-chart-2",
      timerBg: "bg-muted text-muted-foreground",
      statusDot: "bg-chart-2"
    },
    basse: {
      bg: "bg-card",
      border: "border-border hover:border-muted-foreground/40",
      text: "text-foreground",
      mutedText: "text-muted-foreground",
      icon: "text-muted-foreground",
      footerBorder: "border-border/50",
      badge: "bg-muted border-border text-muted-foreground",
      avatarBg: "bg-muted border-border text-muted-foreground",
      timerBg: "bg-muted text-muted-foreground",
      statusDot: "bg-muted-foreground"
    }
  }
};
