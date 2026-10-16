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

// Helper function to calculate letter grade and pass/fail result
function calculateGrade(marks) {
  const numMarks = Number(marks);
  if (numMarks >= 90) return { letter: "A", result: "Pass" };
  if (numMarks >= 80) return { letter: "B", result: "Pass" };
  if (numMarks >= 70) return { letter: "C", result: "Pass" };
  if (numMarks >= 60) return { letter: "D", result: "Pass" };
  return { letter: "F", result: "Fail" };
}

// API home
app.get("/", (req, res) => {
  res.json({
    message: "University Registration System API is running!",
  });
});

// Check server and database
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

// Get all courses
app.get("/api/courses", async (req, res) => {
  try {
    const [courses] = await db.query(
      `SELECT id, course_code, course_name,
              credit_hours, department
       FROM courses
       ORDER BY course_code`
    );

    res.json(courses);
  } catch (error) {
    console.error("Course error:", error.message);

    res.status(500).json({
      message: "Could not load courses.",
    });
  }
});

// Get all registered students
app.get("/api/students", async (req, res) => {
  try {
    const [students] = await db.query(
      `SELECT id, full_name, email, student_number, department
       FROM students
       ORDER BY id DESC`
    );

    res.json(students);
  } catch (error) {
    console.error("Load students error:", error.message);

    res.status(500).json({
      message: "Could not load students.",
    });
  }
});

// Register a student
app.post("/api/students", async (req, res) => {
  try {
    const {
      full_name,
      email,
      student_number,
      department,
    } = req.body;

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

    const cleanEmail = email.trim().toLowerCase();

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address.",
      });
    }

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

// Administrator login
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

// --- GRADE MANAGEMENT ENDPOINTS ---

// Get all submitted grades with student and course details
app.get("/api/grades", async (req, res) => {
  try {
    const [grades] = await db.query(
      `SELECT g.id, g.student_id, g.course_id, g.marks, g.letter_grade, g.result, g.updated_at,
              s.full_name AS student_name, s.student_number,
              c.course_code, c.course_name
       FROM grades g
       JOIN students s ON g.student_id = s.id
       JOIN courses c ON g.course_id = c.id
       ORDER BY g.updated_at DESC`
    );

    res.json(grades);
  } catch (error) {
    console.error("Load grades error:", error.message);

    res.status(500).json({
      message: "Could not load grades.",
    });
  }
});

// Submit or update a student's grade
app.post("/api/grades", async (req, res) => {
  try {
    const { student_id, course_id, marks } = req.body;

    if (!student_id || !course_id || marks === undefined || marks === "") {
      return res.status(400).json({
        message: "Student, course, and marks are required.",
      });
    }

    const numMarks = Number(marks);
    if (isNaN(numMarks) || numMarks < 0 || numMarks > 100) {
      return res.status(400).json({
        message: "Marks must be a number between 0 and 100.",
      });
    }

    // Verify student exists
    const [students] = await db.execute("SELECT id FROM students WHERE id = ?", [student_id]);
    if (students.length === 0) {
      return res.status(404).json({ message: "Student not found." });
    }

    // Verify course exists
    const [courses] = await db.execute("SELECT id FROM courses WHERE id = ?", [course_id]);
    if (courses.length === 0) {
      return res.status(404).json({ message: "Course not found." });
    }

    // Calculate letter grade and pass/fail result securely on the backend
    const { letter, result } = calculateGrade(numMarks);

    // Insert or update grade if it already exists for this student + course combination
    const [dbResult] = await db.execute(
      `INSERT INTO grades (student_id, course_id, marks, letter_grade, result)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         marks = VALUES(marks), 
         letter_grade = VALUES(letter_grade), 
         result = VALUES(result)`,
      [student_id, course_id, numMarks, letter, result]
    );

    res.status(201).json({
      message: "Grade saved successfully!",
      grade: {
        student_id,
        course_id,
        marks: numMarks,
        letter_grade: letter,
        result,
      },
    });
  } catch (error) {
    console.error("Save grade error:", error.message);

    res.status(500).json({
      message: "Failed to save grade. Please try again.",
    });
  }
});

// Start the backend
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
// Get grades for a specific student by student number
app.get("/api/student-results/:studentNumber", async (req, res) => {
  try {
    const { studentNumber } = req.params;

    // Find student first
    const [students] = await db.execute(
      `SELECT id, full_name, email, student_number, department 
       FROM students 
       WHERE student_number = ?`,
      [studentNumber.trim()]
    );

    if (students.length === 0) {
      return res.status(404).json({ message: "Student number not found." });
    }

    const student = students[0];

    // Get all grades for this student
    const [grades] = await db.execute(
      `SELECT g.marks, g.letter_grade, g.result, g.updated_at,
              c.course_code, c.course_name, c.credit_hours, c.department
       FROM grades g
       JOIN courses c ON g.course_id = c.id
       WHERE g.student_id = ?
       ORDER BY c.course_code`,
      [student.id]
    );

    res.json({
      student,
      grades,
    });
  } catch (error) {
    console.error("Fetch student results error:", error.message);
    res.status(500).json({ message: "Could not load student results." });
  }
});