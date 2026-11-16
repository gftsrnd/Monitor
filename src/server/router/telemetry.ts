import { Router } from 'express';
import { query, validate } from '../middleware/validate.js';
import { recordTelemetryEvent, sumTelemetryEvent } from '../model/telemetry.js';
import { generateETag, numify } from '../utils/common.js';
import { makeBadge } from 'badge-maker';
import { env } from '../utils/env.js';

export const telemetryRouter = Router();

const blankGifBuffer = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * @deprecated Legacy unkeyed workspace telemetry endpoints disabled to prevent predictable workspaceId spam.
 */
telemetryRouter.get('/:workspaceId/blank.gif', (_req, res) => {
  res.header('Content-Type', 'image/gif').status(410).send(blankGifBuffer);
});

telemetryRouter.get('/:workspaceId/badge.svg', (_req, res) => {
  res.status(410).send('Deprecated endpoint disabled');
});

telemetryRouter.get(
  '/:workspaceId/:telemetryId.gif',
  validate(
    query('name').optional().isString(),
    query('url').optional().isURL(),
    query('force').optional().isBoolean()
  ),
  async (req, res) => {
    if (env.isTest) {
      await recordTelemetryEvent(req);
    } else {
      recordTelemetryEvent(req);
    }

    res
      .header('Content-Type', 'image/gif')
      .header(
        'Cache-Control',
        'no-cache,max-age=0,no-store,s-maxage=0,proxy-revalidate'
      )
      .status(200)
      .send(blankGifBuffer);
  }
);

telemetryRouter.get(
  '/:workspaceId/:telemetryId/badge.svg',
  validate(
    query('name').optional().isString(),
    query('url').optional().isURL(),
    query('title').optional().isString(),
    query('start').optional().isNumeric(),
    query('fullNum').optional().isBoolean(),
    query('force').optional().isBoolean()
  ),
  async (req, res) => {
    const title = req.query.title || 'visitor';
    const start = req.query.start ? Number(req.query.start) : 0;
    const fullNum = req.query.fullNum === 'true';

    if (env.isTest) {
      await recordTelemetryEvent(req);
    } else {
      recordTelemetryEvent(req);
    }
    const num = await sumTelemetryEvent(req);
    const count = num + start;

    const svg = makeBadge({
      label: String(title),
      message: fullNum ? String(count) : numify(count),
      color: 'green',
    });

    res
      .header('Content-Type', 'image/svg+xml')
      .header(
        'Cache-Control',
        'no-cache,max-age=0,no-store,s-maxage=0,proxy-revalidate'
      )
      .header('etag', generateETag(`${title}|${count}`))
      .status(200)
      .send(svg);
  }
);
