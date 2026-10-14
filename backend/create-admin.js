
require("dotenv").config();

const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  let db;

  try {
    const fullName = (await rl.question("Admin full name: ")).trim();
    const email = (
      await rl.question("Admin email: ")
    ).trim().toLowerCase();
    const password = await rl.question("Create admin password: ");

    if (!fullName || !email || !password) {
      throw new Error("All fields are required.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please enter a valid email address.");
    }

    if (password.length < 12) {
      throw new Error("Use a password with at least 12 characters.");
    }

    db = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "university_registration",
    });

    const [existing] = await db.execute(
      "SELECT id FROM admins WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      throw new Error("An admin with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db.execute(
      `INSERT INTO admins (full_name, email, password_hash)
       VALUES (?, ?, ?)`,
      [fullName, email, passwordHash]
    );

    console.log("\nAdmin account created successfully!");
    console.log(`Email: ${email}`);
    console.log("Keep your password private.");
  } finally {
    rl.close();
    if (db) await db.end();
  }
}

main().catch((error) => {
  console.error("\nCould not create admin:", error.message);
  process.exitCode = 1;
});
