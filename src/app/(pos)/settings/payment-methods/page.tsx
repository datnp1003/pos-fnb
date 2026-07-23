import { getPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod } from "@/server/settings/actions";
import { SettingsTablePage } from "../_settings-table-page";
import { getServerDictionary } from "@/lib/locale";

export default async function PaymentMethodsPage() {
  const methods = await getPaymentMethods();
  const t = await getServerDictionary();
  return (
    <SettingsTablePage
      title={t.settings.paymentMethods}
      description={t.settings.paymentMethodPageDesc}
      data={methods}
      columns={[
        { key: "name", label: t.settings.name, type: "text" as const },
        { key: "code", label: t.inventory.code, type: "text" as const },
        { key: "sortOrder", label: t.settings.sortOrder, type: "number" as const },
      ]}
      onCreate={createPaymentMethod}
      onUpdate={updatePaymentMethod}
      onDelete={deletePaymentMethod}
    />
  );
}
