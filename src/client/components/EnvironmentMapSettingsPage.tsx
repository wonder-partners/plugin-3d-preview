import React from 'react';
import { Tabs } from 'antd';
import { EnvironmentMapsAdminPage } from './EnvironmentMapsAdminPage';
import { EnvironmentMapStorageSettingsPage } from './EnvironmentMapStorageSettingsPage';

export function EnvironmentMapSettingsPage() {
  return (
    <Tabs
      defaultActiveKey="environment-maps"
      items={[
        {
          key: 'environment-maps',
          label: 'Environment maps',
          children: <EnvironmentMapsAdminPage />,
        },
        {
          key: 'storage',
          label: 'Storage',
          children: <EnvironmentMapStorageSettingsPage />,
        },
      ]}
    />
  );
}
