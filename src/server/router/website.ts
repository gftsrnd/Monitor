import { type Request, type Response, type NextFunction, Router } from 'express';
import { body, validate } from '../middleware/validate.js';
import * as yup from 'yup';
import { COLLECTION_TYPE } from '../utils/const.js';
import {
  findSession,
  saveWebsiteEvent,
  saveWebsiteSessionData,
  WebsiteNotFoundError,
} from '../model/website/index.js';
import { createToken, hashUuid } from '../utils/common.js';
import { hostnameRegex } from '@tianji/shared';
import { isWorkspacePaused } from '../model/billing/workspace.js';
import {
  promWebsiteEventCounter,
  promWebsiteSessionErrorCounter,
} from '../utils/prometheus/client.js';
import { logger } from '../utils/logger.js';
import { getIpAddress } from '../utils/detect.js';

export const websiteRouter = Router();

const SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'magictoken',
  'magic_token',
  'access_token',
  'refresh_token',
  'id_token',
  'e',
  'session',
  'search',
  'code',
  'state',
  'conversation',
  'reset',
  'key',
  'apikey',
  'api_key',
  'secret',
  'password',
  'pwd',
  'jwt',
  'sig',
  'signature',
  'auth',
  'email',
  'phone',
]);

function sanitizeQueryString(rawQuery?: string): string | undefined {
  if (!rawQuery) return undefined;
  try {
    const params = new URLSearchParams(rawQuery);
    for (const key of [...params.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        params.delete(key);
      }
    }
    const cleaned = params.toString();
    return cleaned || undefined;
  } catch {
    return undefined;
  }
}

function sanitizeUrlPath(rawPath?: string): string {
  if (!rawPath) return '/';
  // Mask confidential financial case IDs if ever hit directly
  return rawPath.replace(
    /^(\/(?:doctor|nurse|admin)\/cases\/)[^/]+/i,
    '$1[redacted]'
  );
}

// Lightweight per-IP sliding rate limiter (max 180 tracking requests / 60s per IP)
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 180;
const ipHits = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipHits) {
    if (entry.resetAt <= now) {
      ipHits.delete(ip);
    }
  }
}, 5 * 60_000).unref();

function websiteRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = getIpAddress(req) || req.ip || 'unknown';
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt <= now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    next();
    return;
  }
  entry.count += 1;
  if (entry.count > RATE_MAX_REQUESTS) {
    res.status(429).json({ error: 'Too many tracking requests.' });
    return;
  }
  next();
}

// Shared validation schema for event payload
const eventPayloadSchema = yup.object().shape({
  data: yup.object(),
  distinctId: yup.string().trim().max(500),
  hostname: yup.string().matches(hostnameRegex).max(100),
  language: yup.string().max(35),
  osVersion: yup.string().strict().max(20),
  referrer: yup.string().max(500),
  screen: yup.string().max(11),
  title: yup.string().max(500),
  url: yup.string().max(500),
  website: yup.string().required(),
  name: yup.string().max(50),
});

function handleFindSessionError(
  res: Response,
  error: unknown,
  endpoint: 'send' | 'batch',
  requestWebsiteId?: string
) {
  promWebsiteSessionErrorCounter.inc({ type: 'find_session', endpoint });

  if (error instanceof WebsiteNotFoundError) {
    const websiteId = error.websiteId || requestWebsiteId;

    logger.warn('[Website] Website not found in request', {
      endpoint,
      websiteId,
    });
    res.status(404).json({
      error: error.message,
    });
    return;
  }

  const message = error instanceof Error ? error.message : 'Unknown error';

  logger.warn('[Website] Failed to find session for request', {
    endpoint,
    websiteId: requestWebsiteId,
    error: message,
  });

  res.status(400).json({
    error: message,
  });
}

// Shared function to process a single event
async function processEvent(type: string, payload: any, session: any) {
  const {
    url,
    referrer,
    name: eventName,
    data: eventData,
    title: pageTitle,
  } = payload;

  if (type === COLLECTION_TYPE.event) {
    let [urlPath, urlQuery] = url?.split('?') || [];
    let [referrerPath, referrerQuery] = referrer?.split('?') || [];
    let referrerDomain;

    if (!urlPath) {
      urlPath = '/';
    }
    urlPath = sanitizeUrlPath(urlPath);

    if (referrerPath?.startsWith('http')) {
      try {
        const refUrl = new URL(referrer);
        referrerPath = sanitizeUrlPath(refUrl.pathname);
        referrerQuery = refUrl.search.substring(1);
        referrerDomain = refUrl.hostname.replace(/www\./, '');
      } catch {
        referrerPath = undefined;
        referrerQuery = undefined;
      }
    }

    urlQuery = sanitizeQueryString(urlQuery);
    referrerQuery = sanitizeQueryString(referrerQuery);

    if (process.env.REMOVE_TRAILING_SLASH) {
      urlPath = urlPath.replace(/.+\/$/, '');
    }

    // Parse UTM parameters from URL query string
    let utmSource, utmMedium, utmCampaign, utmTerm, utmContent;
    if (urlQuery) {
      const params = new URLSearchParams(urlQuery);
      utmSource = params.get('utm_source') || undefined;
      utmMedium = params.get('utm_medium') || undefined;
      utmCampaign = params.get('utm_campaign') || undefined;
      utmTerm = params.get('utm_term') || undefined;
      utmContent = params.get('utm_content') || undefined;
    }

    saveWebsiteEvent({
      urlPath,
      urlQuery,
      referrerPath,
      referrerQuery,
      referrerDomain,
      pageTitle,
      eventName,
      eventData,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
      ...session,
      sessionId: session.id,
      distinctId:
        typeof payload.distinctId === 'string' && payload.distinctId.trim()
          ? hashUuid(session.websiteId, payload.distinctId.trim())
          : undefined,
    });
    return { status: 'success', type: 'event' };
  }

  if (type === COLLECTION_TYPE.identify) {
    if (!eventData) {
      throw new Error('Data required for identify event');
    }

    const sessionData = { ...eventData };
    delete sessionData.id;
    delete sessionData.userId;

    await saveWebsiteSessionData({
      ...session,
      sessionData,
      sessionId: session.id,
    });
    return { status: 'success', type: 'identify' };
  }

  throw new Error(`Unsupported event type: ${type}`);
}

websiteRouter.post(
  '/send',
  websiteRateLimit,
  validate(
    body('payload')
      .exists()
      .withMessage('payload should be existed')
      .isObject()
      .custom(async (input) => {
        return eventPayloadSchema.required().validate(input);
      }),
    body('type')
      .exists()
      .withMessage('type should be existed')
      .isString()
      .matches(/event|identify/i)
  ),
  async (req, res) => {
    // Reference: https://github1s.com/umami-software/umami/blob/master/src/pages/api/send.ts

    const { type, payload } = req.body;

    try {
      const session = await findSession(req, req.body);

      if (await isWorkspacePaused(session.workspaceId)) {
        res.status(403).send('Workspace is paused.');
        return;
      }

      await processEvent(type, payload, session);
      const token = createToken(session);
      promWebsiteEventCounter.inc({
        websiteId: payload.website,
        eventType: type,
        endpoint: 'send',
      });
      res.send(token);
    } catch (error) {
      handleFindSessionError(res, error, 'send', payload?.website);
    }
  }
);

websiteRouter.post(
  '/batch',
  websiteRateLimit,
  validate(
    body('events')
      .exists()
      .withMessage('events should be existed')
      .isArray({ min: 1, max: 25 })
      .withMessage('events should be an array with 1-25 items')
      .custom(async (events) => {
        // Validate each event in the array and ensure all share the same websiteId
        const eventSchema = yup.object().shape({
          type: yup
            .string()
            .required()
            .matches(/event|identify/i),
          payload: eventPayloadSchema.required(),
        });

        const primaryWebsite = events[0]?.payload?.website;
        for (const event of events) {
          await eventSchema.validate(event);
          if (event.payload?.website !== primaryWebsite) {
            throw new Error('All batched events must belong to the same website');
          }
        }
        return true;
      })
  ),
  async (req, res) => {
    const { events } = req.body;

    let session;
    try {
      session = await findSession(req, events[0]);
    } catch (error) {
      handleFindSessionError(
        res,
        error,
        'batch',
        events[0]?.payload?.website
      );
      return;
    }

    if (await isWorkspacePaused(session.workspaceId)) {
      res.status(403).send('Workspace is paused.');
      return;
    }

    const results = [];
    const errors = [];

    // Process each event in the batch
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      try {
        const result = await processEvent(event.type, event.payload, session);
        results.push({ index: i, ...result });
        promWebsiteEventCounter.inc({
          websiteId: event.payload.website,
          eventType: event.type,
          endpoint: 'batch',
        });
      } catch (error) {
        errors.push({
          index: i,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const token = createToken(session);

    res.json({
      token,
      processed: results.length,
      errors: errors.length,
      results,
      errorDetails: errors.length > 0 ? errors : undefined,
    });
  }
);
