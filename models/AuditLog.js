const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

class AuditLog extends Model {}

AuditLog.init(
  {
    user_id: DataTypes.INTEGER,
    action: DataTypes.STRING,
    entity_type: DataTypes.STRING,
    entity_id: DataTypes.INTEGER,
    ip_address: DataTypes.STRING,
    user_agent: DataTypes.STRING,
  },
  {
    sequelize,
    modelName: "AuditLog",
    tableName: "audit_logs",
    underscored: true,
  }
);

module.exports = AuditLog;
