import { DataTable } from "./data-table";

type Column = {
  key: string;
  label: string;
  type?: "text" | "number" | "percent";
};

type ActionFn = (...args: never[]) => Promise<unknown>;

type Props = Readonly<{
  title: string;
  description: string;
  data: Record<string, unknown>[];
  columns: Column[];
  onCreate?: ActionFn;
  onUpdate?: ActionFn;
  onDelete?: ActionFn;
}>;

/**
 * Shared shell for the simple "title + description + DataTable" settings pages.
 * Renders the exact same DOM the inline versions did — only the boilerplate
 * is shared. Pages still resolve their own dictionary and data.
 */
export function SettingsTablePage({ title, description, data, columns, onCreate, onUpdate, onDelete }: Props) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground mb-6">{description}</p>
      <DataTable
        data={data}
        columns={columns}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </div>
  );
}
