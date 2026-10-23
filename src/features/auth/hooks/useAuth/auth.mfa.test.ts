import { afterEach, beforeEach, expect, rstest, test } from "@rstest/core";

const mocks = rstest.hoisted(() => {
    const listFactors = rstest.fn();
    const challenge = rstest.fn();
    const verify = rstest.fn();
    const getSession = rstest.fn();
    const toast = {
        error: rstest.fn(),
        success: rstest.fn(),
    };
    const supabase = {
        auth: {
            mfa: { listFactors, challenge, verify },
            getSession,
        },
    };
    return { listFactors, challenge, verify, getSession, toast, supabase };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: mocks.supabase,
}));

rstest.mock("sonner", () => ({
    toast: mocks.toast,
}));

import { getCurrentAAL, hasAAL2Enabled, verifyOtp } from "./auth.mfa";

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

test("verifyOtp returns error when no totp factor", async () => {
    mocks.listFactors.mockResolvedValue({
        data: { all: [] },
        error: null,
    });

    const result = await verifyOtp("000000");

    expect(result).toEqual({
        error: "Aucune application d'authentification n'est associée à ce compte.",
        code: "no-factor",
    });
    expect(mocks.toast.error).not.toHaveBeenCalled();
});

test("verifyOtp returns a French message on a wrong code", async () => {
    mocks.listFactors.mockResolvedValue({
        data: { all: [{ id: "factor-1", factor_type: "totp", status: "verified" }] },
        error: null,
    });
    mocks.challenge.mockResolvedValue({ data: { id: "challenge-1" }, error: null });
    mocks.verify.mockResolvedValue({
        data: null,
        error: { code: "mfa_verification_failed", message: "Invalid TOTP code entered" },
    });

    const result = await verifyOtp("000000");

    expect(result).toEqual({
        error: "Code incorrect. Vérifiez votre application et réessayez.",
        code: "mfa_verification_failed",
    });
});

test("verifyOtp challenges and verifies", async () => {
    mocks.listFactors.mockResolvedValue({
        data: { all: [{ id: "factor-1", factor_type: "totp", status: "verified" }] },
        error: null,
    });
    mocks.challenge.mockResolvedValue({
        data: { id: "challenge-1" },
        error: null,
    });
    mocks.verify.mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
    });

    const result = await verifyOtp("123456");

    expect(result).toEqual({ user: { id: "user-1" } });
    expect(mocks.toast.success).not.toHaveBeenCalled();
});

test("hasAAL2Enabled returns true when verified totp exists", async () => {
    mocks.listFactors.mockResolvedValue({
        data: { all: [{ factor_type: "totp", status: "verified" }] },
    });

    await expect(hasAAL2Enabled()).resolves.toBe(true);
});

test("getCurrentAAL returns session aal", async () => {
    mocks.getSession.mockResolvedValue({
        data: { session: { user: { aal: "aal2" } } },
    });

    await expect(getCurrentAAL()).resolves.toBe("aal2");
});
