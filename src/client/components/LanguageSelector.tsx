import React from 'react';
import { setLanguage, useTranslation } from '@i18next-toolkit/react';
import { Button, Dropdown } from 'antd';
import { LuLanguages } from 'react-icons/lu';
import { languages } from '@/utils/i18n';

export const LanguageSelector: React.FC = React.memo(() => {
  const { i18n } = useTranslation();

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        selectedKeys: [i18n.language || 'vi-VN'],
        items: languages.map((lang) => ({
          label: lang.label,
          key: lang.key,
        })),
        onClick: (info) => {
          setLanguage(info.key);
        },
      }}
    >
      <Button
        icon={<LuLanguages className="anticon" />}
        shape="circle"
        size="large"
      />
    </Dropdown>
  );
});
LanguageSelector.displayName = 'LanguageSelector';
