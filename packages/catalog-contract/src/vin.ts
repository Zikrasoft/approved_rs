const VIN_LETTERS = 'A-HJ-NPR-Z';

export const VIN_PATTERN = new RegExp(`^[${VIN_LETTERS}0-9]{17}$`);

export const VIN_INPUT_PATTERN = `[${VIN_LETTERS}${VIN_LETTERS.toLowerCase()}0-9]{17}`;
