"use strict";

/**
 * Multi-audience guide videos:
 * - create guide_video_audiences junction
 * - backfill from guide_videos.audience
 * - drop scalar audience column
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const qi = queryInterface.sequelize;

    await qi.query(`
      CREATE TABLE IF NOT EXISTS "guide_video_audiences" (
        "id" BIGSERIAL PRIMARY KEY,
        "guide_video_id" BIGINT NOT NULL
          REFERENCES "guide_videos" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
        "audience" "enum_guide_videos_audience" NOT NULL,
        CONSTRAINT "guide_video_audiences_guide_video_id_audience_unique"
          UNIQUE ("guide_video_id", "audience")
      );
    `);

    await qi.query(`
      CREATE INDEX IF NOT EXISTS "guide_video_audiences_audience"
      ON "guide_video_audiences" ("audience");
    `);

    await qi.query(`
      INSERT INTO "guide_video_audiences" ("guide_video_id", "audience")
      SELECT "id", "audience" FROM "guide_videos"
      ON CONFLICT DO NOTHING;
    `);

    await qi.query(`DROP INDEX IF EXISTS "guide_videos_audience";`);
    await qi.query(`ALTER TABLE "guide_videos" DROP COLUMN IF EXISTS "audience";`);
  },

  async down(queryInterface) {
    const qi = queryInterface.sequelize;

    await qi.query(`
      ALTER TABLE "guide_videos"
      ADD COLUMN IF NOT EXISTS "audience" "enum_guide_videos_audience"
      NOT NULL DEFAULT 'general';
    `);

    await qi.query(`
      UPDATE "guide_videos" gv
      SET "audience" = sub."audience"
      FROM (
        SELECT DISTINCT ON ("guide_video_id")
          "guide_video_id",
          "audience"
        FROM "guide_video_audiences"
        ORDER BY
          "guide_video_id",
          CASE WHEN "audience" = 'general' THEN 1 ELSE 0 END,
          "id" ASC
      ) AS sub
      WHERE gv."id" = sub."guide_video_id";
    `);

    await qi.query(`
      CREATE INDEX IF NOT EXISTS "guide_videos_audience"
      ON "guide_videos" ("audience");
    `);

    await queryInterface.dropTable("guide_video_audiences");
  },
};
