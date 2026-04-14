const defineScheme = (sequelize, DataTypes) => {
  const scheme = sequelize.define('scheme', {
    schemeId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: DataTypes.STRING
  },
  {
    tableName: 'schemes',
    freezeTableName: true,
    timestamps: false
  })

  scheme.associate = (models) => {
    scheme.hasMany(models.retentionData, {
      foreignKey: 'schemeId',
      as: 'retentionData'
    })
  }

  return scheme
}

module.exports = defineScheme
