'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('rapport_versions', 'changed_entity_keys', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    await queryInterface.addColumn('rapport_versions', 'entity_versions', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('rapport_versions', 'changed_entity_keys');
    await queryInterface.removeColumn('rapport_versions', 'entity_versions');
  },
};
