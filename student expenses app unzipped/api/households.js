import {
  route, supabase, HttpError, requireMember, cleanText, genInviteCode,
  defaultDisplayName, CURRENCIES,
} from './_lib.js';

export default route({
  // List households the current user belongs to
  GET: async ({ user }) => {
    const { data: mine, error } = await supabase
      .from('members')
      .select('id, role, display_name, household_id, households(*)')
      .eq('user_id', user.id);
    if (error) throw error;

    const ids = mine.map((m) => m.household_id);
    const counts = {};
    if (ids.length) {
      const { data: all, error: e2 } = await supabase.from('members').select('household_id').in('household_id', ids);
      if (e2) throw e2;
      for (const r of all) counts[r.household_id] = (counts[r.household_id] || 0) + 1;
    }

    return mine
      .filter((m) => m.households)
      .map((m) => ({
        ...m.households,
        member_count: counts[m.household_id] || 1,
        my_member_id: m.id,
        my_role: m.role,
      }))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },

  // Create a household; creator becomes the owner
  POST: async ({ user, body }) => {
    const name = cleanText(body.name, 60);
    if (!name) throw new HttpError(400, 'Give your household a name.');
    const currency = CURRENCIES.includes(body.currency) ? body.currency : 'USD';
    const displayName = cleanText(body.displayName, 40) || defaultDisplayName(user);

    const { data: household, error } = await supabase
      .from('households')
      .insert({ name, currency, invite_code: genInviteCode(), created_by: user.id })
      .select()
      .single();
    if (error) throw error;

    const { error: mErr } = await supabase
      .from('members')
      .insert({ household_id: household.id, user_id: user.id, display_name: displayName, role: 'owner' });
    if (mErr) {
      await supabase.from('households').delete().eq('id', household.id);
      throw mErr;
    }
    return household;
  },

  // Rename or regenerate the invite code
  PUT: async ({ user, body }) => {
    const me = await requireMember(user.id, body.id);
    const patch = {};
    if (body.name !== undefined) {
      const name = cleanText(body.name, 60);
      if (!name) throw new HttpError(400, 'Household name cannot be empty.');
      patch.name = name;
    }
    if (body.regenerateCode) {
      if (me.role !== 'owner') throw new HttpError(403, 'Only the household owner can reset the invite code.');
      patch.invite_code = genInviteCode();
    }
    if (!Object.keys(patch).length) throw new HttpError(400, 'Nothing to update.');
    const { data, error } = await supabase.from('households').update(patch).eq('id', body.id).select().single();
    if (error) throw error;
    return data;
  },

  // Leave a household. History is kept: your member row becomes an unlinked placeholder.
  DELETE: async ({ user, body }) => {
    const me = await requireMember(user.id, body.id);
    const { error } = await supabase.from('members').update({ user_id: null, role: 'member' }).eq('id', me.id);
    if (error) throw error;

    const { data: linked, error: e2 } = await supabase
      .from('members')
      .select('id, role')
      .eq('household_id', body.id)
      .not('user_id', 'is', null)
      .order('created_at', { ascending: true });
    if (e2) throw e2;

    if (!linked.length) {
      const { error: e3 } = await supabase.from('households').delete().eq('id', body.id);
      if (e3) throw e3;
      return { ok: true, deleted: true };
    }
    if (me.role === 'owner' && !linked.some((m) => m.role === 'owner')) {
      await supabase.from('members').update({ role: 'owner' }).eq('id', linked[0].id);
    }
    return { ok: true, deleted: false };
  },
});
