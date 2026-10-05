import { getActiveAreasWithTables, getCategoriesWithProducts } from "@/server/order/actions";
import { getGeneralConfig } from "@/server/settings/actions";
import { OrderClient } from "./order-client";

export default async function OrderPage() {
  const [areas, categories, config] = await Promise.all([
    getActiveAreasWithTables(),
    getCategoriesWithProducts(),
    getGeneralConfig(),
  ]);
  return <OrderClient areas={areas} categories={categories} qrConfig={{ bankCode: config?.qrBankCode ?? "ICB", accountNumber: config?.qrAccountNumber ?? "11415686", accountName: config?.qrAccountName ?? "HO KINH DOANH SAI GON AN COFFEE" }} />;
}
