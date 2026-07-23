import type { PrismaClient } from "@prisma/client";
import type { Mock } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";

type AnyMock = Mock<(...args: never[]) => unknown>;
type LooseMock<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => unknown
    ? AnyMock
    : T[K] extends object
      ? LooseMock<T[K]>
      : T[K];
};

export type PrismaMock = DeepMockProxy<PrismaClient> & LooseMock<PrismaClient>;

export const prismaMock = mockDeep<PrismaClient>() as unknown as PrismaMock;

export function resetPrismaMock() {
  mockReset(prismaMock);
}
