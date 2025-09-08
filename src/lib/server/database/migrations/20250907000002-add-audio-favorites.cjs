'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create AudioFavorites table
    await queryInterface.createTable('AudioFavorites', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      audioId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Audios',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add unique constraint for AudioFavorites to prevent duplicate favorites
    await queryInterface.addConstraint('AudioFavorites', {
      fields: ['userId', 'audioId'],
      type: 'unique',
      name: 'uniq_audio_favorite_user_audio'
    });

    // Add indexes for better performance
    await queryInterface.addIndex('AudioFavorites', ['userId']);
    await queryInterface.addIndex('AudioFavorites', ['audioId']);
    await queryInterface.addIndex('AudioFavorites', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    // Drop AudioFavorites table
    await queryInterface.dropTable('AudioFavorites');
  }
};