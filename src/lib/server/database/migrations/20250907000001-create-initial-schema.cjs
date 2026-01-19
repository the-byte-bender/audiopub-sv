'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create Users table
    await queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      displayName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      verificationToken: {
        type: Sequelize.UUID,
        allowNull: true,
        defaultValue: Sequelize.UUIDV4
      },
      verificationAttempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      resetPasswordToken: {
        type: Sequelize.UUID,
        allowNull: true,
        defaultValue: Sequelize.UUIDV4
      },
      isBanned: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      isTrusted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      isAdmin: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
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

    // Create Audios table
    await queryInterface.createTable('Audios', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      title: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: ''
      },
      hasFile: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      plays: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      extension: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'aac'
      },
      isFromAi: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
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

    // Create Comments table
    await queryInterface.createTable('Comments', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      audioId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Audios',
          key: 'id'
        }
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

    // Create PlaysTrackers table
    await queryInterface.createTable('PlaysTrackers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
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
      lastPlayedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Create Notifications table
    await queryInterface.createTable('Notifications', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      actorId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      targetType: {
        type: Sequelize.STRING,
        allowNull: false
      },
      targetId: {
        type: Sequelize.UUID,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true
      },
      readAt: {
        type: Sequelize.DATE,
        allowNull: true
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

    // Create AudioFollows table
    await queryInterface.createTable('AudioFollows', {
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

    // Add indexes
    await queryInterface.addIndex('Audios', ['title'], {
      type: 'FULLTEXT',
      name: 'audios_title_fulltext_idx'
    });
    
    await queryInterface.addIndex('Audios', ['title', 'description'], {
      type: 'FULLTEXT',
      name: 'audios_title_description_fulltext_idx'
    });

    await queryInterface.addIndex('Notifications', ['type']);
    await queryInterface.addIndex('Notifications', ['targetType']);
    await queryInterface.addIndex('Notifications', ['targetId']);
    await queryInterface.addIndex('Notifications', ['readAt']);

    // Add unique constraint for AudioFollows
    await queryInterface.addConstraint('AudioFollows', {
      fields: ['userId', 'audioId'],
      type: 'unique',
      name: 'uniq_audio_follow_user_audio'
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order of dependencies
    await queryInterface.dropTable('AudioFollows');
    await queryInterface.dropTable('Notifications');
    await queryInterface.dropTable('PlaysTrackers');
    await queryInterface.dropTable('Comments');
    await queryInterface.dropTable('Audios');
    await queryInterface.dropTable('Users');
  }
};