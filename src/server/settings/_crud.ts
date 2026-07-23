import { revalidatePath } from "next/cache";

/**
 * Minimal Prisma delegate shape needed for simple CRUD.
 * Each `db.<model>` is cast to this via `as unknown as CrudDelegate`.
 */
export interface CrudDelegate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (args: { data: any }) => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (args: { where: { id: string }; data: any }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
}

export interface CrudOptions {
  model: CrudDelegate;
  /** Path to revalidate after every mutation. */
  path: string;
  /** Optional transform applied to the create payload (e.g. default sortOrder). */
  prepareCreate?: (data: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Builds create/update/remove actions for an entity with the canonical
 * "mutate then revalidatePath" pattern. Behavior is identical to the inline
 * versions it replaces — only the boilerplate is shared.
 */
export function makeCrud({ model, path, prepareCreate }: CrudOptions) {
  return {
    async create(data: Record<string, unknown>) {
      await model.create({ data: prepareCreate ? prepareCreate(data) : data });
      revalidatePath(path);
    },
    async update(id: string, data: Record<string, unknown>) {
      await model.update({ where: { id }, data });
      revalidatePath(path);
    },
    async remove(id: string) {
      await model.delete({ where: { id } });
      revalidatePath(path);
    },
  };
}
