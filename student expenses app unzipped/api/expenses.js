import {
  route, supabase, HttpError, requireMember, listMembers, cleanText, isDate, isUuid,
  CATEGORIES, MAX_AMOUNT_CENTS,
} from './_lib.js';

async function validate(body, householdId) {
  const members = await listMembers(householdId);
  const ids = new Set(members.map((m) => m.id));

  const description = cleanText(body.description, 80);
  if (!description) throw new HttpError(400, 'Add a description.');
  const amount = body.amountCents;
  if (!Number.isInteger(amount) || amount <= 0) throw new HttpError(400, 'Amount must be more than zero.');
  if (amount > MAX_AMOUNT_CENTS) throw new HttpError(400, 'Amount is too large.');
  if (!ids.has(body.paidBy)) throw new HttpError(400, 'Choose who paid from the household members.');
  const splitType = body.splitType === 'custom' ? 'custom' : 'equal';
  const category = CATEGORIES.includes(body.category) ? body.category : 'Other';
  if (!isDate(body.spentOn)) throw new HttpError(400, 'Pick a valid date.');
  const notes = cleanText(body.notes, 300) || null;

  if (!Array.isArray(body.shares) || !body.shares.length) throw new HttpError(400, 'Choose who shares this cost.');
  const seen = new Set();
  const shares = [];
  for (const s of body.shares) {
    if (!ids.has(s.memberId)) throw new HttpError(400, 'A share belongs to someone outside this household.');
    if (seen.has(s.memberId)) throw new HttpError(400, 'Each person can only have one share.');
    if (!Number.isInteger(s.amountCents) || s.amountCents < 0) throw new HttpError(400, 'Share amounts must be zero or more.');
    seen.add(s.memberId);
    if (s.amountCents > 0) shares.push({ member_id: s.memberId, amount_cents: s.amountCents });
  }
  if (!shares.length) throw new HttpError(400, 'At least one person needs a share.');
  const sum = shares.reduce((a, s) => a + s.amount_cents, 0);
  if (sum !== amount) throw new HttpError(400, 'Shares must add up exactly to the total.');
  if (splitType === 'equal') {
    const vals = shares.map((s) => s.amount_cents);
    if (Math.max(...vals) - Math.min(...vals) > 1) throw new HttpError(400, 'Equal splits must be equal.');
  }

  return {
    row: { description, amount_cents: amount, paid_by: body.paidBy, split_type: splitType, category, spent_on: body.spentOn, notes },
    shares,
  };
}

async function loadExpense(id) {
  if (!isUuid(id)) throw new HttpError(400, 'Invalid expense.');
  const { data, error } = await supabase.from('expenses').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'That expense was already deleted.');
  return data;
}

async function writeShares(expenseId, shares) {
  const { error } = await supabase.from('expense_shares').insert(shares.map((s) => ({ ...s, expense_id: expenseId })));
  if (error) throw error;
}

export default route({
  POST: async ({ user, body }) => {
    await requireMember(user.id, body.householdId);
    const { row, shares } = await validate(body, body.householdId);
    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...row, household_id: body.householdId, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    try {
      await writeShares(data.id, shares);
    } catch (e) {
      await supabase.from('expenses').delete().eq('id', data.id);
      throw e;
    }
    return data;
  },

  PUT: async ({ user, body }) => {
    const existing = await loadExpense(body.id);
    await requireMember(user.id, existing.household_id);
    const { row, shares } = await validate(body, existing.household_id);
    const { data, error } = await supabase.from('expenses').update(row).eq('id', existing.id).select().single();
    if (error) throw error;
    const { error: dErr } = await supabase.from('expense_shares').delete().eq('expense_id', existing.id);
    if (dErr) throw dErr;
    await writeShares(existing.id, shares);
    return data;
  },

  DELETE: async ({ user, body }) => {
    const existing = await loadExpense(body.id);
    await requireMember(user.id, existing.household_id);
    const { error } = await supabase.from('expenses').delete().eq('id', existing.id);
    if (error) throw error;
    return { ok: true };
  },
});
