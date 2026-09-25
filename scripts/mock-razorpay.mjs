// Local stand-in for Razorpay's Orders API, used only by automated tests
// (start the app with RAZORPAY_API_BASE=http://localhost:4010/v1). Signature verification in the app is
// real HMAC-SHA256; tests compute valid/invalid signatures with the same test secret.
import http from 'node:http';
import { randomBytes } from 'node:crypto';

const port = Number(process.env.MOCK_RAZORPAY_PORT ?? 4010);
const keyId = process.env.RAZORPAY_KEY_ID ?? 'rzp_test_mock';
const keySecret = process.env.RAZORPAY_KEY_SECRET ?? 'mock_secret';
const expectedAuth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;

http
  .createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'POST' && req.url === '/v1/orders') {
        if (req.headers.authorization !== expectedAuth) {
          res.writeHead(401).end(JSON.stringify({ error: { code: 'BAD_REQUEST_ERROR', description: 'Authentication failed' } }));
          return;
        }
        const input = JSON.parse(body || '{}');
        if (!Number.isInteger(input.amount) || input.amount < 100) {
          res.writeHead(400).end(JSON.stringify({ error: { description: 'amount invalid' } }));
          return;
        }
        res.writeHead(200).end(
          JSON.stringify({ id: `order_${randomBytes(7).toString('hex')}`, entity: 'order', amount: input.amount, currency: input.currency, receipt: input.receipt, status: 'created', notes: input.notes }),
        );
        return;
      }
      res.writeHead(404).end(JSON.stringify({ error: { description: 'not found' } }));
    });
  })
  .listen(port, () => console.log(`✓ mock Razorpay on http://localhost:${port}/v1`));
