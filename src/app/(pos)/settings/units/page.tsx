import { getUnits, createUnit, updateUnit, deleteUnit } from "@/server/settings/actions";
import { SettingsTablePage } from "../_settings-table-page";
import { getServerDictionary } from "@/lib/locale";

export default async function UnitsPage() {
  const units = await getUnits();
  const t = await getServerDictionary();
  return (
    <SettingsTablePage
      title={t.settings.units}
      description={t.settings.unitPageDesc}
      data={units}
      columns={[{ key: "name", label: t.settings.name, type: "text" as const }]}
      onCreate={createUnit}
      onUpdate={updateUnit}
      onDelete={deleteUnit}
    />
  );
}
