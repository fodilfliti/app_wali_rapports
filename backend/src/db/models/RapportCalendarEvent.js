const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "RapportCalendarEvent",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      rapport_id: { type: DataTypes.BIGINT, allowNull: false },
      event_date: { type: DataTypes.DATEONLY, allowNull: false },
      title_ar: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
      title_fr: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
      note_ar: { type: DataTypes.TEXT, allowNull: true },
      note_fr: { type: DataTypes.TEXT, allowNull: true },
      created_by_user_id: { type: DataTypes.BIGINT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "rapport_calendar_events", timestamps: false }
  );
