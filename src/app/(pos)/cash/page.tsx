import { getCashRegisters, getCashFlow, getCashFlowCategories } from "@/server/inventory/actions";
import { CashClient } from "./cash-client";

// Cash data comes from Prisma and must only be loaded at request time.
export const dynamic = "force-dynamic";

export default async function CashPage() {
  const today = new Date().toISOString().split("T")[0];
  const [registers, flows, categories] = await Promise.all([
    getCashRegisters(),
    getCashFlow(today),
    getCashFlowCategories(),
  ]);
  return <CashClient registers={registers} flows={flows} categories={categories} today={today} />;
}
