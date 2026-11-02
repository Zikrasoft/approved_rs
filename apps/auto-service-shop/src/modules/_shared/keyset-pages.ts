export const KEYSET_PAGE = 1000;

export async function* keysetPages<Row extends { id: string }>(
  page: (after: string | undefined, take: number) => Promise<Row[]>,
  take = KEYSET_PAGE,
): AsyncGenerator<Row[]> {
  let after: string | undefined;
  for (;;) {
    const rows = await page(after, take);
    yield rows;
    if (rows.length < take) return;
    after = rows[rows.length - 1].id;
  }
}
