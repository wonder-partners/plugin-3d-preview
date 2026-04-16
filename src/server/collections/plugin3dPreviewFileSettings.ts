export default {
  dumpRules: {
    group: 'user',
  },
  migrationRules: ['schema-only'],
  shared: true,
  name: 'plugin3dPreviewFileSettings',
  createdBy: true,
  updatedBy: true,
  fields: [
    {
      type: 'bigInt',
      name: 'fileId',
      unique: true,
    },
    {
      type: 'bigInt',
      name: 'environmentMapId',
    },
    {
      type: 'belongsTo',
      name: 'file',
      target: 'attachments',
      foreignKey: 'fileId',
      onDelete: 'CASCADE',
    },
    {
      type: 'belongsTo',
      name: 'environmentMap',
      target: 'attachments',
      foreignKey: 'environmentMapId',
      onDelete: 'SET NULL',
    },
  ],
};
