import erpPool, { erpQuery } from '../config/erpDb.js';

const tables = ['account_invoice', 'account_voucher', 'account_voucher_line', 'res_partner'];
const patterns = [
  'id', 'name', 'number', 'reference', 'partner', 'customer', 'commercial', 'seller',
  'date', 'due', 'amount', 'residual', 'state', 'type', 'journal', 'bank', 'payment',
  'cheque', 'check', 'lcn', 'maturity', 'unpaid', 'impaye', 'portfolio', 'encours',
];

try {
  const result = await erpQuery(
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])
       AND column_name ~* $2
     ORDER BY table_name, ordinal_position`,
    [tables, patterns.join('|')]
  );

  const grouped = Object.fromEntries(tables.map((table) => [
    table,
    result.rows.filter((row) => row.table_name === table),
  ]));
  console.log(JSON.stringify(grouped, null, 2));
} catch (error) {
  console.error(JSON.stringify({ code: error.code, message: error.message }));
  process.exitCode = 1;
} finally {
  await erpPool?.end();
}
