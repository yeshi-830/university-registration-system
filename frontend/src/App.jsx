import { useCallback, useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api";

const emptyForm = {
  full_name: "",
  email: "",
  student_number: "",
  department: "",
};

const departments = [
  "Computer Science",
  "Software Engineering",
  "Information Technology",
  "Mathematics",
  "Electrical Engineering",
];

function App() {
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [status, setStatus] = useState("Checking connection...");
  const [courseError, setCourseError] = useState("");
  const [studentError, setStudentError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Grade submission form state
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [marks, setMarks] = useState("");
  const [gradeMessage, setGradeMessage] = useState({ text: "", type: "" });

  // Student result lookup state
  const [searchStudentNumber, setSearchStudentNumber] = useState("");
  const [studentResultData, setStudentResultData] = useState(null);
  const [searchError, setSearchError] = useState("");

  // Load the saved theme, or use light mode initially.
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("unireg-theme") === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });

  // Switch between light and dark themes.
  function toggleTheme() {
    setTheme((currentTheme) => {
      const newTheme = currentTheme === "light" ? "dark" : "light";
      try {
        localStorage.setItem("unireg-theme", newTheme);
      } catch {
        // Theme still works if browser storage is unavailable.
      }
      return newTheme;
    });
  }

  // Apply the selected theme to the whole page.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  // Load students from the backend.
  const loadStudents = useCallback(async () => {
    setRefreshing(true);
    setStudentError("");

    try {
      const response = await fetch(`${API_URL}/students`);
      if (!response.ok) {
        throw new Error(`Could not load students (HTTP ${response.status}).`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("The student API did not return a list of students.");
      }
      setStudents(data);
    } catch (error) {
      setStudentError(
        error.message || "Unable to load students. Check your backend."
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Load grades from the backend.
  const fetchGrades = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/grades`);
      if (response.ok) {
        const data = await response.json();
        setGrades(data);
      }
    } catch (error) {
      console.error("Error fetching grades:", error);
    }
  }, []);

  // Check the backend and load courses.
  const loadCourses = useCallback(async () => {
    setCourseError("");

    try {
      const healthResponse = await fetch(`${API_URL}/health`);
      if (!healthResponse.ok) {
        throw new Error("The backend health check failed.");
      }
      const health = await healthResponse.json();
      if (health.database !== "connected") {
        throw new Error("The backend responded, but the database is not connected.");
      }

      const response = await fetch(`${API_URL}/courses`);
      if (!response.ok) {
        throw new Error(`Could not load courses (HTTP ${response.status}).`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("The courses API did not return a list of courses.");
      }

      setCourses(data);
      setStatus("Connected to server and database");
    } catch (error) {
      setStatus("Connection problem");
      setCourseError(error.message || "Unable to connect to the backend.");
    }
  }, []);

  // Load initial data.
  useEffect(() => {
    loadCourses();
    loadStudents();
    fetchGrades();
  }, [loadCourses, loadStudents, fetchGrades]);

  // Dashboard statistics.
  const totalStudents = students.length;
  const totalCourses = courses.length;

  const departmentOptions = [
    ...new Set(
      students.map((student) => student.department).filter(Boolean)
    ),
  ].sort();

  const totalDepartments = departmentOptions.length;

  // Search students and apply the department filter.
  const filteredStudents = students.filter((student) => {
    const term = search.trim().toLowerCase();
    const searchableValues = [
      student.full_name,
      student.email,
      student.student_number,
      student.department,
    ];

    const matchesSearch = searchableValues.some((value) =>
      String(value ?? "").toLowerCase().includes(term)
    );

    const matchesDepartment =
      selectedDepartment === "All" ||
      student.department === selectedDepartment;

    return matchesSearch && matchesDepartment;
  });

  // Update registration form fields.
  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setMessage("");
    setFormError("");
  }

  // Register a student through the backend.
  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setFormError("");

    const cleanForm = {
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      student_number: form.student_number.trim(),
      department: form.department,
    };

    if (
      !cleanForm.full_name ||
      !cleanForm.email ||
      !cleanForm.student_number ||
      !cleanForm.department
    ) {
      setFormError("Please complete every field.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanForm),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || `Registration failed (HTTP ${response.status}).`
        );
      }

      setMessage(
        data.message || `Student ${cleanForm.full_name} registered successfully.`
      );
      setForm(emptyForm);
      await loadStudents();
    } catch (error) {
      setFormError(
        `${error.message} Check that the backend and database are running.`
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Handle grade submission
  const handleGradeSubmit = async (e) => {
    e.preventDefault();
    setGradeMessage({ text: "", type: "" });

    if (!selectedStudent || !selectedCourse || marks === "") {
      setGradeMessage({ text: "Please select a student, course, and enter marks.", type: "error" });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/grades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: selectedStudent,
          course_id: selectedCourse,
          marks: Number(marks),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setGradeMessage({ text: "Grade saved successfully!", type: "success" });
        setMarks("");
        setSelectedStudent("");
        setSelectedCourse("");
        fetchGrades();
      } else {
        setGradeMessage({ text: data.message || "Failed to save grade.", type: "error" });
      }
    } catch (error) {
      setGradeMessage({ text: "Network error. Could not save grade.", type: "error" });
    }
  };

  // Handle searching student result by student number
  const handleSearchStudentResult = async (e) => {
    e.preventDefault();
    setSearchError("");
    setStudentResultData(null);

    if (!searchStudentNumber.trim()) {
      setSearchError("Please enter your student number.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/student-results/${searchStudentNumber.trim()}`);
      const data = await response.json();

      if (response.ok) {
        setStudentResultData(data);
      } else {
        setSearchError(data.message || "Student not found.");
      }
    } catch (error) {
      setSearchError("Network error. Could not fetch results.");
    }
  };

  return (
    <div className="app">
      {/* Navigation */}
      <header className="navbar">
        <a className="brand" href="#home">
          <span className="brand-icon">U</span>
          UniReg
        </a>

        <nav className="main-nav">
          <a href="#home">Home</a>
          <a href="#courses">Courses</a>
          <a href="#students">Students</a>
          <a href="#grades">Grades</a>
          <a href="#results">Check Result</a>
          <a href="#register">Register</a>
        </nav>

        <div className="nav-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            aria-pressed={theme === "dark"}
          >
            {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
          </button>

          <a className="login-button" href="#register">
            Get Started
          </a>
        </div>
      </header>

      <main>
        {/* Welcome section */}
        <section className="hero" id="home">
          <div className="hero-text">
            <span className="eyebrow">YOUR ACADEMIC JOURNEY STARTS HERE</span>

            <h1>
              University Registration,
              <span> made simple.</span>
            </h1>

            <p>
              Explore university courses, register students, manage academic grades,
              and check individual records in one convenient place.
            </p>

            <a className="primary-button" href="#register">
              Register a Student <span>→</span>
            </a>
          </div>

          <div className="hero-card">
            <div className="hero-card-icon">🎓</div>
            <h2>Welcome to UniReg</h2>
            <p>Your academic information, organized in one place.</p>

            <div className="mini-stat">
              <span>Available courses</span>
              <strong>{totalCourses}</strong>
            </div>

            <div className="mini-stat">
              <span>Registered students</span>
              <strong>{totalStudents}</strong>
            </div>

            <div className="mini-stat">
              <span>System status</span>
              <strong className="status-text">
                {status === "Connected to server and database" ? "Online" : "Check connection"}
              </strong>
            </div>
          </div>
        </section>

        {/* Dashboard statistics */}
        <section className="courses-section" id="dashboard">
          <div className="section-heading">
            <div>
              <span className="eyebrow">AT A GLANCE</span>
              <h2>University Dashboard</h2>
              <p>See an overview of your current records.</p>
            </div>
          </div>

          <div className="stats-grid">
            <article className="stat-card">
              <h3>Total Students</h3>
              <p>{totalStudents}</p>
            </article>

            <article className="stat-card">
              <h3>Total Courses</h3>
              <p>{totalCourses}</p>
            </article>

            <article className="stat-card">
              <h3>Departments Represented</h3>
              <p>{totalDepartments}</p>
            </article>
          </div>
        </section>

        {/* Course catalog */}
        <section className="courses-section" id="courses">
          <div className="section-heading">
            <div>
              <span className="eyebrow">COURSE CATALOG</span>
              <h2>Available Courses</h2>
              <p>Explore courses offered by the university.</p>
            </div>
            <span className="course-count">{totalCourses} courses</span>
          </div>

          <div className="connection-status">
            <span className="status-dot"></span>
            {status}
          </div>

          {courseError && (
            <div className="error-message" role="alert">{courseError}</div>
          )}

          {!courseError && courses.length === 0 && (
            <p>No courses are available yet.</p>
          )}

          <div className="course-grid">
            {courses.map((course) => (
              <article className="course-card" key={course.id}>
                <div className="course-icon">📘</div>
                <span className="course-code">{course.course_code}</span>
                <h3>{course.course_name}</h3>
                <p>{course.department}</p>
                <div className="course-footer">
                  <span>{course.credit_hours} credit hours</span>
                  <span className="arrow">→</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Student management */}
        <section className="students-section" id="students">
          <div className="student-heading">
            <div>
              <span className="eyebrow">STUDENT MANAGEMENT</span>
              <h2>Student Dashboard</h2>
              <p>View and search students registered in your system.</p>
            </div>

            <button
              className="refresh-button"
              type="button"
              onClick={() => {
                loadStudents();
                loadCourses();
                fetchGrades();
              }}
              disabled={refreshing}
            >
              <span className={refreshing ? "refresh-symbol spinning" : "refresh-symbol"}>
                ↻
              </span>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="student-stats">
            <article className="student-stat-card">
              <div className="stat-icon blue">♙</div>
              <div>
                <p>Total students</p>
                <strong>{totalStudents}</strong>
              </div>
            </article>

            <article className="student-stat-card">
              <div className="stat-icon purple">▤</div>
              <div>
                <p>Departments represented</p>
                <strong>{totalDepartments}</strong>
              </div>
            </article>

            <article className="student-stat-card">
              <div className="stat-icon green">✓</div>
              <div>
                <p>System status</p>
                <strong className="stat-status">
                  {studentError || courseError
                    ? "Check connection"
                    : status === "Connected to server and database"
                    ? "Ready"
                    : "Connecting..."}
                </strong>
              </div>
            </article>
          </div>

          <div className="student-list-card">
            <div className="student-list-heading">
              <div>
                <h3>Registered Students</h3>
                <p>
                  {filteredStudents.length}{" "}
                  {filteredStudents.length === 1 ? "student" : "students"} found
                </p>
              </div>

              <div className="student-filters">
                <label className="student-search">
                  <span>⌕</span>
                  <input
                    type="search"
                    placeholder="Search students..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    aria-label="Search students"
                  />
                </label>

                <label className="department-filter">
                  <span>Department</span>
                  <select
                    value={selectedDepartment}
                    onChange={(event) => setSelectedDepartment(event.target.value)}
                    aria-label="Filter students by department"
                  >
                    <option value="All">All departments</option>
                    {departmentOptions.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {studentError ? (
              <div className="student-empty">
                <div className="empty-icon">⚠</div>
                <h3>Could not load students</h3>
                <p>{studentError}</p>
                <button className="refresh-button" onClick={loadStudents} type="button" disabled={refreshing}>
                  Try again
                </button>
              </div>
            ) : students.length === 0 ? (
              <div className="student-empty">
                <div className="empty-icon">♙</div>
                <h3>No students registered yet</h3>
                <p>Register your first student using the form below.</p>
                <a className="primary-button" href="#register">
                  Register First Student
                </a>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="student-empty">
                <div className="empty-icon">⌕</div>
                <h3>No matching students</h3>
                <p>Try another search term or select a different department.</p>
                <button
                  className="refresh-button"
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedDepartment("All");
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="student-table-wrapper">
                <table className="student-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Student Number</th>
                      <th>Email</th>
                      <th>Department</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id}>
                        <td>
                          <div className="student-name-cell">
                            <span className="student-avatar">
                              {student.full_name?.trim().charAt(0).toUpperCase() || "S"}
                            </span>
                            <strong>{student.full_name}</strong>
                          </div>
                        </td>
                        <td>
                          <span className="student-number">{student.student_number}</span>
                        </td>
                        <td>{student.email}</td>
                        <td>{student.department}</td>
                        <td>
                          <span className="student-badge">Registered</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Grade Management & Submission Section */}
        <section className="courses-section" id="grades">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ACADEMIC EVALUATION</span>
              <h2>Grade Management System</h2>
              <p>Submit marks and review submitted student grades.</p>
            </div>
          </div>

          <div className="student-list-card" style={{ padding: "24px", marginBottom: "32px" }}>
            <h3 style={{ marginBottom: "16px" }}>Submit Student Grade</h3>
            <form onSubmit={handleGradeSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "16px" }}>
              <div className="form-field" style={{ margin: 0 }}>
                <label className="block text-sm font-medium mb-1">Select Student</label>
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color, #ccc)" }}
                >
                  <option value="">-- Choose Student --</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name} ({student.student_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field" style={{ margin: 0 }}>
                <label className="block text-sm font-medium mb-1">Select Course</label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color, #ccc)" }}
                >
                  <option value="">-- Choose Course --</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.course_code} - {course.course_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field" style={{ margin: 0 }}>
                <label className="block text-sm font-medium mb-1">Marks (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={marks}
                  onChange={(e) => setMarks(e.target.value)}
                  placeholder="Enter marks"
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color, #ccc)" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  type="submit"
                  className="submit-button"
                  style={{ width: "100%", height: "42px", margin: 0 }}
                >
                  Submit Grade
                </button>
              </div>
            </form>

            {gradeMessage.text && (
              <div className={gradeMessage.type === "success" ? "success-message" : "error-message"} role="status" style={{ marginTop: "12px" }}>
                {gradeMessage.text}
              </div>
            )}
          </div>

          <div className="student-list-card">
            <div className="student-list-heading">
              <div>
                <h3>Submitted Grades Record</h3>
                <p>{grades.length} total grades recorded</p>
              </div>
            </div>

            <div className="student-table-wrapper">
              <table className="student-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Student Number</th>
                    <th>Course</th>
                    <th>Marks</th>
                    <th>Letter Grade</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                        No grades submitted yet.
                      </td>
                    </tr>
                  ) : (
                    grades.map((g) => (
                      <tr key={g.id}>
                        <td><strong>{g.student_name}</strong></td>
                        <td>{g.student_number}</td>
                        <td>{g.course_code}: {g.course_name}</td>
                        <td>{g.marks}</td>
                        <td><strong>{g.letter_grade}</strong></td>
                        <td>
                          <span style={{ color: g.result === "Pass" ? "#10b981" : "#ef4444", fontWeight: "600" }}>
                            {g.result}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Student Result Checker Section */}
        <section className="courses-section" id="results">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PORTAL</span>
              <h2>Check Student Results</h2>
              <p>Enter your student number to view your grades and academic status.</p>
            </div>
          </div>

          <div className="student-list-card" style={{ padding: "24px" }}>
            <form onSubmit={handleSearchStudentResult} style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
              <input
                type="text"
                placeholder="Enter Student Number (e.g., STU123)"
                value={searchStudentNumber}
                onChange={(e) => setSearchStudentNumber(e.target.value)}
                style={{ flex: 1, padding: "12px", borderRadius: "6px", border: "1px solid var(--border-color, #ccc)" }}
              />
              <button type="submit" className="primary-button" style={{ margin: 0, padding: "0 24px" }}>
                Search
              </button>
            </form>

            {searchError && (
              <div className="error-message" role="alert" style={{ marginBottom: "16px" }}>
                {searchError}
              </div>
            )}

            {studentResultData && (
              <div>
                <div style={{ padding: "16px", background: "var(--card-bg, #f9f9f9)", borderRadius: "8px", marginBottom: "20px", border: "1px solid var(--border-color, #eee)" }}>
                  <h3 style={{ margin: "0 0 6px 0" }}>{studentResultData.student.full_name}</h3>
                  <p style={{ margin: "2px 0", opacity: 0.8 }}>Student Number: <strong>{studentResultData.student.student_number}</strong></p>
                  <p style={{ margin: "2px 0", opacity: 0.8 }}>Department: <strong>{studentResultData.student.department}</strong></p>
                </div>

                <h4 style={{ marginBottom: "12px" }}>Course Results</h4>
                <div className="student-table-wrapper">
                  <table className="student-table">
                    <thead>
                      <tr>
                        <th>Course Code</th>
                        <th>Course Name</th>
                        <th>Credits</th>
                        <th>Marks</th>
                        <th>Letter Grade</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentResultData.grades.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                            No grades posted yet for your account.
                          </td>
                        </tr>
                      ) : (
                        studentResultData.grades.map((g, index) => (
                          <tr key={index}>
                            <td>{g.course_code}</td>
                            <td>{g.course_name}</td>
                            <td>{g.credit_hours}</td>
                            <td>{g.marks}</td>
                            <td><strong>{g.letter_grade}</strong></td>
                            <td>
                              <span style={{ color: g.result === "Pass" ? "#10b981" : "#ef4444", fontWeight: "600" }}>
                                {g.result}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Student registration form */}
        <section className="registration-section" id="register">
          <div className="registration-heading">
            <span className="eyebrow">JOIN OUR UNIVERSITY</span>
            <h2>Student Registration</h2>
            <p>Enter the student's details to create a record in the university database.</p>
          </div>

          <form className="registration-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="full_name">Full name</label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                placeholder="Enter full name"
                value={form.full_name}
                onChange={handleChange}
                maxLength={100}
                autoComplete="name"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="student@example.com"
                value={form.email}
                onChange={handleChange}
                maxLength={150}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="student_number">Student number</label>
              <input
                id="student_number"
                name="student_number"
                type="text"
                placeholder="e.g. STU2026001"
                value={form.student_number}
                onChange={handleChange}
                maxLength={30}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="department">Department</label>
              <select
                id="department"
                name="department"
                value={form.department}
                onChange={handleChange}
                required
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </div>

            {message && (
              <div className="success-message" role="status">{message}</div>
            )}

            {formError && (
              <div className="error-message" role="alert">{formError}</div>
            )}

            <button className="submit-button" type="submit" disabled={submitting}>
              {submitting ? "Registering..." : "Register Student"}
            </button>

            <p className="form-note">
              Student information is saved through your backend API.
            </p>
          </form>
        </section>
      </main>

      <footer>
        <p>© {new Date().getFullYear()} UniReg · University Registration System</p>
      </footer>
    </div>
  );
}

export default App;