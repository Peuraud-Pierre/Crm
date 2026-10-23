import { beforeEach, expect, rstest, test } from "@rstest/core";
import { render, screen } from "@testing-library/react";

const mocks = rstest.hoisted(() => ({
    listFactors: rstest.fn(),
    toast: {
        message: rstest.fn(),
        error: rstest.fn(),
        success: rstest.fn(),
    },
}));

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        auth: {
            mfa: {
                listFactors: mocks.listFactors,
                enroll: rstest.fn(),
                challenge: rstest.fn(),
                verify: rstest.fn(),
                unenroll: rstest.fn(),
            },
        },
    },
}));

rstest.mock("sonner", () => ({
    toast: mocks.toast,
}));

import MfaSection from "./MfaSection";

beforeEach(() => {
    rstest.clearAllMocks();
    mocks.listFactors.mockResolvedValue({ data: { all: [] }, error: null });
});

test("MfaSection renders header", async () => {
    render(<MfaSection />);

    expect(screen.getByText("Sécurité du compte")).toBeInTheDocument();
});
