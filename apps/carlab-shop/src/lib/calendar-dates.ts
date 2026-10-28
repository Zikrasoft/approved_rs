import { builtins, setTypeParser } from 'pg-types';

export const readCalendarDatesAsText = (): void =>
  setTypeParser(builtins.DATE, (day) => day);
