import jwt from 'jsonwebtoken';

export function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, nom: user.nom, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

export function authHeader(user) {
  return `Bearer ${signAccessToken(user)}`;
}

export const USERS = {
  admin: { id: '11111111-1111-1111-1111-111111111111', email: 'admin@test.com', nom: 'Admin', role: 'admin' },
  responsable: { id: '22222222-2222-2222-2222-222222222222', email: 'resp@test.com', nom: 'Resp', role: 'responsable_recouvrement' },
  commercialA: { id: '33333333-3333-3333-3333-333333333333', email: 'commA@test.com', nom: 'CommA', role: 'commercial' },
  commercialB: { id: '44444444-4444-4444-4444-444444444444', email: 'commB@test.com', nom: 'CommB', role: 'commercial' },
  lecture: { id: '55555555-5555-5555-5555-555555555555', email: 'lecture@test.com', nom: 'Lecture', role: 'lecture_seule' },
};

/**
 * Builds a fake `query(sql, params)` implementation for the mocked db module.
 * `rules` is an ordered list of { match: (sql) => boolean, respond: (params, sql) => rows|{rows} }.
 * The first matching rule wins. Anything unmatched (migrations/DDL, etc.) resolves to `{ rows: [] }`
 * so route-level setup middleware never breaks a test that isn't about that query.
 */
export function fakeQueryImpl(rules = []) {
  return async (sql, params = []) => {
    for (const rule of rules) {
      if (rule.match(sql)) {
        const out = rule.respond(params, sql);
        return Array.isArray(out) ? { rows: out } : out;
      }
    }
    // Any unmatched COUNT(*) query (e.g. the login lockout check, pagination counts)
    // defaults to zero so a test that isn't about that specific count doesn't crash.
    if (/COUNT\(\*\)/i.test(sql)) return { rows: [{ count: '0' }] };
    return { rows: [] };
  };
}

export function includesAll(sql, ...fragments) {
  return fragments.every((f) => sql.includes(f));
}
