import { route, supabase, requireMember, listMembers } from './_lib.js';

// Full snapshot of one household (members, expenses with shares, payments)
export default route({
  GET: async ({ user, query }) => {
    const id = query.id;
    const me = await requireMember(user.id, id);

    const [hh, members, exp, pay] = await Promise.all([
      supabase.from('households').select('*').eq('id', id).single(),
      listMembers(id),
      supabase
        .from('expenses')
        .select('*, expense_shares(member_id, amount_cents)')
        .eq('household_id', id)
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('payments')
        .select('*')
        .eq('household_id', id)
        .order('paid_on', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);
    if (hh.error) throw hh.error;
    if (exp.error) throw exp.error;
    if (pay.error) throw pay.error;

    return { household: hh.data, me, members, expenses: exp.data, payments: pay.data };
  },
});
