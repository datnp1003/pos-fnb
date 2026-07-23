import { getShifts, createShift, updateShift, deleteShift } from "@/server/settings/actions";
import { SettingsTablePage } from "../_settings-table-page";
import { getServerDictionary } from "@/lib/locale";

export default async function ShiftsPage() {
  const shifts = await getShifts();
  const t = await getServerDictionary();
  return (
    <SettingsTablePage
      title={t.settings.shifts}
      description={t.settings.shiftPageDesc}
      data={shifts}
      columns={[
        { key: "name", label: t.settings.name, type: "text" as const },
        { key: "startTime", label: t.common.startTime || "", type: "text" as const },
        { key: "endTime", label: t.common.endTime || "", type: "text" as const },
      ]}
      onCreate={createShift}
      onUpdate={updateShift}
      onDelete={deleteShift}
    />
  );
}
