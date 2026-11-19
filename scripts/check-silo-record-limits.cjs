// Execute only against the throwaway localhost storage fixture, never production.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('minio');
assert.equal(process.env.PORTLOG_STORAGE_TEST, '1', 'Requires the isolated storage test fixture');
const client = new Client({
  endPoint: '127.0.0.1',
  port: 9000,
  useSSL: false,
  accessKey: 'portlog',
  secretKey: 'portlog_dev',
});

(async () => {
  const bucket = 'sgc-documents';
  const prefix = `security-regression/${randomUUID()}`;
  for (const format of ['CSV', 'JSON']) {
    const key = `${prefix}/${format}`;
    const serialization =
      format === 'CSV'
        ? { CSV: { FileHeaderInfo: 'NONE', RecordDelimiter: '\n' } }
        : { JSON: { Type: 'LINES' } };
    const select = () =>
      client.selectObjectContent(bucket, key, {
        expression: 'SELECT * FROM S3Object',
        expressionType: 'SQL',
        inputSerialization: serialization,
        outputSerialization: { JSON: { RecordDelimiter: '\n' } },
      });
    const encode = (value) =>
      Buffer.from(format === 'CSV' ? `${value}\n` : `${JSON.stringify({ value })}\n`);
    try {
      await client.putObject(bucket, key, encode('bounded-record-ok'));
      const small = await select();
      assert.match(String(small.getRecords()), /bounded-record-ok/);
      await client.putObject(bucket, key, encode('a'.repeat(1024 * 1024 + 1)));
      await assert.rejects(select, /OverMaxRecordSize/);
      console.log(`${format}: valid record read; oversized record rejected`);
    } finally {
      await client.removeObject(bucket, key);
    }
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
