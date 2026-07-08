/**
 * Inbound email webhook for automatic bill creation.
 *
 * Point your email provider's inbound-parse webhook here (SendGrid Inbound
 * Parse, Mailgun Routes, or a Cloudflare Email Worker that POSTs JSON).
 * Users forward bank transaction emails to bills+<token>@<your-domain>; the
 * token maps to their account via the emailTokens collection, and the raw
 * subject/text is queued under users/{uid}/pendingBills. The app parses the
 * amount/merchant client-side and asks the user to confirm — the queued doc
 * is deleted as soon as the client picks it up.
 *
 * Set INBOUND_WEBHOOK_SECRET to require an `x-webhook-secret` header so only
 * your email provider can post here.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

const TOKEN_RE = /bills\+([a-z0-9]+)@/i;

exports.inboundEmail = onRequest({ cors: false }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (secret && req.get('x-webhook-secret') !== secret) {
    res.status(401).send('Unauthorized');
    return;
  }

  // Works for JSON bodies and for form-encoded provider payloads
  // (SendGrid/Mailgun both send `to`, `subject`, and a plain-text body field).
  const body = req.body || {};
  const to = String(body.to || body.recipient || '');
  const subject = String(body.subject || '');
  const text = String(body.text || body['body-plain'] || body.plain || '');

  const match = to.match(TOKEN_RE);
  if (!match) {
    res.status(400).send('No forwarding token in recipient address');
    return;
  }

  const db = getFirestore();
  const tokenSnap = await db.collection('emailTokens').doc(match[1].toLowerCase()).get();
  if (!tokenSnap.exists) {
    res.status(404).send('Unknown forwarding token');
    return;
  }

  const { uid } = tokenSnap.data();
  await db.collection('users').doc(uid).collection('pendingBills').add({
    subject: subject.slice(0, 500),
    text: text.slice(0, 2000),
    from: String(body.from || '').slice(0, 200),
    receivedAt: Date.now(),
  });

  res.status(200).send('OK');
});
