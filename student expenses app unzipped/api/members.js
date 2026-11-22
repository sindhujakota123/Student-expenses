import { route, supabase, HttpError, requireMember, listMembers, cleanText, isUuid } from './_lib.js';

async function loadMember(id) {
  if (!isUuid(id)) throw new HttpError(400, 'Invalid member.');
  const { data, error } = await supabase.from('members').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'That member no longer exists.');
  return data;
}

async function assertUniqueName(householdId, name, exceptId) {
  const members = await listMembers(householdId);
  const clash = members.find((m) => m.id !== exceptId && m.display_name.toLowerCase() === name.toLowerCase());
  if (clash) throw new HttpError(409, `Someone called "${clash.display_name}" is already in this household. Try adding a last initial.`);
}

export default route({
  // Add a placeholder member (someone without an account yet)
  POST: async ({ user, body }) => {
    await requireMember(user.id, body.householdId);
    const name = cleanText(body.displayName, 40);
    if (!name) throw new HttpError(400, 'Enter a name.');
    await assertUniqueName(body.householdId, name);
    const { data, error } = await supabase
      .from('members')
      .insert({ household_id: body.householdId, user_id: null, display_name: name, role: 'member' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Rename yourself or a placeholder
  PUT: async ({ user, body }) => {
    const target = await loadMember(body.id);
    const me = await requireMember(user.id, target.household_id);
    if (target.id !== me.id && target.user_id) {
      throw new HttpError(403, "You can only rename yourself or people who haven't joined yet.");
    }
    const name = cleanText(body.displayName, 40);
    if (!name) throw new HttpError(400, 'Name cannot be empty.');
    await assertUniqueName(target.household_id, name, target.id);
    const { data, error } = await supabase.from('members').update({ display_name: name }).eq('id', target.id).select().single();
    if (error) throw error;
    return data;
  },

  // Remove a placeholder with no history
  DELETE: async ({ user, body }) => {
    const target = await loadMember(body.id);
    await requireMember(user.id, target.household_id);
    if (target.user_id) throw new HttpError(403, 'People who have joined need to leave the household themselves.');

    const counts = await Promise.all([
      supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('paid_by', target.id),
      supabase.from('expense_shares').select('id', { count: 'exact', head: true }).eq('member_id', target.id),
      supabase.from('payments').select('id', { count: 'exact', head: true }).eq('from_member', target.id),
      supabase.from('payments').select('id', { count: 'exact', head: true }).eq('to_member', target.id),
    ]);
    for (const c of counts) if (c.error) throw c.error;
    if (counts.some((c) => (c.count || 0) > 0)) {
      throw new HttpError(409, `${target.display_name} is part of existing expenses or payments. Edit or delete those first.`);
    }
    const { error } = await supabase.from('members').delete().eq('id', target.id);
    if (error) throw error;
    return { ok: true };
  },
});
