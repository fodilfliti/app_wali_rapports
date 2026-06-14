'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add commune_content_kind to rapport_types
    // We check if the ENUM already exists or create it
    await queryInterface.addColumn('rapport_types', 'commune_content_kind', {
      type: Sequelize.STRING(20), // Use string first to avoid enum issues in migration
      allowNull: false,
      defaultValue: 'complex'
    });

    // 2. Add changed_commune_codes and commune_versions to rapport_versions
    await queryInterface.addColumn('rapport_versions', 'changed_commune_codes', {
      type: Sequelize.JSONB,
      allowNull: true
    });
    await queryInterface.addColumn('rapport_versions', 'commune_versions', {
      type: Sequelize.JSONB,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('rapport_types', 'commune_content_kind');
    await queryInterface.removeColumn('rapport_versions', 'changed_commune_codes');
    await queryInterface.removeColumn('rapport_versions', 'commune_versions');
  }
};
