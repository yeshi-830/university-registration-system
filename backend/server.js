
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "university_registration",
  waitForConnections: true,
  connectionLimit: 10,
});

app.get("/", (req, res) => {
  res.json({
    message: "University Registration System API is running!",
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");

    res.json({
      server: "running",
      database: "connected",
    });
  } catch (error) {
    console.error("Database error:", error.message);

    res.status(500).json({
      server: "running",
      database: "disconnected",
      message: "Check your MySQL settings.",
    });
  }
});

app.get("/api/courses", async (req, res) => {
  try {
    const [courses] = await db.query(
      "SELECT id, course_code, course_name, credit_hours, department FROM courses ORDER BY course_code"
    );

    res.json(courses);
  } catch (error) {
    console.error("Course error:", error.message);

    res.status(500).json({
      message: "Could not load courses.",
    });
  }
});

app.post("/api/students", async (req, res) => {
  try {
    const { full_name, email, student_number, department } = req.body;

    // Check that all fields are provided
    if (
      !full_name?.trim() ||
      !email?.trim() ||
      !student_number?.trim() ||
      !department?.trim()
    ) {
      return res.status(400).json({
        message: "Please complete all fields.",
      });
    }

    // Basic email validation
    const cleanEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address.",
      });
    }

    // Save the student using a parameterized SQL query
    const [result] = await db.execute(
      `INSERT INTO students
       (full_name, email, student_number, department)
       VALUES (?, ?, ?, ?)`,
      [
        full_name.trim(),
        cleanEmail,
        student_number.trim(),
        department.trim(),
      ]
    );

    res.status(201).json({
      message: "Student registered successfully!",
      student: {
        id: result.insertId,
        full_name: full_name.trim(),
        email: cleanEmail,
        student_number: student_number.trim(),
        department: department.trim(),
      },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "That email or student number is already registered.",
      });
    }

    console.error("Student registration error:", error.message);

    res.status(500).json({
      message: "Registration failed. Please try again.",
    });
  }
});
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const [admins] = await db.execute(
      `SELECT id, full_name, email, password_hash
       FROM admins
       WHERE email = ?`,
      [email.trim().toLowerCase()]
    );

    if (admins.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const admin = admins[0];
    const passwordMatches = await bcrypt.compare(
      password,
      admin.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Authentication is not configured.",
      });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: "admin",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login successful.",
      token,
      admin: {
        id: admin.id,
        full_name: admin.full_name,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error.message);
    res.status(500).json({
      message: "Unable to log in. Please try again.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
