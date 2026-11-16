import React from 'react';
import { Button } from '../ui/button';
import { LuCodeXml } from 'react-icons/lu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { useTranslation } from '@i18next-toolkit/react';
import { Typography } from 'antd';
import { useGlobalConfig } from '@/hooks/useConfig';

interface WebsiteCodeBtnProps {
  websiteId: string;
}
export const WebsiteCodeBtn: React.FC<WebsiteCodeBtnProps> = React.memo(
  (props) => {
    const { t } = useTranslation();
    const { customTrackerScriptName = 'tracker.js' } = useGlobalConfig();

    const trackScript = `<script async defer src="${location.origin}/${customTrackerScriptName}" data-website-id="${props.websiteId}"></script>`;

    return (
      <Dialog>
        <DialogTrigger>
          <Button variant="outline" Icon={LuCodeXml}>
            {t('Code')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Tracking code')}</DialogTitle>
            <DialogDescription>
              {t('Add this code into your website head script')}
            </DialogDescription>
          </DialogHeader>

          <Typography.Paragraph
            copyable={{
              format: 'text/plain',
              text: trackScript,
            }}
            className="bg-muted flex h-[96px] overflow-auto rounded border border-black border-opacity-10 bg-opacity-5 p-2"
          >
            <span>{trackScript}</span>
          </Typography.Paragraph>

          <div className="mt-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">First-Party / Proxy Tip:</span>{' '}
            To prevent ad-blockers from blocking analytics, you can also proxy or alias the tracking endpoint via{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
              /tj.js
            </code>{' '}
            or your custom domain proxy.
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);
WebsiteCodeBtn.displayName = 'WebsiteCodeBtn';
