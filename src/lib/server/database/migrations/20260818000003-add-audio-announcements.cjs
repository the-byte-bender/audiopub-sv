"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn("Audios", "isAnnouncement", {
            allowNull: false,
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        });
        await queryInterface.addIndex("Audios", ["isAnnouncement"], {
            name: "audios_is_announcement",
        });
    },

    async down(queryInterface) {
        // Raw DDL on purpose: queryInterface.removeColumn throws
        // "Cannot delete property 'meta' of [object Array]" with the mariadb
        // driver this project pins. Dropping the column also drops the index
        // that covers only it, so removeIndex is unnecessary.
        await queryInterface.sequelize.query(
            "ALTER TABLE `Audios` DROP COLUMN `isAnnouncement`",
        );
    },
};
