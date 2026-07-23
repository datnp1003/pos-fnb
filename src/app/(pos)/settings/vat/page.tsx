import { getVats, upsertVat } from "@/server/settings/actions";
import { SettingsTablePage } from "../_settings-table-page";
import { getServerDictionary } from "@/lib/locale";

export default async function VatPage() {
  const vats = await getVats();
  const t = await getServerDictionary();
  return (
    <SettingsTablePage
      title={t.settings.vat}
      description={t.settings.vatPageDesc}
      data={vats}
      columns={[
        { key: "code", label: t.inventory.code, type: "text" as const },
        { key: "name", label: t.settings.name, type: "text" as const },
        { key: "rate", label: t.common.taxRate || "Rate (%)", type: "percent" as const },
      ]}
      onUpdate={upsertVat}
    />
  );
}
