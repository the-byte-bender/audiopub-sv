"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("StreamPolls", {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
            },
            streamId: {
                allowNull: false,
                type: Sequelize.UUID,
                references: { model: "Streams", key: "id" },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
            },
            createdById: {
                allowNull: true,
                type: Sequelize.UUID,
                references: { model: "Users", key: "id" },
                onDelete: "SET NULL",
                onUpdate: "CASCADE",
            },
            question: {
                allowNull: false,
                type: Sequelize.TEXT,
            },
            state: {
                allowNull: false,
                type: Sequelize.STRING(16),
                defaultValue: "open",
            },
            closedAt: {
                allowNull: true,
                type: Sequelize.DATE,
            },
            allowMultiple: {
                allowNull: false,
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            hideResultsUntilVote: {
                allowNull: false,
                type: Sequelize.BOOLEAN,
                defaultValue: false,
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

        await queryInterface.createTable("StreamPollOptions", {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
            },
            pollId: {
                allowNull: false,
                type: Sequelize.UUID,
                references: { model: "StreamPolls", key: "id" },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
            },
            text: {
                allowNull: false,
                type: Sequelize.STRING(200),
            },
            position: {
                allowNull: false,
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            voteCount: {
                allowNull: false,
                type: Sequelize.INTEGER,
                defaultValue: 0,
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

        await queryInterface.createTable("StreamPollVotes", {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
            },
            pollId: {
                allowNull: false,
                type: Sequelize.UUID,
                references: { model: "StreamPolls", key: "id" },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
            },
            optionId: {
                allowNull: false,
                type: Sequelize.UUID,
                references: { model: "StreamPollOptions", key: "id" },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
            },
            userId: {
                allowNull: false,
                type: Sequelize.UUID,
                references: { model: "Users", key: "id" },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
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

        await queryInterface.addIndex("StreamPolls", ["streamId", "createdAt"]);
        await queryInterface.addIndex("StreamPollOptions", [
            "pollId",
            "position",
        ]);
        // One row per selected option, so uniqueness spans the option too.
        await queryInterface.addIndex(
            "StreamPollVotes",
            ["pollId", "userId", "optionId"],
            { unique: true, name: "uniq_poll_vote_user_option" },
        );
        // Leads with pollId, which the foreign key on that column needs.
        await queryInterface.addIndex("StreamPollVotes", ["pollId", "userId"], {
            name: "poll_votes_poll_user",
        });
        await queryInterface.addIndex("StreamPollVotes", ["optionId"]);
    },

    async down(queryInterface) {
        await queryInterface.dropTable("StreamPollVotes");
        await queryInterface.dropTable("StreamPollOptions");
        await queryInterface.dropTable("StreamPolls");
    },
};
