
import { useCallback, useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api";

const emptyForm = {
  full_name: "",
  email: "",
  student_number: "",
  department: "",
};

function App() {
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

  // Load registered students from the backend.
  const loadStudents = useCallback(async () => {
    setRefreshing(true);
    setStudentError("");

    try {
      const response = await fetch(`${API_URL}/students`);

      if (!response.ok) {
        throw new Error("Could not load students.");
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("The server returned an unexpected response.");
      }

      setStudents(data);
    } catch (error) {
      setStudentError(
        error.message ||
          "Unable to load students. Check that the backend is running."
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Check the backend and load available courses.
  useEffect(() => {
    async function loadCourses() {
      try {
        const healthResponse = await fetch(`${API_URL}/health`);

        if (!healthResponse.ok) {
          throw new Error("Backend is not responding.");
        }

        const health = await healthResponse.json();

        if (health.database !== "connected") {
          throw new Error("Check your MySQL configuration.");
        }

        setStatus("Connected to server and database");
        setCourseError("");

        const response = await fetch(`${API_URL}/courses`);

        if (!response.ok) {
          throw new Error("Could not load courses.");
        }

        const data = await response.json();
        setCourses(data);
      } catch (error) {
        setStatus("Connection problem");
        setCourseError(
          error.message || "Unable to connect to the backend."
        );
      }
    }

    loadCourses();
    loadStudents();
  }, [loadStudents]);

  // Create a list of unique departments from student records.
  const departmentOptions = [
    ...new Set(
      students
        .map((student) => student.department)
        .filter(Boolean)
    ),
  ].sort();

  // Search by name, email, student number, or department,
  // and optionally filter by a selected department.
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

  // Keep the registration form updated.
  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setMessage("");
    setFormError("");
  }

  // Register a student in the database.
  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setFormError("");
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/students`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed.");
      }

      setMessage(
        `Welcome, ${data.student.full_name}! Registration was successful.`
      );

      setForm(emptyForm);

      // Refresh the student list after successful registration.
      await loadStudents();
    } catch (error) {
      setFormError(
        `${error.message} Check your backend and MySQL connection.`
      );
    } finally {
      setSubmitting(false);
    }
  }

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
          <a href="#register">Register</a>
        </nav>

        <a className="login-button" href="#register">
          Get Started
        </a>
      </header>

      <main>
        {/* Welcome section */}
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
              Explore university courses, register students, and
              manage student records in one convenient place.
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

        {/* Course catalog */}
        <section className="courses-section" id="courses">
          <div className="section-heading">
            <div>
              <span className="eyebrow">COURSE CATALOG</span>
              <h2>Available Courses</h2>
              <p>Explore courses offered by the university.</p>
            </div>

            <span className="course-count">
              {courses.length} courses
            </span>
          </div>

          <div className="connection-status">
            <span className="status-dot"></span>
            {status}
          </div>

          {courseError && (
            <div className="error-message">{courseError}</div>
          )}

          <div className="course-grid">
            {courses.map((course) => (
              <article className="course-card" key={course.id}>
                <div className="course-icon">📘</div>
                <span className="course-code">
                  {course.course_code}
                </span>
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

        {/* Student dashboard */}
        <section className="students-section" id="students">
          <div className="student-heading">
            <div>
              <span className="eyebrow">STUDENT MANAGEMENT</span>
              <h2>Student Dashboard</h2>
              <p>
                View and search students registered in your system.
              </p>
            </div>

            <button
              className="refresh-button"
              type="button"
              onClick={loadStudents}
              disabled={refreshing}
            >
              <span
                className={
                  refreshing
                    ? "refresh-symbol spinning"
                    : "refresh-symbol"
                }
              >
                ↻
              </span>
              {refreshing ? "Refreshing..." : "Refresh"}
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
              <div className="stat-icon purple">▤</div>
              <div>
                <p>Departments represented</p>
                <strong>{departmentOptions.length}</strong>
              </div>
            </article>

            <article className="student-stat-card">
              <div className="stat-icon green">✓</div>
              <div>
                <p>System status</p>
                <strong className="stat-status">
                  {studentError ? "Check connection" : "Ready"}
                </strong>
              </div>
            </article>
          </div>

          {/* Student list, search, and department filter */}
          <div className="student-list-card">
            <div className="student-list-heading">
              <div>
                <h3>Registered Students</h3>
                <p>
                  {filteredStudents.length}{" "}
                  {filteredStudents.length === 1
                    ? "student"
                    : "students"}{" "}
                  found
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
                    onChange={(event) =>
                      setSelectedDepartment(event.target.value)
                    }
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

                <button
                  className="refresh-button"
                  onClick={loadStudents}
                  type="button"
                  disabled={refreshing}
                >
                  Try again
                </button>
              </div>
            ) : students.length === 0 ? (
              <div className="student-empty">
                <div className="empty-icon">♙</div>
                <h3>No students registered yet</h3>
                <p>
                  Register your first student using the form below.
                  Their record will appear here after successful registration.
                </p>
                <a className="primary-button" href="#register">
                  Register First Student
                </a>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="student-empty">
                <div className="empty-icon">⌕</div>
                <h3>No matching students</h3>
                <p>
                  Try another search term or select a different department.
                </p>

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
                              {student.full_name
                                ?.trim()
                                .charAt(0)
                                .toUpperCase() || "S"}
                            </span>
                            <strong>{student.full_name}</strong>
                          </div>
                        </td>

                        <td>
                          <span className="student-number">
                            {student.student_number}
                          </span>
                        </td>

                        <td>{student.email}</td>
                        <td>{student.department}</td>

                        <td>
                          <span className="student-badge">
                            Registered
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Student registration form */}
        <section className="registration-section" id="register">
          <div className="registration-heading">
            <span className="eyebrow">JOIN OUR UNIVERSITY</span>
            <h2>Student Registration</h2>
            <p>
              Enter the student's details to create a record in the
              university database.
            </p>
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
                <option value="Computer Science">
                  Computer Science
                </option>
                <option value="Software Engineering">
                  Software Engineering
                </option>
                <option value="Information Technology">
                  Information Technology
                </option>
                <option value="Mathematics">Mathematics</option>
                <option value="Electrical Engineering">
                  Electrical Engineering
                </option>
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
              Student information is saved to your MySQL database.
            </p>
          </form>
        </section>
      </main>

      <footer>
        <p>
          © {new Date().getFullYear()} UniReg · University Registration System
        </p>
      </footer>
    </div>
  );
}

export default App;
