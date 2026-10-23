import { beforeEach, expect, rstest, test } from "@rstest/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mocks = rstest.hoisted(() => {
    const insert = rstest.fn();
    const select = rstest.fn();
    const single = rstest.fn();
    const del = rstest.fn();
    const eq = rstest.fn();
    const update = rstest.fn();
    const deleteEq = rstest.fn();
    const updateEq = rstest.fn();
    const channel = {
        on: rstest.fn().mockReturnThis(),
        subscribe: rstest.fn().mockReturnThis(),
    };
    const supabase = {
        from: rstest.fn(() => ({
            insert,
            select,
            single,
            delete: del,
            update,
            eq,
        })),
        channel: rstest.fn(() => channel),
        removeChannel: rstest.fn(),
    };

    insert.mockReturnValue({
        select: rstest.fn(() => ({
            single: rstest.fn().mockResolvedValue({
                data: {
                    id: "evt-1",
                    debut: "2024-01-01T00:00:00Z",
                    fin: "2024-01-01T01:00:00Z",
                },
                error: null,
            }),
        })),
    });
    select.mockReturnValue({ eq, single });
    single.mockResolvedValue({
        data: {
            id: "evt-1",
            debut: "2024-01-01T00:00:00Z",
            fin: "2024-01-01T01:00:00Z",
        },
        error: null,
    });
    eq.mockResolvedValue({
        data: [
            {
                id: "evt-1",
                debut: "2024-01-01T00:00:00Z",
                fin: "2024-01-01T01:00:00Z",
                client: null,
            },
        ],
        error: null,
    });
    del.mockReturnValue({ eq: deleteEq });
    update.mockReturnValue({ eq: updateEq });
    deleteEq.mockResolvedValue({ error: null });
    updateEq.mockResolvedValue({ error: null });

    return { insert, select, single, supabase };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: mocks.supabase,
}));

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    // Le nom `useAuth` doit correspondre au hook réellement mocké, on ne peut
    // pas le renommer sans casser le mock.
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix
    useAuth: () => ({ user: { user_id: "user-1" } }),
}));

// Intégrations calendrier (Apple/Amelia) hors périmètre de ce test unitaire :
// on les mocke pour n'exercer que la logique CRUD de useEvent. Sans ce mock,
// leurs implémentations réelles tournent — et useAppleAuth reboucle à l'infini
// ici, car le mock de useAuth renvoie un nouvel objet `user` à chaque rendu
// (loadConnection dépend de [user] → effet relancé → setState → re-rendu…),
// ce qui empêche act() de se stabiliser et fait timeout le test.
rstest.mock("@/features/calendar-integrations/apple/hooks/useAppleAuth", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix
    useAppleAuth: () => ({ syncEvent: rstest.fn().mockResolvedValue(undefined) }),
}));
rstest.mock("@/features/calendar-integrations/amelia", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix
    useAmeliaSync: () => ({ syncToAmelia: rstest.fn().mockResolvedValue(undefined) }),
}));

import { useEvent } from "./use_calendar";

// useEvent stocke ses événements dans le cache TanStack : un client neuf par
// rendu pour isoler les tests.
const renderUseEvent = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(() => useEvent(), { wrapper });
};

beforeEach(() => {
    rstest.clearAllMocks();
});

test("create_event_calendar replaces temp id with real id", async () => {
    const { result } = renderUseEvent();

    await waitFor(() => {
        expect(result.current.events.length).toBe(0);
    });

    await act(async () => {
        await result.current.create_event_calendar({
            nom: "Meeting",
            debut: "2024-01-01T00:00:00Z",
            fin: "2024-01-01T01:00:00Z",
            participants: "Bob",
            lieu: null,
            description: null,
        });
    });

    await waitFor(
        () => {
            expect(result.current.events.some((evt) => evt.id === "evt-1")).toBe(
                true
            );
        },
        { timeout: 2000 }
    );
});

// ─── Régressions : confirmation & commercial ────────────────────────────────
// Incident du 2026-09-09 : le bouton « Confirmer » passait l'événement brut
// (sans `owner`) à update_Event, qui écrivait customer = NULL. Le RDV perdait
// son commercial, sortait de l'agenda et n'était ni synchronisé Apple ni
// notifié par mail.

const updateSelectMock = rstest.fn();

const withUpdateSelect = () => {
    const update = mocks.supabase.from().update as ReturnType<typeof rstest.fn>;
    updateSelectMock.mockResolvedValue({
        data: [{ id: "evt-1", customer: "user-david", creator_id: "user-1" }],
        error: null,
    });
    update.mockReturnValue({
        eq: rstest.fn(() => ({ select: updateSelectMock })),
    });
    return update;
};

test("confirm_event ne touche jamais au commercial du RDV", async () => {
    const update = withUpdateSelect();
    const { result } = renderUseEvent();

    await act(async () => {
        await result.current.confirm_event({
            id: "evt-1",
            nom: "rdv physique achat",
            debut: "2024-01-01T09:00:00Z",
            fin: "2024-01-01T10:00:00Z",
            participants: null,
            lieu: null,
            description: null,
            confirmed: false,
            customer: { user_id: "user-david", full_name: "David" },
        });
    });

    expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ confirmed: true })
    );
    const written = update.mock.calls[0][0] as Record<string, unknown>;
    expect(written).not.toHaveProperty("customer");
    expect(written).not.toHaveProperty("owner");
});

test("confirmer n'envoie que confirmed : confirmed_by / creator_id / created_at sont posés par la base", async () => {
    const update = withUpdateSelect();
    const { result } = renderUseEvent();

    await act(async () => {
        await result.current.confirm_event({
            id: "evt-1",
            nom: "rdv physique achat",
            debut: "2024-01-01T09:00:00Z",
            fin: "2024-01-01T10:00:00Z",
            participants: null,
            lieu: null,
            description: null,
            confirmed: false,
            customer: { user_id: "user-david", full_name: "David" },
        });
    });

    const written = update.mock.calls[0][0] as Record<string, unknown>;
    expect(written).toMatchObject({ confirmed: true });
    // Écrits par trg_stamp_event_confirmation avec auth.uid() : le client ne
    // doit pas pouvoir les choisir.
    expect(written).not.toHaveProperty("confirmed_by");
    expect(written).not.toHaveProperty("creator_id");
    expect(written).not.toHaveProperty("created_at");
});

test("update_Event conserve le commercial d'un événement chargé depuis la base", async () => {
    const update = withUpdateSelect();
    const { result } = renderUseEvent();

    await act(async () => {
        await result.current.update_Event({
            id: "evt-1",
            nom: "rdv physique achat",
            debut: "2024-01-01T09:00:00Z",
            fin: "2024-01-01T10:00:00Z",
            participants: "Client",
            lieu: null,
            description: null,
            show: true,
            // Pas de `owner` : le commercial n'existe que dans `customer`.
            customer: { user_id: "user-david", full_name: "David" },
        });
    });

    expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "user-david" })
    );
});
