import { route, supabase, HttpError, requireMember, listMembers, cleanText, isDate, isUuid, MAX_AMOUNT_CENTS } from './_lib.js';

export default route({
  // Record a settle-up payment between two members
  POST: async ({ user, body }) => {
    await requireMember(user.id, body.householdId);
    const members = await listMembers(body.householdId);
    const ids = new Set(members.map((m) => m.id));
    if (!ids.has(body.fromMember) || !ids.has(body.toMember)) throw new HttpError(400, 'Choose two people from this household.');
    if (body.fromMember === body.toMember) throw new HttpError(400, "Someone can't pay themselves.");
    const amount = body.amountCents;
    if (!Number.isInteger(amount) || amount <= 0) throw new HttpError(400, 'Amount must be more than zero.');
    if (amount > MAX_AMOUNT_CENTS) throw new HttpError(400, 'Amount is too large.');
    if (!isDate(body.paidOn)) throw new HttpError(400, 'Pick a valid date.');

    const { data, error } = await supabase
      .from('payments')
      .insert({
        household_id: body.householdId,
        from_member: body.fromMember,
        to_member: body.toMember,
        amount_cents: amount,
        note: cleanText(body.note, 140) || null,
        paid_on: body.paidOn,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  DELETE: async ({ user, body }) => {
    if (!isUuid(body.id)) throw new HttpError(400, 'Invalid payment.');
    const { data: existing, error: e1 } = await supabase.from('payments').select('*').eq('id', body.id).maybeSingle();
    if (e1) throw e1;
    if (!existing) throw new HttpError(404, 'That payment was already deleted.');
    await requireMember(user.id, existing.household_id);
    const { error } = await supabase.from('payments').delete().eq('id', existing.id);
    if (error) throw error;
    return { ok: true };
  },
});
