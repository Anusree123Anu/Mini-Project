const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const path = require("path");
const multer = require("multer");
const ExcelJS = require("exceljs");

const connectDB = require("./db");
const Admin = require("./user");
const Faculty = require("./faculty");
const Subject = require("./subject");
const Student = require("./student");
const Settings = require("./settings"); // Use this to store deadlines, etc.

const app = express();
const PORT = 3000;

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir));

/* ================= DB CONNECTION ================= */
connectDB();

/* ================= HELPER ================= */
const getValue = (cellValue) => {
  if (!cellValue) return "";
  if (typeof cellValue === "object" && cellValue.text)
    return cellValue.text.trim();
  if (typeof cellValue === "object" && cellValue.richText)
    return cellValue.richText.map(rt => rt.text).join("").trim();
  return cellValue.toString().trim();
};

/* ================= HOME ================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* ================= ADMIN LOGIN ================= */
app.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.json({ success: false, message: "All fields required" });

    const admin = await Admin.findOne({ username });
    if (!admin) return res.json({ success: false, message: "Invalid credentials" });

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.json({ success: false, message: "Invalid credentials" });

    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});

/* ================= FACULTY ================= */
app.post("/faculty/register", async (req, res) => {
  const { name, department, username, password } = req.body;

  if (!name || !department || !username || !password)
    return res.json({ success: false, message: "All fields required" });

  if (await Faculty.findOne({ username }))
    return res.json({ success: false, message: "Faculty already exists" });

  const hash = await bcrypt.hash(password, 10);

  await new Faculty({
    name,
    department,
    username,
    password: hash,
    approved: false,
    subjects: []
  }).save();

  res.json({ success: true });
});

app.post("/faculty/login", async (req, res) => {
  const { username, password } = req.body;

  const faculty = await Faculty.findOne({ username });
  if (!faculty) return res.json({ success: false });

  if (!faculty.approved)
    return res.json({ success: false, message: "Waiting for approval" });

  const match = await bcrypt.compare(password, faculty.password);
  if (!match) return res.json({ success: false });

  res.json({ success: true });
});

app.post("/faculty/profile", async (req, res) => {
  const { username } = req.body;
  const faculty = await Faculty.findOne({ username }).select("-password");

  if (!faculty) return res.json({ success: false });

  res.json({
    success: true,
    faculty: {
      username: faculty.username,
      name: faculty.name,
      department: faculty.department,
      subjects: faculty.subjects || []
    }
  });
});

/* ================= ADMIN ACTIONS ================= */
app.get("/admin/pending-faculty", async (req, res) => {
  const faculty = await Faculty.find({ approved: false });
  res.json({ success: true, faculty });
});

app.get("/admin/approved-faculty", async (req, res) => {
  const faculty = await Faculty.find({ approved: true });
  res.json({ success: true, faculty });
});

app.post("/admin/approve-faculty", async (req, res) => {
  await Faculty.findByIdAndUpdate(req.body.facultyId, { approved: true });
  res.json({ success: true });
});

/* ================= SUBJECT MANAGEMENT ================= */
const getGroupedSubjects = async () => {
  const subjects = await Subject.find();
  const grouped = {};

  subjects.forEach(s => {
    if (!grouped[s.department]) grouped[s.department] = {};
    if (!grouped[s.department][s.semester])
      grouped[s.department][s.semester] = [];
    grouped[s.department][s.semester].push(s.name);
  });

  return grouped;
};

/* 👉 Faculty + Student */
app.get("/api/subjects", async (req, res) => {
  res.json(await getGroupedSubjects());
});

/* 👉 Admin */
app.get("/subjects", async (req, res) => {
  res.json(await getGroupedSubjects());
});

app.post("/api/subjects", async (req, res) => {
  let { department, semester, subject } = req.body;

  if (!department || !semester || !subject)
    return res.status(400).json({ error: "Missing fields" });

  department = department.trim().toUpperCase();
  subject = subject.trim();

  const exists = await Subject.findOne({ department, semester, name: subject });
  if (exists) return res.json({ message: "Already exists" });

  await new Subject({ department, semester, name: subject }).save();
  res.json({ message: "Subject added successfully" });
});

// Delete subject
app.delete("/api/subjects", async (req, res) => {
  try {
    const { department, semester, subject } = req.body;

    if (!department || !semester || !subject)
      return res.status(400).json({ error: "Missing fields" });

    const deleted = await Subject.findOneAndDelete({
      department: department.trim().toUpperCase(),
      semester,
      name: subject.trim()
    });

    if (!deleted) return res.status(404).json({ message: "Subject not found" });

    res.json({ message: "Subject deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Deletion failed" });
  }
});

/* ================= PREFERENCE DEADLINE ================= */
app.post("/admin/set-preference-deadline", async (req, res) => {
  const { deadline } = req.body;

  if (!deadline) return res.status(400).json({ message: "Deadline required" });

  await Settings.findOneAndUpdate(
    { key: "preferenceDeadline" },
    { value: new Date(deadline) },
    { upsert: true }
  );

  res.json({ message: "Deadline saved" });
});

app.get("/api/preference-deadline", async (req, res) => {
  const doc = await Settings.findOne({ key: "preferenceDeadline" });
  res.json({ deadline: doc ? doc.value : null });
});

/* ================= STUDENT LOGIN ================= */
app.post("/student/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password)
      return res.json({ success: false, message: "Email and password required" });

    email = email.trim().toLowerCase();

    const student = await Student.findOne({ email });
    if (!student)
      return res.json({ success: false, message: "Invalid credentials" });

    const match = await bcrypt.compare(password.toString(), student.password);
    if (!match)
      return res.json({ success: false, message: "Invalid credentials" });

    res.json({
      success: true,
      student: {
        name: student.name,
        email: student.email,
        regNo: student.regNo
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* ================= UPLOAD STUDENTS ================= */
const upload = multer({ storage: multer.memoryStorage() });

app.post("/admin/upload-students", upload.single("file"), async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.worksheets[0];
    let inserted = 0, skipped = 0;

    for (let i = 3; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);

      const rollNo = getValue(row.getCell(2).value);
      const name   = getValue(row.getCell(3).value);
      const regNo  = getValue(row.getCell(4).value);
      const mobile = getValue(row.getCell(5).value);
      const email  = getValue(row.getCell(6).value).toLowerCase();

      if (!regNo || !name || !email) { skipped++; continue; }

      if (await Student.findOne({ $or: [{ email }, { regNo }] })) {
        skipped++; continue;
      }

      await Student.create({
        rollNo,
        regNo,
        name,
        mobile,
        email,
        password: await bcrypt.hash(regNo, 10)
      });

      inserted++;
    }

    res.json({ message: `✅ Upload complete. ${inserted} added, ${skipped} skipped.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Excel upload failed" });
  }
});

/* ================= SERVER ================= */
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
