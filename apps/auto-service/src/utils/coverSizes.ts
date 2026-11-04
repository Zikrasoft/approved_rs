type Dimensions = { width: number; height: number };

export const coverScale = ({ width, height }: Dimensions, boxAspect: number) =>
  Math.max(1, Math.round((width / height / boxAspect) * 100) / 100);

export const coverSizes = (sizes: string, scale: number) =>
  scale === 1
    ? sizes
    : sizes
        .split(',')
        .map((entry) => {
          const [, media = '', width] = entry
            .trim()
            .match(/^(\([^)]*\)\s+)?(.+)$/)!;
          return `${media}calc(${width} * ${scale})`;
        })
        .join(', ');
