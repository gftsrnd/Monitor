import { routeAuthBeforeLoad } from '@/utils/route';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from '@i18next-toolkit/react';
import { CommonWrapper } from '@/components/CommonWrapper';
import { ScrollArea } from '@/components/ui/scroll-area';
import { List, Popconfirm, Tag } from 'antd';
import { useState } from 'react';
import {
  defaultErrorHandler,
  defaultSuccessHandler,
  trpc,
} from '../../api/trpc';
import {
  NotificationFormValues,
  NotificationInfoModal,
} from '../../components/modals/NotificationInfo';
import { useEvent } from '../../hooks/useEvent';
import {
  useCurrentWorkspaceId,
  useHasAdminPermission,
  useHasWritePermission,
} from '../../store/user';
import { CommonHeader } from '@/components/CommonHeader';
import { Button } from '@/components/ui/button';
import {
  LuBell,
  LuFilePen,
  LuMail,
  LuPlus,
  LuSend,
  LuTrash2,
  LuWebhook,
  LuZap,
} from 'react-icons/lu';
import { compact } from 'lodash-es';

export const Route = createFileRoute('/settings/notifications')({
  beforeLoad: routeAuthBeforeLoad,
  component: PageComponent,
});

const QUICK_CHANNELS = [
  {
    type: 'telegram',
    title: 'Telegram Bot',
    descVi: 'Nhận tin nhắn cảnh báo tức thì qua nhóm hoặc chat cá nhân Telegram',
    descEn: 'Receive instant real-time alerts via Telegram group or direct chat',
    color: 'blue',
    Icon: LuSend,
  },
  {
    type: 'smtp',
    title: 'Email (SMTP)',
    descVi: 'Gửi email cảnh báo giao diện HTML kèm thương hiệu TFG Monitor',
    descEn: 'Send branded HTML incident & recovery alert emails via SMTP',
    color: 'gold',
    Icon: LuMail,
  },
  {
    type: 'webhook',
    title: 'Webhook JSON',
    descVi: 'Đẩy sự kiện tự động sang hệ thống nội bộ, n8n, Zapier hoặc API riêng',
    descEn: 'Push structured JSON alert payloads to internal APIs, n8n, or Zapier',
    color: 'purple',
    Icon: LuWebhook,
  },
  {
    type: 'apprise',
    title: 'Discord / Slack / 90+',
    descVi: 'Hỗ trợ Discord, Slack, Pushover, Google Chat, Mattermost qua chuẩn Apprise',
    descEn: 'Connect Discord, Slack, Pushover, Google Chat & 90+ services via Apprise',
    color: 'green',
    Icon: LuZap,
  },
] as const;

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  telegram: { label: 'Telegram', color: 'blue' },
  smtp: { label: 'Email (SMTP)', color: 'gold' },
  webhook: { label: 'Webhook', color: 'purple' },
  apprise: { label: 'Apprise (90+)', color: 'green' },
  teams: { label: 'MS Teams', color: 'geekblue' },
  feishu: { label: 'Feishu / Lark', color: 'cyan' },
};

function PageComponent() {
  const { t, i18n } = useTranslation();
  const isVi = (i18n.language || 'vi-VN').startsWith('vi');
  const [open, setOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const currentWorkspaceId = useCurrentWorkspaceId();
  const { data: list = [], refetch } = trpc.notification.all.useQuery({
    workspaceId: currentWorkspaceId!,
  });
  const [editingFormData, setEditingFormData] = useState<
    NotificationFormValues | undefined
  >(undefined);
  const hasAdminPermission = useHasAdminPermission();
  const hasWritePermission = useHasWritePermission();

  const upsertMutation = trpc.notification.upsert.useMutation();
  const deleteMutation = trpc.notification.delete.useMutation();
  const testMutation = trpc.notification.test.useMutation({
    onSuccess: defaultSuccessHandler,
    onError: defaultErrorHandler,
  });

  const handleOpenModal = useEvent((initValues?: NotificationFormValues) => {
    setEditingFormData(initValues);
    setOpen(true);
  });

  const handleCloseModal = useEvent(() => {
    setEditingFormData(undefined);
    setOpen(false);
  });

  const handleSubmit = useEvent(async (values: NotificationFormValues) => {
    await upsertMutation.mutateAsync({
      workspaceId: currentWorkspaceId!,
      ...values,
    });
    handleCloseModal();
    refetch();
  });

  const handleQuickTest = useEvent(
    async (item: {
      id: string;
      name: string;
      type: string;
      payload: unknown;
    }) => {
      try {
        setTestingId(item.id);
        await testMutation.mutateAsync({
          workspaceId: currentWorkspaceId!,
          name: item.name,
          type: item.type,
          payload: (item.payload ?? {}) as Record<string, any>,
        });
      } finally {
        setTestingId(null);
      }
    }
  );

  const handleDelete = useEvent(async (notificationId: string) => {
    await deleteMutation.mutateAsync({
      workspaceId: currentWorkspaceId!,
      id: notificationId,
    });
    refetch();
  });

  return (
    <CommonWrapper
      header={
        <CommonHeader
          title={t('Notifications')}
          actions={
            <>
              {hasWritePermission && (
                <Button
                  variant="default"
                  Icon={LuPlus}
                  onClick={() => handleOpenModal()}
                >
                  {t('New')}
                </Button>
              )}
            </>
          }
        />
      }
    >
      <ScrollArea className="h-full overflow-hidden p-4">
        <div className="mx-auto max-w-5xl space-y-6">
          {hasWritePermission && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {QUICK_CHANNELS.map((ch) => (
                <button
                  key={ch.type}
                  type="button"
                  onClick={() =>
                    handleOpenModal({
                      name: ch.title,
                      type: ch.type,
                      payload: {},
                    })
                  }
                  className="group flex flex-col items-start rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:border-amber-500/50 hover:bg-amber-500/5"
                >
                  <div className="mb-2 flex w-full items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
                      <ch.Icon className="h-4 w-4" />
                    </div>
                    <Tag color={ch.color} className="m-0 text-xs">
                      + {t('New')}
                    </Tag>
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {ch.title}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {isVi ? ch.descVi : ch.descEn}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-border bg-card">
            <List
              bordered={false}
              dataSource={list}
              locale={{
                emptyText: (
                  <div className="py-10 text-center text-muted-foreground">
                    <LuBell className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    <div className="text-sm font-medium">
                      {isVi
                        ? 'Chưa có kênh thông báo nào được thiết lập'
                        : 'No notification channels configured yet'}
                    </div>
                    <div className="mt-1 text-xs opacity-80">
                      {isVi
                        ? 'Chọn một kênh phía trên (khuyên dùng Telegram hoặc Email) để nhận cảnh báo ngay khi Website/API hoặc Máy chủ gặp sự cố.'
                        : 'Pick a quick channel card above (Telegram or Email recommended) to receive instant alerts on outages.'}
                    </div>
                  </div>
                ),
              }}
              renderItem={(item) => {
                const badge = TYPE_LABELS[item.type] ?? {
                  label: item.type,
                  color: 'default',
                };
                return (
                  <List.Item
                    className="px-4"
                    actions={compact([
                      hasWritePermission && (
                        <Button
                          variant="outline"
                          size="sm"
                          Icon={LuSend}
                          loading={testingId === item.id}
                          onClick={() => handleQuickTest(item)}
                        >
                          {t('Test')}
                        </Button>
                      ),
                      hasWritePermission && (
                        <Button
                          variant="default"
                          size="sm"
                          Icon={LuFilePen}
                          onClick={() => {
                            handleOpenModal({
                              id: item.id,
                              name: item.name,
                              type: item.type,
                              payload: item.payload as Record<string, any>,
                            });
                          }}
                        >
                          {t('Edit')}
                        </Button>
                      ),
                      hasAdminPermission && (
                        <Popconfirm
                          title={t('Delete this item?')}
                          okButtonProps={{
                            danger: true,
                          }}
                          onConfirm={() => {
                            handleDelete(item.id);
                          }}
                        >
                          <Button variant="destructive" size="icon">
                            <LuTrash2 />
                          </Button>
                        </Popconfirm>
                      ),
                    ])}
                  >
                    <List.Item.Meta
                      title={
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold">{item.name}</span>
                          <Tag color={badge.color} className="m-0">
                            {badge.label}
                          </Tag>
                        </div>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          </div>

          <NotificationInfoModal
            key={editingFormData?.id ?? editingFormData?.type ?? 'new'}
            open={open}
            initialValues={editingFormData}
            onSubmit={handleSubmit}
            onCancel={() => handleCloseModal()}
          />
        </div>
      </ScrollArea>
    </CommonWrapper>
  );
}
