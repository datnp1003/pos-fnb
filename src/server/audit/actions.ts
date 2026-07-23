"use server";

import { db } from "@/lib/db";

// ============ Audit Log ============
export async function logAudit(params: {
  userId?: string;
  username?: string;
  action: string;
  entity: string;
  entityId?: string;
  changes?: string;
  ip?: string;
}) {
  await db.auditLog.create({ data: params });
}

export async function getAuditLogs(entity?: string, limit = 50) {
  return db.auditLog.findMany({
    where: entity ? { entity } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ============ Login Log ============
export async function logLogin(params: {
  userId?: string;
  username: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  reason?: string;
}) {
  await db.loginLog.create({ data: params });
}

export async function getLoginLogs(limit = 50) {
  return db.loginLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ============ Order Log ============
export async function logOrder(params: {
  orderId: string;
  orderNumber?: number;
  userId?: string;
  username?: string;
  action: string;
  detail?: string;
}) {
  await db.orderLog.create({ data: params });
}

export async function getOrderLogs(orderId?: string, limit = 50) {
  return db.orderLog.findMany({
    where: orderId ? { orderId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// Hook into Auth.js -> log login
export async function onSignIn(userId: string, username: string, ip?: string, userAgent?: string) {
  await logLogin({ userId, username, ip, userAgent, success: true });
}

export async function onSignInFail(username: string, reason: string, ip?: string) {
  await logLogin({ username, ip, reason, success: false });
}
