import { createContext, useContext } from 'react';
import type { HouseholdData, Member } from '../lib/types';
import type { Balance } from '../lib/money';

export interface HouseholdCtx extends HouseholdData {
  balances: Record<string, Balance>;
  memberById: Record<string, Member>;
  /** "You" for the current user, otherwise display name */
  label: (memberId: string) => string;
  refresh: () => Promise<void>;
}

export const HouseholdContext = createContext<HouseholdCtx | null>(null);

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used inside HouseholdLayout');
  return ctx;
}
