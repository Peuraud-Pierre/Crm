import { afterEach, beforeEach, expect, rstest, test } from "@rstest/core";
import { render, renderHook, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import type { AppUser } from "./types";

const mocks = rstest.hoisted(() => {
    const fetchPermissions = rstest.fn();
    const loadSession = rstest.fn();
    const validateMfaBeforeLogin = rstest.fn();
    const subscribeToAuthEvents = rstest.fn();
    const setupPresenceListeners = rstest.fn();
    const signIn = rstest.fn();
    const signUp = rstest.fn();
    const signOutAction = rstest.fn();
    const changePassword = rstest.fn();
    const verifyOtp = rstest.fn();

    return {
        fetchPermissions,
        loadSession,
        validateMfaBeforeLogin,
        subscribeToAuthEvents,
        setupPresenceListeners,
        signIn,
        signUp,
        signOutAction,
        changePassword,
        verifyOtp,
    };
});

rstest.mock("@/shared/lib/errorLogger", () => ({
    initErrorLogger: rstest.fn(),
    resetErrorLogger: rstest.fn(),
    errorLogger: { error: rstest.fn(), warn: rstest.fn(), info: rstest.fn() },
}));

rstest.mock("@/shared/components/misc/Permission", () => ({
    fetchPermissions: mocks.fetchPermissions,
}));

rstest.mock("./auth.session", () => ({
    loadSession: mocks.loadSession,
    validateMfaBeforeLogin: mocks.validateMfaBeforeLogin,
    subscribeToAuthEvents: mocks.subscribeToAuthEvents,
}));

rstest.mock("./auth.status", () => ({
    setupPresenceListeners: mocks.setupPresenceListeners,
}));

rstest.mock("./auth.actions", () => ({
    signIn: mocks.signIn,
    signUp: mocks.signUp,
    signOutAction: mocks.signOutAction,
    changePassword: mocks.changePassword,
}));

rstest.mock("./auth.mfa", () => ({
    verifyOtp: mocks.verifyOtp,
}));

import { AuthProvider, useAuth } from "./AuthProvider";

const originalConsoleError = console.error;

beforeEach(() => {
    rstest.clearAllMocks();
    console.error = () => {};
});

afterEach(() => {
    console.error = originalConsoleError;
});

test("AuthProvider loads session and exposes context values", async () => {
    const session = { user: { id: "user-1" } } as unknown as Session;
    const appUser = {
        id: "user-1",
        user_id: "user-1",
    } as unknown as AppUser;

    mocks.loadSession.mockResolvedValue(session);
    mocks.validateMfaBeforeLogin.mockImplementation(
        async (
            _session: Session | null,
            _requiresMfa: boolean,
            _setRequiresMfa: (value: boolean) => void,
            applySession: (value: Session | null) => void,
            applyUser: (value: AppUser) => void
        ) => {
            applySession(session);
            applyUser(appUser);
        }
    );
    mocks.fetchPermissions.mockResolvedValue({
        codes: new Set(["dashboard.view"]),
        allowedRoutes: ["route-1"],
    });
    const unsubscribe = rstest.fn();
    mocks.subscribeToAuthEvents.mockReturnValue(unsubscribe);
    mocks.setupPresenceListeners.mockReturnValue(rstest.fn());

    const Consumer = () => {
        const { user, loading, allowedRoutes, signIn } = useAuth();
        return (
            <div
                data-testid="auth-consumer"
                data-user={user?.user_id ?? "none"}
                data-loading={String(loading)}
                data-routes={JSON.stringify(allowedRoutes)}
                data-has-signin={String(signIn === mocks.signIn)}
            />
        );
    };

    const { getByTestId, unmount } = render(
        <AuthProvider>
            <Consumer />
        </AuthProvider>
    );

    const node = getByTestId("auth-consumer");

    await waitFor(() => {
        expect(node.getAttribute("data-loading")).toBe("false");
    });

    expect(node.getAttribute("data-user")).toBe("user-1");
    expect(node.getAttribute("data-has-signin")).toBe("true");
    await waitFor(() => {
        expect(node.getAttribute("data-routes")).toBe(
            JSON.stringify(["route-1"])
        );
    });
    expect(mocks.fetchPermissions).toHaveBeenCalledWith("user-1");
    expect(mocks.setupPresenceListeners).toHaveBeenCalledWith("user-1");

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
});

test("useAuth throws outside provider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
        "useAuthContext must be used within an AuthProvider"
    );
});
