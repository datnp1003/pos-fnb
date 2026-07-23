import { describe, expect, it } from "vitest";
import authConfig from "./auth.config";

type JwtCb = NonNullable<NonNullable<typeof authConfig.callbacks>["jwt"]>;
type SessionCb = NonNullable<NonNullable<typeof authConfig.callbacks>["session"]>;

describe("auth.config", () => {
  it("uses jwt session strategy and login page", () => {
    expect(authConfig.session?.strategy).toBe("jwt");
    expect(authConfig.pages?.signIn).toBe("/login");
    expect(authConfig.trustHost).toBe(true);
  });

  it("jwt callback copies user fields onto the token", async () => {
    const jwt = authConfig.callbacks!.jwt as JwtCb;
    const user = {
      id: "u1",
      username: "admin",
      role: "Admin",
      permissions: '["*"]',
      scopes: '["*"]',
    };
    const token = await jwt({ token: {}, user } as never);
    expect(token).toMatchObject({
      id: "u1",
      username: "admin",
      role: "Admin",
      permissions: '["*"]',
      scopes: '["*"]',
    });
  });

  it("jwt callback leaves token untouched without a user", async () => {
    const jwt = authConfig.callbacks!.jwt as JwtCb;
    const token = await jwt({ token: { id: "existing" } } as never);
    expect(token).toEqual({ id: "existing" });
  });

  it("session callback projects token fields onto session.user", async () => {
    const session = authConfig.callbacks!.session as SessionCb;
    const result = await session({
      session: { user: { name: "x" } },
      token: { id: "u1", username: "admin", role: "Admin", permissions: "[]", scopes: "[]" },
    } as never);
    expect(result.user).toMatchObject({ id: "u1", username: "admin", role: "Admin" });
  });
});
