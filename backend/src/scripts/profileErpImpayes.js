import erpPool, { erpQuery } from '../config/erpDb.js';

try {
  const [vouchers, invoices, totals] = await Promise.all([
    erpQuery(`
      SELECT state, type, journal_type, check_journal, boe_journal,
             impaye_is_paid, COUNT(*)::int AS count
      FROM account_voucher
      WHERE impaye_date IS NOT NULL OR voucher_impaye_id IS NOT NULL
      GROUP BY state, type, journal_type, check_journal, boe_journal, impaye_is_paid
      ORDER BY count DESC
    `),
    erpQuery(`
      SELECT state, type, litigation_state, COUNT(*)::int AS count
      FROM account_invoice
      WHERE COALESCE(residual, 0) > 0
      GROUP BY state, type, litigation_state
      ORDER BY count DESC
    `),
    erpQuery(`
      SELECT
        COUNT(*) FILTER (WHERE impaye_date IS NOT NULL)::int AS vouchers_with_unpaid_date,
        COUNT(*) FILTER (WHERE voucher_impaye_id IS NOT NULL)::int AS linked_unpaid_vouchers,
        COUNT(*) FILTER (WHERE impaye_date IS NOT NULL AND COALESCE(impaye_is_paid, false) = false)::int AS active_unpaid_vouchers
      FROM account_voucher
    `),
  ]);
  console.log(JSON.stringify({ totals: totals.rows[0], vouchers: vouchers.rows, invoices: invoices.rows }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ code: error.code, message: error.message }));
  process.exitCode = 1;
} finally {
  await erpPool?.end();
}
