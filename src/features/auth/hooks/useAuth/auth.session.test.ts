import { afterEach, beforeEach, expect, rstest, test } from "@rstest/core";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

const mocks = rstest.hoisted(() => {
    const getSession = rstest.fn();
    const listFactors = rstest.fn();
    const getAuthenticatorAssuranceLevel = rstest.fn();
    const onAuthStateChange = rstest.fn();
    const supabase = {
        auth: {
            getSession,
            mfa: { listFactors, getAuthenticatorAssuranceLevel },
            onAuthStateChange,
        },
    };
    const fetchUserProfile = rstest.fn();

    return {
        getSession,
        listFactors,
        getAuthenticatorAssuranceLevel,
        onAuthStateChange,
        fetchUserProfile,
        supabase,
    };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: mocks.supabase,
}));

rstest.mock("./auth.profile", () => ({
    fetchUserProfile: mocks.fetchUserProfile,
}));

import {
    loadSession,
    subscribeToAuthEvents,
    syncSessionWithProfile,
    validateMfaBeforeLogin,
} from "./auth.session";

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
    rstest.clearAllMocks();
    console.log = () => {};
    console.error = () => {};
});

afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
});

test("loadSession returns session", async () => {
    mocks.getSession.mockResolvedValue({
        data: { session: { user: { id: "user-1" } } },
    });

    await expect(loadSession()).resolves.toEqual({ user: { id: "user-1" } });
});

test("syncSessionWithProfile merges profile fields", async () => {
    mocks.fetchUserProfile.mockResolvedValue({ role: "Admin" });

    const session = { user: { id: "user-1" } } as unknown as Session;
    const result = await syncSessionWithProfile(session);

    // status forcé à "active" : la valeur en base est celle laissée par la
    // session précédente, la présence la réécrit dans la foulée.
    expect(result).toEqual({ id: "user-1", role: "Admin", status: "active" });
});

test("validateMfaBeforeLogin handles no session", async () => {
    const applySession = rstest.fn();
    const applyUser = rstest.fn();

    await validateMfaBeforeLogin(null, false, rstest.fn(), applySession, applyUser);

    expect(applySession).toHaveBeenCalledWith(null);
    expect(applyUser).toHaveBeenCalledWith(null);
});

test("validateMfaBeforeLogin sets requiresMfa when totp exists and aal1", async () => {
    mocks.listFactors.mockResolvedValue({
        data: { all: [{ factor_type: "totp", status: "verified" }] },
        error: null,
    });
    mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
        data: { currentLevel: "aal1" },
        error: null,
    });

    const applySession = rstest.fn();
    const applyUser = rstest.fn();
    const setRequiresMfa = rstest.fn();

    await validateMfaBeforeLogin(
        { user: { id: "user-1" } } as unknown as Session,
        false,
        setRequiresMfa,
        applySession,
        applyUser
    );

    expect(setRequiresMfa).toHaveBeenCalledWith(true);
    expect(applySession).not.toHaveBeenCalled();
});

test("subscribeToAuthEvents toggles mfa and updates user", async () => {
    let handler:
        | ((event: AuthChangeEvent, session: Session | null) => void)
        | null = null;
    mocks.onAuthStateChange.mockImplementation(
        (cb: (event: AuthChangeEvent, session: Session | null) => void) => {
            handler = cb;
            return { data: { subscription: { unsubscribe: rstest.fn() } } };
        }
    );

    mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
        data: { currentLevel: "aal2" },
    });
    mocks.fetchUserProfile.mockResolvedValue({ role: "Admin" });

    const updateSession = rstest.fn();
    const updateUser = rstest.fn();
    const setRequiresMfa = rstest.fn();
    const getRequiresMfa = rstest.fn(() => true);

    const unsubscribe = subscribeToAuthEvents(
        updateSession,
        updateUser,
        getRequiresMfa,
        setRequiresMfa
    );

    const authHandler = handler as
        | ((event: AuthChangeEvent, session: Session | null) => void)
        | null;
    if (!authHandler) throw new Error("Missing auth handler");

    await authHandler("SIGNED_IN", {
        user: { id: "user-1" },
    } as unknown as Session);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setRequiresMfa).toHaveBeenCalledWith(false);
    expect(updateSession).toHaveBeenCalled();
    expect(updateUser).toHaveBeenCalledWith({
        id: "user-1",
        role: "Admin",
        status: "active",
    });

    unsubscribe();
});
