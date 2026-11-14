export type Make = { slug: string; name: string };

export type MakeLinked = { data: { make?: string | null } };

type Sources = Record<string, readonly MakeLinked[]>;

export type MakePage<S extends Sources> = { make: Make } & {
  [K in keyof S]: S[K][number][];
};

export function makePages<S extends Sources>(
  makes: readonly Make[],
  sources: S,
): MakePage<S>[] {
  return makes.flatMap((make) => {
    const held = Object.fromEntries(
      Object.entries(sources).map(([key, items]) => [
        key,
        items.filter((item) => item.data.make === make.slug),
      ]),
    );
    return Object.values(held).some((items) => items.length > 0)
      ? [{ make, ...held } as MakePage<S>]
      : [];
  });
}
