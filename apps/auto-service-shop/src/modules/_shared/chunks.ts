export const ID_CHUNK = 2000;

export const chunksOf = <T>(items: T[], size = ID_CHUNK): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
