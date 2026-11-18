const issued = new WeakMap<object, number>();

export const renderId = (render: object): string => {
  const next = (issued.get(render) ?? 0) + 1;
  issued.set(render, next);
  return String(next);
};
