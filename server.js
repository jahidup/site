require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', apiLimiter);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// --------------------- Models ---------------------
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  completedLectures: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lecture' }],
  createdAt: { type: Date, default: Date.now }
});

const lectureSchema = new mongoose.Schema({
  title: { type: String, required: true },
  videoUrl: { type: String, required: true },
  notes: { type: String },
  dppUrl: { type: String },
  chapter: { type: mongoose.Schema.Types.ObjectId },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', index: true }
});

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  originalPrice: Number,
  thumbnail: String,
  teacher: String,
  duration: String,
  category: String,
  features: [String],
  chapters: [{
    title: String,
    lectures: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lecture' }]
  }],
  enrolledCount: { type: Number, default: 0 }
});

const doubtSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  lecture: { type: mongoose.Schema.Types.ObjectId, ref: 'Lecture' },
  question: { type: String, required: true },
  replies: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reply: String,
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

const testSchema = new mongoose.Schema({
  title: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  duration: { type: Number, required: true }, // in minutes
  schedule: { type: Date },
  isLive: { type: Boolean, default: false },
  negativeMarking: { type: Number, default: 0 },
  questions: [{
    questionText: { type: String, required: true },
    image: String,
    options: [String],
    correctAnswer: { type: Number }, // index for MCQ, null for numerical
    isNumerical: { type: Boolean, default: false },
    numericalAnswer: Number,
    explanation: String
  }]
});

const testAttemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', index: true },
  answers: [Number],
  score: Number,
  total: Number,
  submittedAt: { type: Date, default: Date.now },
  timeTaken: Number
});

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  message: String,
  createdAt: { type: Date, default: Date.now }
});

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  message: String,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  role: { type: String, enum: ['user', 'ai'] },
  content: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Course = mongoose.model('Course', courseSchema);
const Lecture = mongoose.model('Lecture', lectureSchema);
const Doubt = mongoose.model('Doubt', doubtSchema);
const Test = mongoose.model('Test', testSchema);
const TestAttempt = mongoose.model('TestAttempt', testAttemptSchema);
const Message = mongoose.model('Message', messageSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Chat = mongoose.model('Chat', chatSchema);

// Create indexes for performance
Doubt.syncIndexes();
TestAttempt.syncIndexes();
Notification.syncIndexes();
Chat.syncIndexes();

// --------------------- Middleware ---------------------
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) throw new Error();
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate.' });
  }
};

const adminAuth = async (req, res, next) => {
  auth(req, res, () => {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required.' });
    next();
  });
};

// --------------------- Email & OTP ---------------------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const otpStore = new Map(); // email -> { otp, expires }

app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(email, { otp, expires: Date.now() + 5 * 60 * 1000 });
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Sankalp Digital Pathshala – OTP Verification',
      html: `<div style="font-family:sans-serif; padding:20px; background:#0a0a0a; color:#f5f5f5;">
        <h2 style="color:#4fc3f7;">Sankalp Digital Pathshala</h2>
        <p>Your OTP is: <strong style="font-size:24px; color:#4fc3f7;">${otp}</strong></p>
        <p>Valid for 5 minutes. Do not share this with anyone.</p>
      </div>`
    });
    res.json({ success: true, message: 'OTP sent to email.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send OTP. Check email configuration.' });
  }
});

// --------------------- Auth Routes ---------------------
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, otp } = req.body;
    if (!name || !email || !password || !otp) return res.status(400).json({ error: 'All fields are required.' });
    const stored = otpStore.get(email);
    if (!stored || stored.otp !== otp || stored.expires < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }
    const hashed = await bcrypt.hash(password, 12);
    const user = new User({ name, email, password: hashed });
    await user.save();
    otpStore.delete(email);
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: { id: user._id, name, email, isAdmin: user.isAdmin }
    });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: 'Email already registered.' });
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    // Login email notification (non-blocking)
    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'New Login – Sankalp Digital Pathshala',
      html: `<p>A new login was detected on your account.</p>`
    }).catch(console.warn);
    res.json({
      token,
      user: { id: user._id, name: user.name, email, isAdmin: user.isAdmin }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ error: 'All fields are required.' });
  const stored = otpStore.get(email);
  if (!stored || stored.otp !== otp || stored.expires < Date.now()) {
    return res.status(400).json({ error: 'Invalid or expired OTP.' });
  }
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: 'User not found.' });
  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();
  otpStore.delete(email);
  res.json({ success: true, message: 'Password updated successfully.' });
});

// Get current user
app.get('/api/me', auth, async (req, res) => {
  res.json({ id: req.user._id, name: req.user.name, email: req.user.email, isAdmin: req.user.isAdmin });
});

// --------------------- Course & Lecture Routes ---------------------
app.get('/api/courses', async (req, res) => {
  const courses = await Course.find({}, { 'chapters.lectures': 0 }); // exclude nested lectures for list
  res.json(courses);
});

app.get('/api/courses/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate({
      path: 'chapters.lectures',
      model: 'Lecture'
    });
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/api/lectures/:id', async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) return res.status(404).json({ error: 'Lecture not found.' });
  res.json(lecture);
});

// Enrollment – done on purchase (WhatsApp redirect handled on frontend)
app.post('/api/enroll', auth, async (req, res) => {
  try {
    const { courseId } = req.body;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    if (req.user.enrolledCourses.includes(courseId)) {
      return res.status(400).json({ error: 'Already enrolled.' });
    }
    req.user.enrolledCourses.push(courseId);
    await req.user.save();
    course.enrolledCount = (course.enrolledCount || 0) + 1;
    await course.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Enrollment failed.' });
  }
});

app.post('/api/complete-lecture', auth, async (req, res) => {
  const { lectureId } = req.body;
  if (!req.user.completedLectures.includes(lectureId)) {
    req.user.completedLectures.push(lectureId);
    await req.user.save();
  }
  res.json({ success: true, completedLectures: req.user.completedLectures });
});

app.get('/api/enrolled-courses', auth, async (req, res) => {
  await req.user.populate('enrolledCourses');
  // Calculate progress for each enrolled course
  const coursesWithProgress = await Promise.all(req.user.enrolledCourses.map(async (course) => {
    const allLectures = await Lecture.find({ course: course._id }, '_id');
    const lectureIds = allLectures.map(l => l._id.toString());
    const completed = req.user.completedLectures.filter(cl => lectureIds.includes(cl.toString()));
    const progress = lectureIds.length ? Math.round((completed.length / lectureIds.length) * 100) : 0;
    return { ...course.toObject(), progress };
  }));
  res.json(coursesWithProgress);
});

// --------------------- Doubts ---------------------
app.post('/api/doubts', auth, async (req, res) => {
  try {
    const { lectureId, question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required.' });
    const doubt = new Doubt({
      user: req.user._id,
      lecture: lectureId,
      question
    });
    await doubt.save();
    res.status(201).json(doubt);
  } catch (err) {
    res.status(500).json({ error: 'Could not post doubt.' });
  }
});

app.get('/api/doubts', auth, async (req, res) => {
  const doubts = await Doubt.find({ user: req.user._id })
    .populate('replies.user', 'name')
    .sort('-createdAt');
  res.json(doubts);
});

app.post('/api/doubts/:id/reply', auth, async (req, res) => {
  try {
    const doubt = await Doubt.findById(req.params.id);
    if (!doubt) return res.status(404).json({ error: 'Doubt not found.' });
    doubt.replies.push({
      user: req.user._id,
      reply: req.body.reply
    });
    await doubt.save();
    await doubt.populate('replies.user', 'name');
    res.json(doubt);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add reply.' });
  }
});

// --------------------- Tests ---------------------
app.get('/api/tests', auth, async (req, res) => {
  const now = new Date();
  const tests = await Test.find({
    $or: [
      { isLive: true },
      { schedule: { $lte: now } }
    ]
  }).select('title duration isLive schedule negativeMarking');
  res.json(tests);
});

app.get('/api/tests/:id', auth, async (req, res) => {
  const test = await Test.findById(req.params.id).lean();
  if (!test) return res.status(404).json({ error: 'Test not found.' });
  // For students, hide correct answers and numerical answers
  if (!req.user.isAdmin) {
    test.questions = test.questions.map(q => {
      const { correctAnswer, numericalAnswer, ...rest } = q;
      return rest;
    });
  }
  res.json(test);
});

app.post('/api/submit-test', auth, async (req, res) => {
  try {
    const { testId, answers, timeTaken } = req.body;
    const test = await Test.findById(testId);
    if (!test) return res.status(404).json({ error: 'Test not found.' });
    let score = 0;
    test.questions.forEach((q, i) => {
      if (q.isNumerical) {
        if (Math.abs((answers[i] ?? 0) - q.numericalAnswer) < 0.001) {
          score++;
        } else if (test.negativeMarking) {
          score -= test.negativeMarking;
        }
      } else {
        if (answers[i] === q.correctAnswer) {
          score++;
        } else if (test.negativeMarking) {
          score -= test.negativeMarking;
        }
      }
    });
    score = Math.max(score, 0);
    const attempt = new TestAttempt({
      user: req.user._id,
      test: testId,
      answers,
      score,
      total: test.questions.length,
      submittedAt: new Date(),
      timeTaken
    });
    await attempt.save();
    res.json(attempt);
  } catch (err) {
    res.status(500).json({ error: 'Test submission failed.' });
  }
});

app.get('/api/test-results/:testId', auth, async (req, res) => {
  const attempt = await TestAttempt.findOne({ user: req.user._id, test: req.params.testId })
    .sort('-submittedAt');
  res.json(attempt);
});

// Practice Test – AI generated via OpenRouter
app.post('/api/practice-test', auth, async (req, res) => {
  const { topic, difficulty } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic is required.' });
  const prompt = `Generate exactly 10 JEE-Mains style multiple choice questions on "${topic}" with difficulty "${difficulty || 'medium'}". Each question must have 4 options (A, B, C, D), the correct answer index (0-3), and a brief explanation. Return a JSON array with objects: {"questionText": "...", "options": ["A","B","C","D"], "correctAnswer": 0, "explanation": "..."}. Do not include any text outside the JSON.`;
  try {
    const aiResponse = await askOpenRouter(prompt, false);
    // Try to parse JSON from AI response
    let questions;
    const jsonStart = aiResponse.indexOf('[');
    const jsonEnd = aiResponse.lastIndexOf(']');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = aiResponse.substring(jsonStart, jsonEnd + 1);
      questions = JSON.parse(jsonStr);
    } else {
      questions = JSON.parse(aiResponse);
    }
    res.json({ questions: questions.slice(0, 10) });
  } catch (e) {
    console.error('Practice test AI error:', e);
    res.status(500).json({ error: 'AI failed to generate questions. Please try again later.' });
  }
});

// --------------------- AI Chatbot (Sankalp Sathi) ---------------------
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AI_MODELS = [
  'gpt-oss-120b',
  'llama-3.3-70b',
  'gemini-flash-1.5-8b'
];

async function askOpenRouter(promptText, useSystemPrompt = true) {
  const systemPrompt = `You are Sankalp Sathi, the official AI assistant of Sankalp Digital Pathshala. You are built by NexGenAiTech (founder: Jahid). Respond strictly in plain paragraphs. Do not use markdown, asterisks, or any formatting. Only answer questions related to Sankalp Shiksha Foundation, Sankalp Digital Pathshala, NexGenAiTech, and education. Politely decline anything else.

About Sankalp Shiksha Foundation:
- Mission: Empowering underprivileged students through free digital education.
- Founders: Abhishek Kumar and Vikas Kumar.
- Journey: Started 2020 with 10 students, now 5000+ students across Bihar.
- Rojgaar Buddy program: Skill training and job placement support for youth.
- Milestones: 2021 – 50 students, 2022 – online app launch, 2023 – 2000+ students, 2024 – partnership with NexGenAiTech.
- Vision: Free quality education for every child in India.
- Contact: help@sankalpfoundation.org, +91-1234567890.

About NexGenAiTech:
- Founder: Jahid.
- Services: AI-powered education platforms, web & app development, digital transformation.
- Website: nexgenaitech.com
- Phone: +91-9876543210.

You are friendly, encouraging, and knowledgeable. Keep responses concise and helpful.`;

  const messages = [];
  if (useSystemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: promptText });

  for (const model of AI_MODELS) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://sankalp-pathshala.vercel.app',
          'X-Title': 'Sankalp Digital Pathshala'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 800
        })
      });
      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (e) {
      console.log(`AI model ${model} failed, trying next...`);
    }
  }
  return "I'm sorry, the AI service is currently unavailable. Please try again later.";
}

app.post('/api/ai-chat', auth, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required.' });

  // Save user message
  await Chat.create({ user: req.user._id, role: 'user', content: message });

  // Send response as plain text stream
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  let fullReply = '';
  try {
    const reply = await askOpenRouter(message);
    fullReply = reply;
    // Simulate streaming (or you could implement real chunking)
    res.write(reply);
    await Chat.create({ user: req.user._id, role: 'ai', content: fullReply });
  } catch (error) {
    fullReply = "I'm sorry, an error occurred. Please try again.";
    res.write(fullReply);
  }
  res.end();
});

app.get('/api/ai-chat/history', auth, async (req, res) => {
  const chats = await Chat.find({ user: req.user._id }).sort('createdAt').limit(100);
  res.json(chats);
});

// --------------------- Messages (Direct) ---------------------
app.get('/api/users', auth, async (req, res) => {
  // List all non‑admin users for messaging
  const users = await User.find({ isAdmin: false }).select('name email');
  res.json(users);
});

app.post('/api/messages', auth, async (req, res) => {
  const { receiver, message } = req.body;
  if (!receiver || !message) return res.status(400).json({ error: 'Receiver and message are required.' });
  const msg = new Message({
    sender: req.user._id,
    receiver,
    message
  });
  await msg.save();
  res.json(msg);
});

app.get('/api/messages/:userId', auth, async (req, res) => {
  const msgs = await Message.find({
    $or: [
      { sender: req.user._id, receiver: req.params.userId },
      { sender: req.params.userId, receiver: req.user._id }
    ]
  }).populate('sender', 'name email').sort('createdAt');
  res.json(msgs);
});

// --------------------- Community Chat ---------------------
app.post('/api/community', auth, async (req, res) => {
  if (!req.body.message) return res.status(400).json({ error: 'Message is required.' });
  const msg = new Message({
    sender: req.user._id,
    message: req.body.message
  });
  await msg.save();
  await msg.populate('sender', 'name');
  res.json(msg);
});

app.get('/api/community', auth, async (req, res) => {
  const msgs = await Message.find({ receiver: null })
    .populate('sender', 'name email')
    .sort('-createdAt')
    .limit(200);
  res.json(msgs);
});

// --------------------- Notifications ---------------------
app.get('/api/notifications', auth, async (req, res) => {
  const notifs = await Notification.find({ userId: req.user._id }).sort('-createdAt');
  res.json(notifs);
});

app.put('/api/notifications/:id/read', auth, async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { read: true });
  res.json({ success: true });
});

// --------------------- Admin Routes ---------------------
// Stats
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const [users, courses, doubts, tests, testAttempts] = await Promise.all([
      User.countDocuments({ isAdmin: false }),
      Course.countDocuments(),
      Doubt.countDocuments(),
      Test.countDocuments(),
      TestAttempt.countDocuments()
    ]);
    res.json({ users, courses, doubts, tests, testAttempts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats.' });
  }
});

// Course CRUD
app.post('/api/admin/courses', adminAuth, async (req, res) => {
  try {
    const course = new Course(req.body);
    await course.save();
    res.status(201).json(course);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/courses/:id', adminAuth, async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    res.json(course);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/courses/:id', adminAuth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    // Delete all lectures belonging to this course
    await Lecture.deleteMany({ course: course._id });
    await Course.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Deletion failed.' });
  }
});

// Chapter management inside a course
app.post('/api/admin/courses/:id/chapters', adminAuth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    course.chapters.push(req.body);
    await course.save();
    res.json(course);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Add lecture to a specific chapter
app.post('/api/admin/courses/:courseId/chapters/:chapterIndex/lectures', adminAuth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    const chapterIndex = parseInt(req.params.chapterIndex);
    if (chapterIndex >= course.chapters.length) return res.status(400).json({ error: 'Invalid chapter index.' });
    const lecture = new Lecture({ ...req.body, course: course._id });
    await lecture.save();
    course.chapters[chapterIndex].lectures.push(lecture._id);
    await course.save();
    res.status(201).json(lecture);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Test management
app.post('/api/admin/tests', adminAuth, async (req, res) => {
  try {
    const test = new Test(req.body);
    await test.save();
    res.status(201).json(test);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/tests/:id', adminAuth, async (req, res) => {
  try {
    const test = await Test.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!test) return res.status(404).json({ error: 'Test not found.' });
    res.json(test);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/tests/:id', adminAuth, async (req, res) => {
  try {
    await Test.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Deletion failed.' });
  }
});

// Student management
app.get('/api/admin/students', adminAuth, async (req, res) => {
  const students = await User.find({ isAdmin: false })
    .select('-password')
    .populate('enrolledCourses', 'title');
  const result = students.map(s => ({
    ...s.toObject(),
    completedLecturesCount: s.completedLectures.length
  }));
  res.json(result);
});

app.post('/api/admin/assign-course', adminAuth, async (req, res) => {
  try {
    const { userId, courseId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (!user.enrolledCourses.includes(courseId)) {
      user.enrolledCourses.push(courseId);
      await user.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Doubt management for admin
app.get('/api/admin/doubts', adminAuth, async (req, res) => {
  const doubts = await Doubt.find()
    .populate('user', 'name email')
    .populate('lecture', 'title')
    .sort('-createdAt');
  res.json(doubts);
});

app.post('/api/admin/doubts/:id/reply', adminAuth, async (req, res) => {
  try {
    const doubt = await Doubt.findById(req.params.id);
    if (!doubt) return res.status(404).json({ error: 'Doubt not found.' });
    doubt.replies.push({ user: req.user._id, reply: req.body.reply });
    await doubt.save();
    res.json(doubt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Broadcast notification
app.post('/api/admin/notify', adminAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required.' });
    const students = await User.find({ isAdmin: false }).select('_id');
    const notifs = students.map(s => ({
      userId: s._id,
      message
    }));
    await Notification.insertMany(notifs);
    res.json({ success: true, count: notifs.length });
  } catch (err) {
    res.status(500).json({ error: 'Broadcast failed.' });
  }
});

// Detailed student report
app.get('/api/admin/student-report/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('enrolledCourses', 'title')
      .populate('completedLectures', 'title');
    if (!user) return res.status(404).json({ error: 'Student not found.' });
    const tests = await TestAttempt.find({ user: req.params.id }).populate('test', 'title');
    const doubts = await Doubt.find({ user: req.params.id });
    const chats = await Chat.find({ user: req.params.id });
    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        enrolledCourses: user.enrolledCourses,
        completedLectures: user.completedLectures
      },
      tests,
      doubts,
      chats
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load report.' });
  }
});

// --------------------- Serve Frontend (SPA fallback) ---------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --------------------- Error Handler ---------------------
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sankalp Digital Pathshala running on port ${PORT}`);
});
