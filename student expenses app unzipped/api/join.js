import { route, supabase, HttpError, cleanText, defaultDisplayName, listMembers, isUuid } from './_lib.js';

async function findByCode(code) {
  const normalized = cleanText(code, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length < 6) throw new HttpError(400, 'Invite codes are 8 characters, like K7QM2PXA.');
  const { data, error } = await supabase.from('households').select('id, name, currency').eq('invite_code', normalized).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "That invite code doesn't match any household. Check for typos, or ask for a fresh link — codes can be reset.");
  return data;
}

export default route({
  // Preview an invite (only the household name and unclaimed placeholder names are revealed)
  GET: async ({ user, query }) => {
    const household = await findByCode(query.code);
    const members = await listMembers(household.id);
    return {
      household,
      memberCount: members.length,
      alreadyMember: members.some((m) => m.user_id === user.id),
      placeholders: members.filter((m) => !m.user_id).map((m) => ({ id: m.id, display_name: m.display_name })),
      suggestedName: defaultDisplayName(user),
    };
  },

  // Join as a new member or claim a placeholder
  POST: async ({ user, body }) => {
    const household = await findByCode(body.code);
    const members = await listMembers(household.id);
    if (members.some((m) => m.user_id === user.id)) return { householdId: household.id };

    if (body.claimMemberId) {
      if (!isUuid(body.claimMemberId)) throw new HttpError(400, 'Invalid member.');
      const target = members.find((m) => m.id === body.claimMemberId);
      if (!target) throw new HttpError(404, 'That person is no longer in this household.');
      if (target.user_id) throw new HttpError(409, 'Someone has already claimed that spot.');
      const { error } = await supabase.from('members').update({ user_id: user.id }).eq('id', target.id).is('user_id', null);
      if (error) throw error;
      return { householdId: household.id };
    }

    const name = cleanText(body.displayName, 40) || defaultDisplayName(user);
    const clash = members.find((m) => m.display_name.toLowerCase() === name.toLowerCase());
    if (clash) {
      throw new HttpError(409, `"${clash.display_name}" is already taken here. If that's you, pick it from the list above — otherwise use a different name.`);
    }
    const { error } = await supabase
      .from('members')
      .insert({ household_id: household.id, user_id: user.id, display_name: name, role: 'member' });
    if (error) throw error;
    return { householdId: household.id };
  },
});
