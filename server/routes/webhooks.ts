/**
 * Inbound webhooks from n8n and other automation platforms.
 * These endpoints receive callbacks and trigger internal actions.
 */

import { Router } from 'express';
import { notify } from '../repositories/notificationRepository.js';
import { ENV } from '../config/env.js';

const router = Router();

const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || '';

function webhooksDisabledInProduction(): boolean {
  return (
    ENV.NODE_ENV === 'production' &&
    ENV.REQUIRE_WEBHOOK_SECRET_IN_PRODUCTION &&
    !WEBHOOK_SECRET.trim()
  );
}

function validateWebhookSecret(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  if (webhooksDisabledInProduction()) {
    return false;
  }
  if (!WEBHOOK_SECRET.trim()) {
    return ENV.NODE_ENV !== 'production';
  }
  const provided = req.headers['x-webhook-secret'];
  return provided === WEBHOOK_SECRET;
}

/**
 * POST /api/webhooks/n8n/notify
 * n8n sends notifications to users via this endpoint.
 * Body: { institution_id, user_id, title, body, type?, action_url? }
 */
router.post('/n8n/notify', async (req, res) => {
  if (webhooksDisabledInProduction()) {
    return res.status(503).json({ error: 'Webhooks not configured (set N8N_WEBHOOK_SECRET in production)' });
  }
  if (!validateWebhookSecret(req)) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  try {
    const { institution_id, user_id, title, body, type, action_url } = req.body;

    if (!institution_id || !user_id || !title) {
      return res.status(400).json({ error: 'Missing required fields: institution_id, user_id, title' });
    }

    await notify({
      institution_id,
      user_id,
      title,
      body: body || null,
      type: type || 'n8n_automation',
      action_url: action_url || null,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Webhook] n8n/notify error:', (err as Error).message);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/webhooks/n8n/bulk-notify
 * Send notifications to multiple users.
 * Body: { institution_id, user_ids: string[], title, body, type?, action_url? }
 */
router.post('/n8n/bulk-notify', async (req, res) => {
  if (webhooksDisabledInProduction()) {
    return res.status(503).json({ error: 'Webhooks not configured (set N8N_WEBHOOK_SECRET in production)' });
  }
  if (!validateWebhookSecret(req)) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  try {
    const { institution_id, user_ids, title, body, type, action_url } = req.body;

    if (!institution_id || !Array.isArray(user_ids) || !title) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let sent = 0;
    for (const uid of user_ids.slice(0, 500)) {
      try {
        await notify({
          institution_id,
          user_id: uid,
          title,
          body: body || null,
          type: type || 'n8n_automation',
          action_url: action_url || null,
        });
        sent++;
      } catch {
        // best-effort
      }
    }

    res.json({ success: true, sent });
  } catch (err) {
    console.error('[Webhook] n8n/bulk-notify error:', (err as Error).message);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
