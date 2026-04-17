export default {
  dumpRules: {
    group: 'user',
  },
  migrationRules: ['schema-only'],
  shared: true,
  name: 'plugin3dPreviewSettings',
  fields: [
    {
      type: 'string',
      name: 'key',
      unique: true,
      allowNull: false,
    },
    {
      type: 'jsonb',
      name: 'value',
      defaultValue: {},
    },
  ],
};
