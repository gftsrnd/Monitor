import React from 'react';
import { Button } from './ui/button';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from '@i18next-toolkit/react';
import { Card, CardContent, CardFooter, CardHeader } from './ui/card';
import { Code } from './Code';

export const DefaultNotFound: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Card className="min-w-[320px] bg-zinc-50 dark:bg-zinc-900">
        <CardHeader>
          <div className="text-center">
            <div className="inline-flex items-center justify-center rounded-2xl p-2.5 bg-gradient-to-b from-amber-500/10 to-amber-500/5 ring-1 ring-amber-500/25 shadow-md shadow-amber-500/10">
              <img className="h-20 w-20 drop-shadow-md" src="/icon.png" alt="TFG Monitor" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-center">
          <div>{t('Sorry, but this page is not found')}</div>
          <div>
            <b>{t('Path')}</b>: <Code>{pathname}</Code>
          </div>
        </CardContent>
        <CardFooter>
          <Link className="ml-auto" to="/">
            <Button>{t('Back to Homepage')}</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
});
DefaultNotFound.displayName = 'DefaultNotFound';
