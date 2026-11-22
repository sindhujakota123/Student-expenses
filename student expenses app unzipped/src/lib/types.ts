export interface Household {
  id: string;
  name: string;
  invite_code: string;
  currency: string;
  created_by: string;
  created_at: string;
}

export interface HouseholdSummary extends Household {
  member_count: number;
  my_member_id: string;
  my_role: 'owner' | 'member';
}

export interface Member {
  id: string;
  household_id: string;
  user_id: string | null;
  display_name: string;
  role: 'owner' | 'member';
  created_at: string;
}

export interface Share {
  member_id: string;
  amount_cents: number;
}

export interface Expense {
  id: string;
  household_id: string;
  description: string;
  amount_cents: number;
  paid_by: string;
  split_type: 'equal' | 'custom';
  category: string;
  spent_on: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  expense_shares: Share[];
}

export interface Payment {
  id: string;
  household_id: string;
  from_member: string;
  to_member: string;
  amount_cents: number;
  note: string | null;
  paid_on: string;
  created_by: string;
  created_at: string;
}

export interface HouseholdData {
  household: Household;
  me: Member;
  members: Member[];
  expenses: Expense[];
  payments: Payment[];
}
