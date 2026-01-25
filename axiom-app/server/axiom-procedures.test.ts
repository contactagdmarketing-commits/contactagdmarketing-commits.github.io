import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("AXIOM Procedures", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const ctx = createPublicContext();
    caller = appRouter.createCaller(ctx);
  });

  it("should initialize a new session", async () => {
    const result = await caller.axiom.initSession({
      email: "test@example.com",
      name: "Test User",
    });

    expect(result).toBeDefined();
    expect(result.sessionId).toBeDefined();
    expect(result.sessionId.length).toBeGreaterThan(0);
    expect(result.initialMessage).toBeDefined();
    expect(result.initialMessage).toContain("AXIOM");
  });

  it("should retrieve session data", async () => {
    const initResult = await caller.axiom.initSession({
      email: "test2@example.com",
    });

    const result = await caller.axiom.getSession({
      sessionId: initResult.sessionId,
    });

    expect(result).toBeDefined();
    expect(result.session).toBeDefined();
    expect(result.session.email).toBe("test2@example.com");
    expect(result.session.phase).toBe("axiom");
    expect(result.history).toBeDefined();
    expect(result.history.length).toBeGreaterThan(0);
  });

  it("should track behavior", async () => {
    const result = await caller.tracking.trackBehavior({
      sessionId: "test-session-id",
      eventType: "page_view",
      eventData: { action: "test" },
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
}, { timeout: 30000 });
