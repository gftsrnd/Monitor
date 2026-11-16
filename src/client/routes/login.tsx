import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useGlobalConfig } from '@/hooks/useConfig';
import { Divider, Form, Typography } from 'antd';
import { useTranslation } from '@i18next-toolkit/react';
import { setUserInfo } from '@/store/user';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/api/authjs/useAuth';
import { useEventWithLoading } from '@/hooks/useEvent';
import { LuGithub, LuLayers } from 'react-icons/lu';
import { compact } from 'lodash-es';
import { toast } from 'sonner';
import { DotPatternBackground } from '@/components/DotPatternBackground';
import { useTheme } from '@/store/settings';

export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    // redirect: z.string().catch('/'),
    redirect: z.string().optional(),
  }),
  beforeLoad: ({ context }) => {
    if (context.userInfo) {
      redirect({
        to: '/monitor',
      });
    }
  },
  component: LoginComponent,
});

function LoginComponent() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const search = Route.useSearch();
  const theme = useTheme();

  const { loginWithPassword, loginWithEmail, loginWithOAuth } = useAuth();

  const [handleLoginWithAccount, isAccountLoading] = useEventWithLoading(
    async (values: any) => {
      const userInfo = await loginWithPassword(
        values.username,
        values.password
      );

      setUserInfo(userInfo);

      navigate({
        to: search.redirect ?? '/',
        replace: true,
      });
    }
  );
  const [handleLoginWithEmail, isEmailLoading] = useEventWithLoading(
    async (values: any) => {
      const url = await loginWithEmail(values.email, search.redirect);

      if (url) {
        window.location.replace(url);
      } else {
        toast.success('Email has been sent');
      }
    }
  );
  const { allowRegister, authProvider, customAuthProviderIcon } =
    useGlobalConfig();

  const mainAuthProvider = authProvider.includes('email') ? (
    <Form
      layout="vertical"
      disabled={isEmailLoading}
      onFinish={handleLoginWithEmail}
    >
      <Form.Item label={t('Email')} name="email" rules={[{ required: true }]}>
        <Input type="email" />
      </Form.Item>
      <Form.Item>
        <Button
          size="lg"
          type="submit"
          className="w-full"
          loading={isEmailLoading}
        >
          {t('Login')}
        </Button>
      </Form.Item>
    </Form>
  ) : authProvider.includes('account') ? (
    <Form
      layout="vertical"
      disabled={isAccountLoading}
      onFinish={handleLoginWithAccount}
    >
      <Form.Item
        label={t('Username')}
        name="username"
        rules={[{ required: true }]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label={t('Password')}
        name="password"
        rules={[{ required: true }]}
      >
        <Input type="password" />
      </Form.Item>
      <Form.Item>
        <Button
          size="lg"
          type="submit"
          className="w-full"
          loading={isAccountLoading}
        >
          {t('Login')}
        </Button>
      </Form.Item>

      {allowRegister && (
        <Form.Item>
          <Button
            variant="secondary"
            size="lg"
            type="button"
            className="w-full"
            onClick={() => {
              navigate({
                to: '/register',
              });
            }}
          >
            {t('Register')}
          </Button>
        </Form.Item>
      )}
    </Form>
  ) : null;

  const extraAuthProviderEl = compact([
    authProvider.includes('github') && (
      <Button
        variant="secondary"
        className="h-12 w-12 p-3"
        onClick={() => loginWithOAuth('github', search.redirect)}
      >
        <LuGithub size={24} />
      </Button>
    ),
    authProvider.includes('custom') && (
      <Button
        variant="secondary"
        className="h-12 w-12 p-3"
        onClick={() => loginWithOAuth('custom', search.redirect)}
      >
        {customAuthProviderIcon ? (
          <img src={customAuthProviderIcon} className="h-6 w-6" />
        ) : (
          <LuLayers size={24} />
        )}
      </Button>
    ),
  ]);

  return (
    <div className="flex h-full w-full items-center justify-center">
      {theme === 'dark' && <DotPatternBackground />}

      <div className="w-80 -translate-y-1/4">
        <div className="mb-4 text-center">
          <div className="inline-flex items-center justify-center rounded-2xl p-2.5 bg-gradient-to-b from-amber-500/10 to-amber-500/5 ring-1 ring-amber-500/25 shadow-lg shadow-amber-500/10 backdrop-blur-sm">
            <img className="h-20 w-20 drop-shadow-md" src="/icon.png" alt="TFG Monitor" />
          </div>
        </div>
        <Typography.Title className="text-center !mb-6 font-bold tracking-tight" level={2}>
          TFG Monitor
        </Typography.Title>

        {mainAuthProvider}

        {extraAuthProviderEl.length > 0 && (
          <>
            {mainAuthProvider ? (
              <Divider>{t('Or')}</Divider>
            ) : (
              <Divider>{t('Use Third Party Auth to Login')}</Divider>
            )}

            <div className="flex justify-center gap-2">
              {extraAuthProviderEl}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
