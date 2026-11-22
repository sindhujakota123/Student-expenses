import crypto from 'node:crypto';
import supabase from './db-client.js';

export { supabase };

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const CATEGORIES = ['Rent', 'Utilities', 'Internet', 'Groceries', 'Household', 'Dining', 'Transport', 'Entertainment', 'Other'];
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'SEK', 'INR', 'SGD', 'MXN', 'BRL', 'ZAR'];
export const MAX_AMOUNT_CENTS = 100000000; // 1,000,000.00

export const isUuid = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export const cleanText = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

export function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function genInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return out;
}

export function defaultDisplayName(user) {
  const meta = user.user_metadata || {};
  const fromMeta = meta.full_name || meta.name;
  if (fromMeta) return cleanText(String(fromMeta).split(' ')[0], 40);
  const local = (user.email || 'Me').split('@')[0].replace(/[._-]+/g, ' ');
  return cleanText(local.charAt(0).toUpperCase() + local.slice(1), 40) || 'Me';
}

async function getUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please sign in to continue.');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'Your session has expired. Please sign in again.');
  return data.user;
}

/** Throws 403 unless the user is a linked member of the household. Returns their member row. */
export async function requireMember(userId, householdId) {
  if (!isUuid(householdId)) throw new HttpError(400, 'Invalid household.');
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(403, "You don't have access to this household.");
  return data;
}

export async function listMembers(householdId) {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

/** Wraps a map of method handlers with CORS, auth and error handling. */
export function route(handlers) {
  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return res.status(204).end();

    const fn = handlers[req.method];
    if (!fn) return res.status(405).json({ error: 'Method not allowed' });

    try {
      const user = await getUser(req);
      let body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body || '{}'); } catch { throw new HttpError(400, 'Invalid request body.'); }
      }
      const result = await fn({ req, user, body, query: req.query || {} });
      return res.status(req.method === 'POST' ? 201 : 200).json(result ?? { ok: true });
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error('API error:', err);
      return res.status(status).json({
        error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message,
      });
    }
  };
}
