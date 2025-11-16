"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Comments", "parentId", {
      type: Sequelize.UUID,
      allowNull: true,
      // Comments with replies should be marked as tombstones instead of deleted, but this exists for when a user is banned
      onDelete: "CASCADE",
      references: {
        model: "Comments",
        key: "id",
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Comments", "parentId");
  },
};
