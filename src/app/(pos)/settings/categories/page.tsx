import { getCategories, createCategory, updateCategory, deleteCategory } from "@/server/settings/actions";
import { SettingsTablePage } from "../_settings-table-page";
import { getServerDictionary } from "@/lib/locale";

export default async function CategoriesPage() {
  const cats = await getCategories();
  const t = await getServerDictionary();
  return (
    <SettingsTablePage
      title={t.settings.categories}
      description={t.settings.categoryPageDesc}
      data={cats}
      columns={[
        { key: "name", label: t.settings.name, type: "text" as const },
        { key: "slug", label: "Slug", type: "text" as const },
        { key: "sortOrder", label: t.settings.sortOrder, type: "number" as const },
      ]}
      onCreate={createCategory}
      onUpdate={updateCategory}
      onDelete={deleteCategory}
    />
  );
}
