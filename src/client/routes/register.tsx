import { Form, Typography } from 'antd';
import { useRequest } from '../hooks/useRequest';
import { trpc } from '../api/trpc';
import { setUserInfo } from '../store/user';
import { useTranslation } from '@i18next-toolkit/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/api/authjs/useAuth';
import { DotPatternBackground } from '@/components/DotPatternBackground';
import { useTheme } from '@/store/settings';

export const Route = createFileRoute('/register')({
  component: RegisterComponent,
});

function RegisterComponent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();

  const { loginWithPassword } = useAuth();
  const mutation = trpc.user.register.useMutation();

  const [{ loading }, handleRegister] = useRequest(async (values: any) => {
    await mutation.mutateAsync({
      username: values.username,
      password: values.password,
    });

    const userInfo = await loginWithPassword(values.username, values.password);

    setUserInfo(userInfo);

    navigate({
      to: '/',
      replace: true,
    });
  });

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
          {t('Register Account')}
        </Typography.Title>
        <Form layout="vertical" disabled={loading} onFinish={handleRegister}>
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
              loading={loading}
            >
              {t('Register')}
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
