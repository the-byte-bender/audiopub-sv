"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add editCount to Audios
    await queryInterface.addColumn("Audios", "editCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    // Create AudioEditHistories table
    await queryInterface.createTable("AudioEditHistories", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      audioId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Audios",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      oldTitle: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      oldDescription: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      newTitle: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      newDescription: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("AudioEditHistories");
    await queryInterface.removeColumn("Audios", "editCount");
  },
};
