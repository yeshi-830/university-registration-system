
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api";

const emptyForm = {
  full_name: "",
  email: "",
  student_number: "",
  department: "",
};

const departmentChoices = [
  "Computer Science",
  "Software Engineering",
  "Information Technology",
  "Mathematics",
  "Electrical Engineering",
];

function App() {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("unireg-theme") !== "light"
  );

  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
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

  // Apply and remember the selected theme.
  useEffect(() => {
    document.body.classList.toggle("light-mode", !darkMode);
    localStorage.setItem("unireg-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Fetch registered students.
  const loadStudents = useCallback(async () => {
    setRefreshing(true);
    setStudentError("");

    try {
      const response = await fetch(`${API_URL}/students`);

      if (!response.ok) {
        throw new Error("Unable to retrieve students from the server.");
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Unexpected student data received.");
      }

      setStudents(data);
    } catch (error) {
      setStudentError(error.message || "Could not load students.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Load database status and courses.
  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const healthResponse = await fetch(`${API_URL}/health`);

        if (!healthResponse.ok) {
          throw new Error("Backend server is unavailable.");
        }

        const health = await healthResponse.json();

        if (health.database !== "connected") {
          throw new Error("MySQL database is not connected.");
        }

        if (!cancelled) {
          setStatus("Connected to server and database");
          setCourseError("");
        }

        const courseResponse = await fetch(`${API_URL}/courses`);

        if (!courseResponse.ok) {
          throw new Error("Unable to load courses.");
        }

        const data = await courseResponse.json();

        if (!Array.isArray(data)) {
          throw new Error("Unexpected course data received.");
        }

        if (!cancelled) {
          setCourses(data);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("Connection problem");
          setCourseError(error.message);
        }
      }
    }

    loadInitialData();
    loadStudents();

    return () => {
      cancelled = true;
    };
  }, [loadStudents]);

  // Get unique departments from registered students.
  const departments = useMemo(
    () =>
      [...new Set(students.map((s) => s.department).filter(Boolean))].sort(),
    [students]
  );

  // Search and filter students.
  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch = [
        student.full_name,
        student.email,
        student.student_number,
        student.department,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(term)
      );

      const matchesDepartment =
        selectedDepartment === "All" ||
        student.department === selectedDepartment;

      return matchesSearch && matchesDepartment;
    });
  }, [students, search, selectedDepartment]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setMessage("");
    setFormError("");
  }

  // Register a student and refresh the student list.
  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setFormError("");
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Student registration failed.");
      }

      setMessage(
        `Student ${data.student?.full_name || form.full_name} registered successfully.`
      );

      setForm(emptyForm);
      await loadStudents();
    } catch (error) {
      setFormError(error.message || "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app">
      <header className="navbar">
        <a className="brand" href="#home">
          <span className="brand-icon">U</span>
          UniReg
        </a>

        <nav className="main-nav">
          <a href="#home">Home</a>
          <a href="#courses">Courses</a>
          <a href="#students">Students</a>
          <a href="#register">Register</a>
        </nav>

        <button
          className="theme-button"
          type="button"
          onClick={() => setDarkMode((previous) => !previous)}
          aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`}
        >
          {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-text">
            <span className="eyebrow">
              YOUR ACADEMIC JOURNEY STARTS HERE
            </span>

            <h1>
              University Registration,
              <span> made simple.</span>
            </h1>

            <p>
              Explore university courses, register students, and manage
              student records in one convenient place.
            </p>

            <a className="primary-button" href="#register">
              Register a Student →
            </a>
          </div>

          <div className="hero-card">
            <div className="hero-card-icon">🎓</div>
            <h2>Welcome to UniReg</h2>
            <p>Your academic information, organized in one place.</p>

            <div className="mini-stat">
              <span>Available courses</span>
              <strong>{courses.length}</strong>
            </div>

            <div className="mini-stat">
              <span>Registered students</span>
              <strong>{students.length}</strong>
            </div>

            <div className="mini-stat">
              <span>System status</span>
              <strong className="status-text">
                {status === "Connected to server and database"
                  ? "Online"
                  : "Check connection"}
              </strong>
            </div>
          </div>
        </section>

        <section className="courses-section section" id="courses">
          <div className="section-heading">
            <div>
              <span className="eyebrow">COURSE CATALOG</span>
              <h2>Available Courses</h2>
              <p>Explore courses offered by the university.</p>
            </div>

            <span className="course-count">{courses.length} courses</span>
          </div>

          <div className="connection-status">
            <span className="status-dot"></span>
            {status}
          </div>

          {courseError && (
            <div className="error-message" role="alert">
              {courseError}
            </div>
          )}

          {courses.length > 0 ? (
            <div className="course-grid">
              {courses.map((course) => (
                <article className="course-card" key={course.id}>
                  <div className="course-icon">📘</div>
                  <span className="course-code">{course.course_code}</span>
                  <h3>{course.course_name}</h3>
                  <p>{course.department}</p>

                  <div className="course-footer">
                    <span>{course.credit_hours} credit hours</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            !courseError && (
              <p className="empty-note">No courses to display yet.</p>
            )
          )}
        </section>

        <section className="students-section section" id="students">
          <div className="student-heading">
            <div>
              <span className="eyebrow">STUDENT MANAGEMENT</span>
              <h2>Student Dashboard</h2>
              <p>View, search, and filter registered students.</p>
            </div>

            <button
              className="refresh-button"
              type="button"
              onClick={loadStudents}
              disabled={refreshing}
            >
              {refreshing ? "Loading..." : "↻ Refresh"}
            </button>
          </div>

          {/* Dashboard statistics */}
          <div className="student-stats">
            <article className="student-stat-card">
              <div className="stat-icon blue">♙</div>
              <div>
                <p>Total students</p>
                <strong>{students.length}</strong>
              </div>
            </article>

            <article className="student-stat-card">
              <div className="stat-icon purple">📚</div>
              <div>
                <p>Total courses</p>
                <strong>{courses.length}</strong>
              </div>
            </article>

            <article className="student-stat-card">
              <div className="stat-icon green">🏢</div>
              <div>
                <p>Departments</p>
                <strong>{departments.length}</strong>
              </div>
            </article>

            <article className="student-stat-card">
              <div className="stat-icon orange">✓</div>
              <div>
                <p>Database status</p>
                <strong className="stat-status">
                  {studentError
                    ? "Error"
                    : status === "Connected to server and database"
                      ? "Connected"
                      : status === "Checking connection..."
                        ? "Checking..."
                        : "Offline"}
                </strong>
              </div>
            </article>
          </div>

          <div className="student-list-card">
            <div className="student-list-heading">
              <div>
                <h3>Registered Students</h3>
                <p>
                  Showing {filteredStudents.length} of {students.length} students
                </p>
              </div>

              <label className="student-search">
                <span>⌕</span>
                <input
                  type="search"
                  placeholder="Search students..."
                  aria-label="Search students"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>

            <div className="student-filters">
              <label htmlFor="department-filter">Department:</label>

              <select
                id="department-filter"
                value={selectedDepartment}
                onChange={(event) =>
                  setSelectedDepartment(event.target.value)
                }
              >
                <option value="All">All departments</option>

                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>

              {(search || selectedDepartment !== "All") && (
                <button
                  type="button"
                  className="clear-filter-button"
                  onClick={() => {
                    setSearch("");
                    setSelectedDepartment("All");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            {studentError ? (
              <div className="student-empty">
                <h3>Could not load students</h3>
                <p>{studentError}</p>

                <button className="refresh-button" onClick={loadStudents}>
                  Try again
                </button>
              </div>
            ) : students.length === 0 ? (
              <div className="student-empty">
                <div className="empty-icon">🎓</div>
                <h3>No students registered yet</h3>
                <p>Register your first student using the form below.</p>

                <a className="primary-button" href="#register">
                  Register First Student
                </a>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="student-empty">
                <h3>No matching students</h3>
                <p>Try another search or department filter.</p>
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
                              {student.full_name
                                ?.trim()
                                .charAt(0)
                                .toUpperCase() || "S"}
                            </span>
                            <strong>{student.full_name}</strong>
                          </div>
                        </td>

                        <td>{student.student_number}</td>
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

        <section className="registration-section section" id="register">
          <div className="registration-heading">
            <span className="eyebrow">JOIN OUR UNIVERSITY</span>
            <h2>Student Registration</h2>
            <p>Enter student details to create a database record.</p>
          </div>

          <form className="registration-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="full_name">Full name</label>
              <input
                id="full_name"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Enter full name"
                maxLength={100}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="student@example.com"
                maxLength={150}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="student_number">Student number</label>
              <input
                id="student_number"
                name="student_number"
                value={form.student_number}
                onChange={handleChange}
                placeholder="e.g. STU2026001"
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

                {departmentChoices.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </div>

            {message && (
              <div className="success-message" role="status">
                {message}
              </div>
            )}

            {formError && (
              <div className="error-message" role="alert">
                {formError}
              </div>
            )}

            <button
              className="submit-button"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Registering..." : "Register Student"}
            </button>

            <p className="form-note">
              Student details are saved to MySQL.
            </p>
          </form>
        </section>
      </main>

      <footer className="footer">
        <p>
          © {new Date().getFullYear()} UniReg · University Registration System
        </p>
      </footer>
    </div>
  );
}

export default App;
