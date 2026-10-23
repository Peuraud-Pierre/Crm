import { beforeEach, expect, rstest, test } from "@rstest/core";
import { act, renderHook, waitFor } from "@testing-library/react";

const mocks = rstest.hoisted(() => {
    const getSession = rstest.fn();
    const supabase = {
        auth: {
            getSession,
        },
    };
    return { getSession, supabase };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: mocks.supabase,
}));

import { useShare } from "./useShare";

beforeEach(() => {
    rstest.clearAllMocks();
});

const createFetchResponse = (payload: unknown, ok = true, status = 200) => ({
    ok,
    status,
    json: rstest.fn().mockResolvedValue(payload),
    text: rstest.fn().mockResolvedValue(""),
});

test("useShare loadPermissions maps existing users", async () => {
    mocks.getSession.mockResolvedValue({
        data: { session: { access_token: "token" } },
    });

    const fetchMock = rstest
        .fn()
        .mockResolvedValue(createFetchResponse(["user-1", "user-2"]));
    rstest.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useShare({ baseUrl: "https://api" }));

    await act(async () => {
        await result.current.loadPermissions("photo-1");
    });

    await waitFor(() => {
        expect(result.current.shareTargets["user-1"]).toBe(true);
        expect(result.current.shareTargets["user-2"]).toBe(true);
    });
    expect(fetchMock).toHaveBeenCalled();

    rstest.unstubAllGlobals();
});

test("useShare submitShare sends add/remove requests", async () => {
    mocks.getSession.mockResolvedValue({
        data: { session: { access_token: "token" } },
    });

    const fetchMock = rstest
        .fn()
        .mockResolvedValue(createFetchResponse({}))
        .mockResolvedValueOnce(createFetchResponse(["user-1", "user-2"]));
    rstest.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useShare({ baseUrl: "https://api" }));

    await act(async () => {
        result.current.setItemIds(["p1"]);
        await result.current.loadPermissions("p1");
    });

    act(() => {
        result.current.setShareTargets({ "user-2": true, "user-3": true });
    });

    await act(async () => {
        await result.current.submitShare();
    });

    expect(fetchMock).toHaveBeenCalledWith(
        "https://api/share",
        expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenCalledWith(
        "https://api/unshare",
        expect.objectContaining({ method: "POST" })
    );

    rstest.unstubAllGlobals();
});

test("useShare unshareAll clears permissions and closes", async () => {
    mocks.getSession.mockResolvedValue({
        data: { session: { access_token: "token" } },
    });

    const fetchMock = rstest
        .fn()
        .mockResolvedValue(createFetchResponse({}))
        .mockResolvedValueOnce(createFetchResponse(["user-1"]));
    rstest.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useShare({ baseUrl: "https://api" }));

    await act(async () => {
        result.current.setShareOpen(true);
        result.current.setItemIds(["p1"]);
        await result.current.loadPermissions("p1");
    });

    await act(async () => {
        await result.current.unshareAll();
    });

    await waitFor(() => {
        expect(result.current.shareTargets).toEqual({});
        expect(result.current.shareOpen).toBe(false);
    });

    rstest.unstubAllGlobals();
});
