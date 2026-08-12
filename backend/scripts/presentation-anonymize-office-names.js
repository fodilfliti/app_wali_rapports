/**
 * Temporarily anonymize OFFICE_USER display names for presentation screenshots.
 * Usage:
 *   node scripts/presentation-anonymize-office-names.js          # backup + replace
 *   node scripts/presentation-anonymize-office-names.js --restore # restore from backup
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const BACKUP_PATH = path.join(__dirname, "..", "private", "presentation-office-names-backup.json");

const FAKE_NAMES = [
  "أحمد بن يوسف",
  "محمد الأمين",
  "عبد الرحمن بلقاسم",
  "يوسف حاجي",
  "كريم بوزيد",
  "سعيد مرابط",
  "نور الدين عماري",
  "إلياس بن علي",
  "رضا قاسمي",
  "حسام طاهر",
  "فاروق بن صالح",
  "عمر خالدي",
  "ياسين بوزيان",
  "سليم عباد",
  "بلال منصوري",
  "أمين زروقي",
  "نادر بلحاج",
  "وليد بن عمر",
  "رشيد عباسي",
  "توفيق حمدي",
  "جمال بن سعيد",
  "فؤاد لعربي",
  "سمير بوعلام",
  "لطفي بن يوسف",
  "هشام قادري",
  "مراد بن عيسى",
  "زياد شريف",
  "أنور بن محمد",
  "خالد بوعزة",
  "إدريس بن قاسم",
];

const FAKE_JOB_TITLES = [
  "ملحق بالديوان",
  "متابع الملفات",
  "إطار بالديوان",
  "عون دراسات",
  "ملحق إداري",
];

async function main() {
  const restore = process.argv.includes("--restore");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    if (restore) {
      if (!fs.existsSync(BACKUP_PATH)) {
        throw new Error(`Backup not found: ${BACKUP_PATH}`);
      }
      const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, "utf8"));
      if (!Array.isArray(backup.users) || !backup.users.length) {
        throw new Error("Backup file has no users");
      }
      await client.query("BEGIN");
      for (const u of backup.users) {
        await client.query(
          `UPDATE users SET name = $1, job_title = $2 WHERE id = $3 AND role = 'OFFICE_USER'`,
          [u.name, u.job_title, u.id],
        );
      }
      await client.query("COMMIT");
      console.log(`Restored ${backup.users.length} OFFICE_USER name(s) from backup.`);
      return;
    }

    const { rows } = await client.query(
      `SELECT id, uuid, username, name, job_title, role
       FROM users
       WHERE role = 'OFFICE_USER' AND deleted_at IS NULL
       ORDER BY id`,
    );

    if (!rows.length) {
      console.log("No OFFICE_USER rows found.");
      return;
    }

    const privateDir = path.dirname(BACKUP_PATH);
    if (!fs.existsSync(privateDir)) fs.mkdirSync(privateDir, { recursive: true });

    if (fs.existsSync(BACKUP_PATH)) {
      const existing = JSON.parse(fs.readFileSync(BACKUP_PATH, "utf8"));
      if (existing?.users?.length && !process.argv.includes("--force")) {
        throw new Error(
          `Backup already exists at ${BACKUP_PATH}. Restore first, or pass --force to overwrite.`,
        );
      }
    }

    const backup = {
      created_at: new Date().toISOString(),
      note: "Real OFFICE_USER names before presentation anonymization. Restore with --restore.",
      users: rows.map((r) => ({
        id: r.id,
        uuid: r.uuid,
        username: r.username,
        name: r.name,
        job_title: r.job_title,
      })),
    };
    fs.writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2), "utf8");
    console.log(`Backup written: ${BACKUP_PATH} (${backup.users.length} users)`);

    await client.query("BEGIN");
    for (let i = 0; i < rows.length; i++) {
      const fakeName = FAKE_NAMES[i % FAKE_NAMES.length];
      // Keep uniqueness if more users than names
      const name =
        rows.length > FAKE_NAMES.length && i >= FAKE_NAMES.length
          ? `${fakeName} ${i + 1}`
          : fakeName;
      const job = FAKE_JOB_TITLES[i % FAKE_JOB_TITLES.length];
      await client.query(
        `UPDATE users SET name = $1, job_title = $2 WHERE id = $3 AND role = 'OFFICE_USER'`,
        [name, job, rows[i].id],
      );
      console.log(`  ${rows[i].username}: ${rows[i].name || "(null)"} → ${name}`);
    }
    await client.query("COMMIT");
    console.log(`Anonymized ${rows.length} OFFICE_USER display name(s). Usernames unchanged (login still works).`);
    console.log("When done with screenshots, run:");
    console.log("  node scripts/presentation-anonymize-office-names.js --restore");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
