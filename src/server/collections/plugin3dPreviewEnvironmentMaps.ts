export default {
  dumpRules: {
    group: 'user',
  },
  migrationRules: ['schema-only'],
  shared: true,
  name: 'plugin3dPreviewEnvironmentMaps',
  title: '3D preview environment maps',
  createdBy: true,
  updatedBy: true,
  fields: [
    {
      type: 'string',
      name: 'title',
    },
    {
      type: 'bigInt',
      name: 'attachmentId',
      unique: true,
      allowNull: false,
    },
    {
      type: 'belongsTo',
      name: 'attachment',
      target: 'attachments',
      foreignKey: 'attachmentId',
      onDelete: 'CASCADE',
    },
  ],
};
