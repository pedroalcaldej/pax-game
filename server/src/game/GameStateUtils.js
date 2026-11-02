import { ACTION_SLOT_COUNT, ECONOMY } from '../../../shared/Constants.js';

export const createEmptyActionSlots = (count = ACTION_SLOT_COUNT) => Array(count).fill(null);
export const TREATY_DURATION_ROUNDS = 5;
export const BANK_TARIFF_RATE = ECONOMY.BANK_TRANSFER_TARIFF_RATE;
export const VALID_TRADE_RESOURCES = new Set(['SILVER', 'MATERIALS']);
