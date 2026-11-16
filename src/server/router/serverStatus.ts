import { Router } from 'express';
import { body, header, param, validate } from '../middleware/validate.js';
import { recordServerStatus } from '../model/serverStatus.js';
import fs from 'fs-extra';
import { libraryPath } from '../utils/lib.js';
import { getIpAddress, getLocation } from '../utils/detect.js';

export const serverStatusRouter = Router();

const installScript = fs.readFileSync(libraryPath.installScript);

serverStatusRouter.post(
  '/report',
  validate(
    header('x-tianji-report-version').isSemVer(),
    body('workspaceId').isString(),
    body('name').isString(),
    body('hostname').isString(),
    body('timeout').optional().isInt(),
    body('payload').isObject()
  ),
  async (req, res) => {
    const body = req.body;

    const ip = getIpAddress(req);
    const location = await getLocation(ip);
    const requestContext = {
      country: location?.country,
      ip,
    };

    await recordServerStatus(body, requestContext);

    res.send('success');
  }
);

serverStatusRouter.get(
  '/:workspaceId/install.sh',
  validate(param('workspaceId').matches(/^[a-zA-Z0-9_-]{1,64}$/)),
  async (req, res) => {
    const { workspaceId } = req.params;
    const queryUrl = req.query.url ? String(req.query.url) : undefined;

    const rawServer = queryUrl || `${req.protocol}://${req.get('Host')}`;
    if (!/^https?:\/\/[a-zA-Z0-9.:-]+$/.test(rawServer)) {
      res.status(400).type('text/plain').send('Invalid server URL');
      return;
    }

    res
      .setHeader('Content-Type', 'text/plain')
      .send(
        String(installScript)
          .replace('{{DEFAULT_SERVER}}', rawServer)
          .replace('{{DEFAULT_WORKSPACE}}', workspaceId)
      );
  }
);
