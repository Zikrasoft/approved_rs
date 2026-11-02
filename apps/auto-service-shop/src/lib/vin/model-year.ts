const VIN_YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';
const VIN_YEAR_CYCLES = [1980, 2010, 2040];

export const vinModelYears = (vin: string): number[] => {
  const code = VIN_YEAR_CODES.indexOf(vin.charAt(9));
  return code < 0 ? [] : VIN_YEAR_CYCLES.map((cycle) => cycle + code);
};
