import { ACTION_SLOT_COUNT } from '../../../shared/Constants.js';

export const createEmptyActionSlots = () => Array(ACTION_SLOT_COUNT).fill(null);
export const TREATY_DURATION_ROUNDS = 5;
export const BANK_TARIFF_RATE = 0.2;
export const VALID_TRADE_RESOURCES = new Set(['SILVER', 'MATERIALS']);
