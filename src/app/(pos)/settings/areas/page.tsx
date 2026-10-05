import { getAreas, createArea, updateArea, deleteArea, createTable, updateTable, deleteTable } from "@/server/settings/actions";
import { AreasManager } from "../components-areas";
import { getServerDictionary } from "@/lib/locale";

// Area data comes from Prisma and must only be loaded at request time.
export const dynamic = "force-dynamic";

export default async function AreasPage() {
  const areas = await getAreas();
  const t = await getServerDictionary();
  return (
    <div>
      <h2 className="text-xl font-bold mb-2">{t.settings.sidebar.areasTables}</h2>
      <p className="text-sm text-muted-foreground mb-6">{t.settings.areaPageDesc}</p>
      <AreasManager
        areas={areas}
        createArea={createArea}
        updateArea={updateArea}
        deleteArea={deleteArea}
        createTable={createTable}
        updateTable={updateTable}
        deleteTable={deleteTable}
      />
    </div>
  );
}
