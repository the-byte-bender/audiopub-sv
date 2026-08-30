"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("Reactions", {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
            },
            userId: {
                allowNull: false,
                type: Sequelize.UUID,
                references: { model: "Users", key: "id" },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
            },
            // Polymorphic target: "comment" or "stream_chat". Not a real FK,
            // so deletions are cleaned up by the application.
            targetType: {
                allowNull: false,
                type: Sequelize.STRING(32),
            },
            targetId: {
                allowNull: false,
                type: Sequelize.UUID,
            },
            emoji: {
                allowNull: false,
                type: Sequelize.STRING(16),
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
        });

        await queryInterface.addIndex(
            "Reactions",
            ["userId", "targetType", "targetId"],
            { unique: true, name: "uniq_reaction_user_target" },
        );
        await queryInterface.addIndex("Reactions", ["targetType", "targetId"]);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("Reactions");
    },
};
