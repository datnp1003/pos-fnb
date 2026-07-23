import { describe, expect, it } from "vitest";

import { prismaMock } from "@/test/prisma-mock";
import {
  getAuditLogs,
  getLoginLogs,
  getOrderLogs,
  logAudit,
  logLogin,
  logOrder,
  onSignIn,
  onSignInFail,
} from "./actions";

describe("audit server actions", () => {
  it("logAudit writes an audit log row", async () => {
    prismaMock.auditLog.create.mockResolvedValue({} as never);
    await logAudit({ action: "UPDATE", entity: "product" });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: { action: "UPDATE", entity: "product" },
    });
  });

  it("getAuditLogs filters by entity when provided", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    await getAuditLogs("product", 10);
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith({
      where: { entity: "product" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  });

  it("getAuditLogs omits where when no entity", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    await getAuditLogs();
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  it("logLogin / getLoginLogs hit loginLog delegate", async () => {
    prismaMock.loginLog.create.mockResolvedValue({} as never);
    prismaMock.loginLog.findMany.mockResolvedValue([]);
    await logLogin({ username: "admin", success: true });
    await getLoginLogs();
    expect(prismaMock.loginLog.create).toHaveBeenCalled();
    expect(prismaMock.loginLog.findMany).toHaveBeenCalled();
  });

  it("logOrder / getOrderLogs hit orderLog delegate", async () => {
    prismaMock.orderLog.create.mockResolvedValue({} as never);
    prismaMock.orderLog.findMany.mockResolvedValue([]);
    await logOrder({ orderId: "o1", action: "OPEN" });
    await getOrderLogs("o1");
    expect(prismaMock.orderLog.create).toHaveBeenCalled();
    expect(prismaMock.orderLog.findMany).toHaveBeenCalledWith({
      where: { orderId: "o1" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  it("onSignIn / onSignInFail record login outcomes", async () => {
    prismaMock.loginLog.create.mockResolvedValue({} as never);
    await onSignIn("u1", "admin", "1.1.1.1", "agent");
    await onSignInFail("admin", "bad password", "1.1.1.1");
    expect(prismaMock.loginLog.create).toHaveBeenCalledTimes(2);
  });
});
