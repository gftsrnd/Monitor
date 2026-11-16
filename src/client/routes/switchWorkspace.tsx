import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from '@tanstack/react-router';
import { useTranslation } from '@i18next-toolkit/react';
import { z } from 'zod';
import { useCurrentWorkspaceSafe, type UserLoginInfo } from '../store/user';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';
import { Button } from '@/components/ui/button';
import { useEvent } from '@/hooks/useEvent';
import { useAuth } from '@/api/authjs/useAuth';

export const Route = createFileRoute('/switchWorkspace')({
  validateSearch: z.object({
    // redirect: z.string().catch('/'),
    redirect: z.string().optional(),
  }),
  beforeLoad: ({ context }) => {
    const userInfo: UserLoginInfo | undefined = (context as any).userInfo;

    if (
      userInfo &&
      userInfo.currentWorkspaceId &&
      userInfo.workspaces.some(
        (w) => w.workspace.id === userInfo.currentWorkspaceId
      )
    ) {
      throw redirect({
        to: '/',
      });
    }
  },
  component: PageComponent,
});

function PageComponent() {
  const { t } = useTranslation();
  const currentWorkspace = useCurrentWorkspaceSafe();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleEnter = useEvent(() => {
    navigate({
      to: search.redirect ?? '/',
    });
  });

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Card className="min-w-[320px] bg-zinc-50 dark:bg-zinc-900 border-border/80 shadow-lg">
        <CardHeader>
          <div className="text-center">
            <div className="inline-flex items-center justify-center rounded-2xl p-2.5 bg-gradient-to-b from-amber-500/10 to-amber-500/5 ring-1 ring-amber-500/25 shadow-md shadow-amber-500/10">
              <img className="h-20 w-20 drop-shadow-md" src="/icon.png" alt="TFG Monitor" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-center">
          <div className="mb-2 text-lg font-bold">{t('Select Workspace')}</div>

          <WorkspaceSwitcher isCollapsed={false} />
        </CardContent>

        <CardFooter className="justify-end gap-2">
          <Button size="sm" variant="outline" onClick={logout}>
            {t('Logout')}
          </Button>
          <Button disabled={!currentWorkspace} size="sm" onClick={handleEnter}>
            {t('Enter')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
