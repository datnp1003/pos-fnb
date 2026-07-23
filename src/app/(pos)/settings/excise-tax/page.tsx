import { getExciseTaxes, upsertExciseTax } from "@/server/settings/actions";
import { SettingsTablePage } from "../_settings-table-page";
import { getServerDictionary } from "@/lib/locale";

export default async function ExciseTaxPage() {
  const taxes = await getExciseTaxes();
  const t = await getServerDictionary();
  return (
    <SettingsTablePage
      title={t.settings.exciseTax}
      description={t.settings.exciseTaxPageDesc}
      data={taxes}
      columns={[
        { key: "code", label: t.inventory.code, type: "text" as const },
        { key: "name", label: t.settings.name, type: "text" as const },
        { key: "rate", label: t.common.taxRate || "", type: "percent" as const },
      ]}
      onUpdate={upsertExciseTax}
    />
  );
}
