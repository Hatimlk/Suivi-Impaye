import erpPool, {
  ERP_ALLOWED_TABLES,
  checkErpConnection,
  erpQuery,
} from '../config/erpDb.js';

try {
  const connection = await checkErpConnection();
  console.log(JSON.stringify({
    connected: true,
    database: connection.database,
    username: connection.username,
    readOnly: connection.read_only,
  }));

  const result = await erpQuery(
    `SELECT table_name, column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])
     ORDER BY table_name, ordinal_position`,
    [ERP_ALLOWED_TABLES]
  );

  console.log(JSON.stringify({ columns: result.rows }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    connected: false,
    code: error.code,
    message: error.message,
  }));
  process.exitCode = 1;
} finally {
  await erpPool?.end();
}
