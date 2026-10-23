import { expect, test } from "@rstest/core";
import { cn } from "./utils";

test("cn merges class names with tailwind conflict resolution", () => {
    expect(cn("p-2", "text-sm")).toBe("p-2 text-sm");
    expect(cn("p-2", "p-4")).toBe("p-4");
});
