export type Submit = ((operation: () => Promise<void>) => Promise<void>) & {
  busy: () => boolean;
  stop: () => void;
};

export function submitQueue(
  submit: HTMLButtonElement,
  onError: (error: unknown) => void,
  onIdle: () => void,
): Submit {
  const labelNode =
    submit.querySelector<HTMLElement>('[data-submit-label]') ?? submit;
  const label = labelNode.textContent ?? '';
  let busy = false;
  let stopped = false;
  let queued: (() => Promise<void>) | null = null;

  const execute = async (operation: () => Promise<void>): Promise<void> => {
    if (stopped) return;
    if (busy) {
      queued = operation;
      return;
    }
    busy = true;
    submit.disabled = true;
    onError(null);
    try {
      await operation();
    } catch (error) {
      onError(error);
    } finally {
      busy = false;
      labelNode.textContent = label;
      onIdle();
    }
    const next = queued;
    queued = null;
    if (next) await execute(next);
  };

  return Object.assign(execute, {
    busy: () => busy,
    stop: () => {
      stopped = true;
      queued = null;
    },
  });
}
