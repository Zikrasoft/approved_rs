import { type ReactNode, useEffect, useRef, useState } from 'react';

export const ScrollArea = ({ children }: { children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  const measure = () => {
    const element = ref.current;
    if (element) {
      setMore(
        element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
      );
    }
  };

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (ref.current) {
      observer.observe(ref.current);
      if (ref.current.firstElementChild) {
        observer.observe(ref.current.firstElementChild);
      }
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative">
      <div ref={ref} className="overflow-x-auto" onScroll={measure}>
        {children}
      </div>
      {more && (
        <div
          aria-hidden
          className="from-ui-bg-base pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l to-transparent"
        />
      )}
    </div>
  );
};
