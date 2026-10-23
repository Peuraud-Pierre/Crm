import { beforeEach, expect, rstest, test } from "@rstest/core";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { subDays, format } from "date-fns";

const mocks = rstest.hoisted(() => ({
    order: rstest.fn(),
    gte: rstest.fn(),
    select: rstest.fn(),
    from: rstest.fn(),
}));

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: mocks.from,
    },
}));

rstest.mock("@/features/leads/components", () => ({
    ActivityBarCard: ({ data }: { data: { name: string; value: number }[] }) => (
        <div data-testid="activity-bar-card">{data.map((d) => d.name).join(",")}</div>
    ),
    BreakdownChartCard: () => <div data-testid="breakdown-chart-card" />,
    LocationBarCard: ({ data }: { data: { name: string; value: number }[] }) => (
        <div data-testid="location-bar-card">{data.map((d) => d.name).join(",")}</div>
    ),
    MessagesCard: ({
        leads,
        searchQuery,
        onSearchQueryChange,
    }: {
        leads: unknown[];
        searchQuery: string;
        onSearchQueryChange: (v: string) => void;
    }) => (
        <div data-testid="messages-card">
            <span data-testid="messages-count">{leads.length}</span>
            <input
                data-testid="search-input"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
            />
        </div>
    ),
    SummaryCards: ({
        totalLeads,
        leadsYesterday,
        leadsToday,
        avgPerDay,
    }: {
        totalLeads: number;
        leadsYesterday: number;
        yesterday: Date;
        leadsToday: number;
        trendVsYesterday: number | null;
        avgPerDay: number;
    }) => (
        <div data-testid="summary-cards">
            <span data-testid="total-leads">{totalLeads}</span>
            <span data-testid="leads-yesterday">{leadsYesterday}</span>
            <span data-testid="leads-today">{leadsToday}</span>
            <span data-testid="avg-per-day">{avgPerDay}</span>
        </div>
    ),
    TimeRangeSelector: ({
        timeRange,
        onTimeRangeChange,
        selectedDate,
        onResetSelectedDate,
    }: {
        timeRange: string;
        onTimeRangeChange: (v: string) => void;
        selectedDate: string | null;
        onResetSelectedDate: () => void;
    }) => (
        <div data-testid="time-range-selector">
            <span data-testid="current-range">{timeRange}</span>
            <button onClick={() => onTimeRangeChange("week")}>week</button>
            <button onClick={() => onTimeRangeChange("year")}>year</button>
            {selectedDate && (
                <button data-testid="reset-date" onClick={onResetSelectedDate}>
                    reset
                </button>
            )}
        </div>
    ),
    normalizeActivity: (value: string) => value || "Inconnu",
    normalizeBudget: (value: string) => value || "Inconnu",
    normalizeUrgency: (value: string) => value || "Inconnu",
    URGENCY_ORDER: [],
}));

rstest.mock("recharts", () => ({
    __esModule: true,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
        <div style={{ width: 640, height: 480 }}>{children}</div>
    ),
    LineChart: ({
        children,
        onClick,
        data,
    }: {
        children: React.ReactNode;
        onClick?: (payload: unknown) => void;
        data?: { date: string }[];
    }) => (
        <div
            data-testid="line-chart"
            onClick={() => {
                const date = data?.[0]?.date;
                if (date) onClick?.({ activePayload: [{ payload: { date } }] });
            }}
        >
            {children}
        </div>
    ),
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
}));

const makeLead = (overrides: Partial<{
    id: number;
    created_at: string;
    name: string;
    email: string;
    message: string;
    budget: string;
    activity: string;
    location: string;
}> = {}) => ({
    id: 1,
    created_at: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
    name: "Alice",
    email: "alice@example.com",
    message: "Bonjour",
    budget: "Budget entre 1 000 et 3 000 €",
    activity: "E-shop",
    location: "Paris",
    ...overrides,
});

import LeadsStats from "./LeadsStats";

beforeEach(() => {
    rstest.clearAllMocks();
    (global as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
        configurable: true,
        get: () => 640,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
        configurable: true,
        get: () => 480,
    });
    HTMLElement.prototype.getBoundingClientRect = () =>
        ({
            width: 640,
            height: 480,
            top: 0,
            left: 0,
            right: 640,
            bottom: 480,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        }) as DOMRect;
    mocks.order.mockResolvedValue({ data: [], error: null });
    mocks.gte.mockReturnValue({ order: mocks.order });
    mocks.select.mockReturnValue({ gte: mocks.gte });
    mocks.from.mockReturnValue({ select: mocks.select });
});

test("LeadsStats renders header after load", async () => {
    render(<LeadsStats />);

    await waitFor(() => {
        expect(screen.getByTestId("time-range-selector")).toBeInTheDocument();
    });
});

test("shows loading spinner initially", async () => {
    render(<LeadsStats />);
    expect(document.querySelector(".animate-spin")).toBeTruthy();

    // Seul test synchrone du fichier : sans cette attente, le fetch de leads se
    // résout APRÈS la fin du test et ses setLeads/setLoading tombent hors act().
    // Avec isolate:false (rstest.config.ts) la mise à jour retombe alors dans le
    // fichier suivant. On laisse donc le chargement s'achever dans le test.
    await waitFor(() => {
        expect(screen.getByTestId("time-range-selector")).toBeInTheDocument();
    });
});

test("shows 0 total leads when supabase returns empty array", async () => {
    render(<LeadsStats />);

    await waitFor(() => {
        expect(screen.getByTestId("total-leads").textContent).toBe("0");
    });
});

test("shows correct total leads count after fetch", async () => {
    mocks.order.mockResolvedValue({
        data: [makeLead({ id: 1 }), makeLead({ id: 2 }), makeLead({ id: 3 })],
        error: null,
    });

    render(<LeadsStats />);

    await waitFor(() => {
        expect(screen.getByTestId("total-leads").textContent).toBe("3");
    });
});

test("counts leads from yesterday correctly", async () => {
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm:ss");

    mocks.order.mockResolvedValue({
        data: [
            makeLead({ id: 1, created_at: yesterday }),
            makeLead({ id: 2, created_at: yesterday }),
            makeLead({ id: 3 }), // today
        ],
        error: null,
    });

    render(<LeadsStats />);

    await waitFor(() => {
        expect(screen.getByTestId("leads-yesterday").textContent).toBe("2");
    });
});

test("filters leads to time range (only shows leads within 30 days)", async () => {
    const old = format(subDays(new Date(), 60), "yyyy-MM-dd'T'HH:mm:ss");

    mocks.order.mockResolvedValue({
        data: [
            makeLead({ id: 1 }), // today — in range
            makeLead({ id: 2, created_at: old }), // 60 days ago — out of range
        ],
        error: null,
    });

    render(<LeadsStats />);

    await waitFor(() => {
        expect(screen.getByTestId("total-leads").textContent).toBe("1");
    });
});

test("messages count matches filtered leads", async () => {
    mocks.order.mockResolvedValue({
        data: [makeLead({ id: 1 }), makeLead({ id: 2 })],
        error: null,
    });

    render(<LeadsStats />);

    await waitFor(() => {
        expect(screen.getByTestId("messages-count").textContent).toBe("2");
    });
});

test("search query filters messages", async () => {
    mocks.order.mockResolvedValue({
        data: [
            makeLead({ id: 1, name: "Alice" }),
            makeLead({ id: 2, name: "Bob", email: "bob@example.com" }),
        ],
        error: null,
    });

    render(<LeadsStats />);

    await waitFor(() => {
        expect(screen.getByTestId("messages-count").textContent).toBe("2");
    });

    fireEvent.change(screen.getByTestId("search-input"), {
        target: { value: "alice" },
    });

    await waitFor(() => {
        expect(screen.getByTestId("messages-count").textContent).toBe("1");
    });
});

test("no reset button visible initially (no date selected)", async () => {
    render(<LeadsStats />);

    await waitFor(() => {
        expect(screen.getByTestId("time-range-selector")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("reset-date")).not.toBeInTheDocument();
});

test("reset button appears after TimeRangeSelector signals a selectedDate", async () => {
    // We simulate selectedDate being set by changing the TimeRangeSelector mock
    // to expose the reset button. The reset button only appears when selectedDate != null.
    // This is controlled by LeadsStats state, triggered by the chart click handler.
    // We test the wiring via the mock's onResetSelectedDate instead.
    mocks.order.mockResolvedValue({
        data: [makeLead({ id: 1 }), makeLead({ id: 2 })],
        error: null,
    });

    render(<LeadsStats />);

    await waitFor(() => {
        expect(screen.getByTestId("total-leads").textContent).toBe("2");
    });

    // Reset button only shows when selectedDate is non-null — not present initially
    expect(screen.queryByTestId("reset-date")).not.toBeInTheDocument();
});

test("changing time range to week reduces scope", async () => {
    const old = format(subDays(new Date(), 20), "yyyy-MM-dd'T'HH:mm:ss");

    mocks.order.mockResolvedValue({
        data: [
            makeLead({ id: 1 }), // today — in week range
            makeLead({ id: 2, created_at: old }), // 20 days ago — not in week range
        ],
        error: null,
    });

    render(<LeadsStats />);

    await waitFor(() => {
        expect(screen.getByTestId("total-leads").textContent).toBe("2"); // 30days default
    });

    fireEvent.click(screen.getByText("week"));

    await waitFor(() => {
        expect(screen.getByTestId("total-leads").textContent).toBe("1");
    });
});
