const defineRetentionData = (sequelize, DataTypes) => {
  const retentionData = sequelize.define('retentionData', {
    retentionDataId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    frn: DataTypes.BIGINT,
    schemeId: DataTypes.INTEGER,
    agreementNumber: DataTypes.STRING,
    endDate: DataTypes.DATE
  },
  {
    tableName: 'retentionData',
    freezeTableName: true,
    timestamps: false
  })

  retentionData.associate = (models) => {
    retentionData.belongsTo(models.scheme, {
      foreignKey: 'schemeId',
      as: 'scheme'
    })
  }

  return retentionData
}

module.exports = defineRetentionData
