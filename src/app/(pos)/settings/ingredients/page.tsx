import { getIngredients, createIngredient, updateIngredient, deleteIngredient } from "@/server/settings/actions";
import { SettingsTablePage } from "../_settings-table-page";
import { getServerDictionary } from "@/lib/locale";

export default async function IngredientsPage() {
  const items = await getIngredients();
  const t = await getServerDictionary();
  return (
    <SettingsTablePage
      title={t.settings.ingredients}
      description={t.settings.ingredientPageDesc}
      data={items}
      columns={[
        { key: "name", label: t.settings.name, type: "text" as const },
        { key: "purchaseUnit", label: t.inventory.purchaseUnit, type: "text" as const },
        { key: "baseUnit", label: t.inventory.baseUnit, type: "text" as const },
        { key: "conversionFactor", label: t.inventory.conversionFactor, type: "number" as const },
        { key: "purchasePrice", label: t.inventory.unitPrice, type: "number" as const },
        { key: "costPerBaseUnit", label: t.inventory.costPrice, type: "number" as const },
        { key: "minStock", label: t.inventory.minStock, type: "number" as const },
      ]}
      onCreate={createIngredient}
      onUpdate={updateIngredient}
      onDelete={deleteIngredient}
    />
  );
}
