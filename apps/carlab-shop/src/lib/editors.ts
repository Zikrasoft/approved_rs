import type { MedusaContainer } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

export type Editor = { email: string; name: string | null };

export async function withEditors<Row extends { updated_by?: string | null }>(
  scope: MedusaContainer,
  rows: Row[],
): Promise<(Row & { updated_by_user: Editor | null })[]> {
  const ids = [
    ...new Set(
      rows.flatMap(({ updated_by }) => (updated_by ? [updated_by] : [])),
    ),
  ];
  const users = ids.length
    ? await scope
        .resolve(Modules.USER)
        .listUsers(
          { id: ids },
          { select: ['id', 'email', 'first_name', 'last_name'], take: null },
        )
    : [];
  const editors = new Map(
    users.map(({ id, email, first_name, last_name }) => [
      id,
      {
        email,
        name: [first_name, last_name].filter(Boolean).join(' ') || null,
      },
    ]),
  );
  return rows.map((row) => ({
    ...row,
    updated_by_user: (row.updated_by && editors.get(row.updated_by)) || null,
  }));
}
