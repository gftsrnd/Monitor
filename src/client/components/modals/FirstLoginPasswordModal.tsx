import React from 'react';
import { Form, Input, Modal } from 'antd';
import { useTranslation } from '@i18next-toolkit/react';
import { Button } from '@/components/ui/button';
import { defaultErrorHandler, trpc } from '@/api/trpc';
import { useUserInfo } from '@/store/user';
import { toast } from 'sonner';
import { LuShieldCheck } from 'react-icons/lu';

export const FirstLoginPasswordModal: React.FC = React.memo(() => {
  const userInfo = useUserInfo();
  const { i18n } = useTranslation();
  const isVi = (i18n.language || 'vi-VN').startsWith('vi');
  const [form] = Form.useForm();
  const trpcUtils = trpc.useUtils();

  const { data } = trpc.user.firstLoginStatus.useQuery(undefined, {
    enabled: Boolean(userInfo?.id && userInfo?.username === 'admin'),
    staleTime: 60_000,
  });

  const completeMutation = trpc.user.completeFirstLoginPassword.useMutation({
    onError: defaultErrorHandler,
  });

  if (!data?.mustChangePassword) {
    return null;
  }

  return (
    <Modal
      open={true}
      closable={false}
      maskClosable={false}
      keyboard={false}
      centered={true}
      footer={null}
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30">
            <LuShieldCheck className="h-4 w-4" />
          </div>
          <span>
            {isVi
              ? 'Thiết lập mật khẩu quản trị riêng của bạn'
              : 'Set Your Custom Administrator Password'}
          </span>
        </div>
      }
    >
      <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
        {isVi
          ? 'Đây là lần đăng nhập đầu tiên bằng mật khẩu khởi tạo tạm thời. Hãy đặt mật khẩu riêng theo ý bạn (tối thiểu 8 ký tự) để khóa bảo mật vĩnh viễn cho tài khoản admin.'
          : 'You signed in with the one-time bootstrap password. Please set your own permanent password (minimum 8 characters) to secure the admin account.'}
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          await completeMutation.mutateAsync({
            newPassword: values.newPassword,
          });
          await trpcUtils.user.firstLoginStatus.invalidate();
          toast.success(
            isVi
              ? 'Đã lưu mật khẩu quản trị mới thành công!'
              : 'Administrator password updated successfully!'
          );
        }}
      >
        <Form.Item
          label={isVi ? 'Mật khẩu mới của bạn' : 'Your New Password'}
          name="newPassword"
          rules={[
            {
              required: true,
              message: isVi
                ? 'Vui lòng nhập mật khẩu mới'
                : 'Please enter a new password',
            },
            {
              min: 8,
              message: isVi
                ? 'Mật khẩu cần tối thiểu 8 ký tự'
                : 'Password must be at least 8 characters',
            },
          ]}
        >
          <Input.Password
            autoFocus
            placeholder={
              isVi ? 'Tối thiểu 8 ký tự...' : 'At least 8 characters...'
            }
          />
        </Form.Item>

        <Form.Item
          label={isVi ? 'Nhập lại mật khẩu mới' : 'Confirm New Password'}
          name="confirmPassword"
          dependencies={['newPassword']}
          rules={[
            {
              required: true,
              message: isVi
                ? 'Vui lòng nhập lại mật khẩu'
                : 'Please confirm your password',
            },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(
                  new Error(
                    isVi
                      ? 'Hai mật khẩu nhập vào không khớp'
                      : 'Passwords do not match'
                  )
                );
              },
            }),
          ]}
        >
          <Input.Password
            placeholder={
              isVi ? 'Nhập lại chính xác mật khẩu trên...' : 'Re-enter password...'
            }
          />
        </Form.Item>

        <Button
          type="submit"
          className="mt-2 w-full"
          loading={completeMutation.isPending}
        >
          {isVi
            ? 'Lưu mật khẩu & Bắt đầu sử dụng'
            : 'Save Password & Continue'}
        </Button>
      </Form>
    </Modal>
  );
});
FirstLoginPasswordModal.displayName = 'FirstLoginPasswordModal';
