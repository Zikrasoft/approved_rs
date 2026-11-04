export const watchEvents = () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
};

export const loggedEvents = (event?: string): Record<string, unknown>[] =>
  (console.log as jest.Mock).mock.calls
    .map(([line]) => String(line))
    .filter((line) => line.startsWith('{"event":'))
    .map((line) => JSON.parse(line))
    .filter((logged) => !event || logged.event === event);
