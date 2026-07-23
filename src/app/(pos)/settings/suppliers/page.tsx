import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from "@/server/inventory/supplier-actions";
import { SettingsTablePage } from "../_settings-table-page";
import { getServerDictionary } from "@/lib/locale";

export default async function SuppliersPage() {
  const items = await getSuppliers();
  const t = await getServerDictionary();
  return (
    <SettingsTablePage
      title={t.settings.suppliers}
      description={t.settings.supplierPageDesc}
      data={items}
      columns={[
        { key: "name", label: t.settings.name, type: "text" as const },
        { key: "contact", label: t.settings.contactPerson, type: "text" as const },
        { key: "phone", label: t.settings.phone, type: "text" as const },
        { key: "email", label: t.settings.email, type: "text" as const },
        { key: "address", label: t.settings.address, type: "text" as const },
      ]}
      onCreate={createSupplier}
      onUpdate={updateSupplier}
      onDelete={deleteSupplier}
    />
  );
}
