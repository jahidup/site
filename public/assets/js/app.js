/*****************************************************
 *  Sankalp Digital Pathshala – complete app.js
 *  Final version with all fixes
 *****************************************************/
const API = '/api';
let token = localStorage.getItem('sp_token');
let currentUser = null;

// ==================== UTILS ====================
function $$(sel) { return document.querySelectorAll(sel); }
function $(sel) { return document.querySelector(sel); }
function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
function formatDate(d) { return new Date(d).toLocaleString('en-IN'); }

// Auth helpers
function setToken(t) { token = t; localStorage.setItem('sp_token', t); }
function logout() {
  localStorage.removeItem('sp_token');
  window.location.href = '/login.html';
}
async function fetchAuth(url, options = {}) {
  const headers = options.headers || {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

// ==================== AUTH CHECK ====================
async function getUser() {
  if (!token) return null;
  try {
    const res = await fetchAuth(`${API}/me`);
    if (res.ok) {
      currentUser = await res.json();
      return currentUser;
    } else {
      setToken(null);
      return null;
    }
  } catch { return null; }
}

// ==================== PAGE DETECTION ====================
const page = document.body.dataset.page || '';

// ==================== AUTH PAGES ====================
if (page === 'login' || window.location.pathname.includes('login')) {
  $('#loginForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#loginEmail').value.trim();
    const password = $('#loginPassword').value;
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        window.location.href = data.user.isAdmin ? '/admin.html' : '/dashboard.html';
      } else showToast(data.error, 'error');
    } catch { showToast('Login failed', 'error'); }
  });
}

if (page === 'register' || window.location.pathname.includes('register')) {
  $('#sendOtpBtn')?.addEventListener('click', async () => {
    const email = $('#regEmail').value.trim();
    if (!email) return showToast('Enter email', 'error');
    const res = await fetch(`${API}/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    showToast(data.message || data.error, data.success ? 'success' : 'error');
  });
  $('#registerForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#regName').value.trim();
    const email = $('#regEmail').value.trim();
    const password = $('#regPassword').value;
    const otp = $('#regOtp').value.trim();
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, otp })
    });
    const data = await res.json();
    if (data.token) {
      setToken(data.token);
      window.location.href = '/dashboard.html';
    } else showToast(data.error, 'error');
  });
}

if (page === 'forgot') {
  $('#forgotSendOtp')?.addEventListener('click', async () => {
    const email = $('#forgotEmail').value.trim();
    if (!email) return showToast('Enter email', 'error');
    const res = await fetch(`${API}/send-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const data = await res.json();
    showToast(data.message || data.error, data.success ? 'success' : 'error');
  });
  $('#forgotForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#forgotEmail').value.trim();
    const otp = $('#forgotOtp').value.trim();
    const newPassword = $('#newPassword').value;
    const res = await fetch(`${API}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, newPassword })
    });
    const data = await res.json();
    if (data.success) { showToast('Password updated. Login now.'); window.location.href = '/login.html'; }
    else showToast(data.error, 'error');
  });
}

// ==================== HOME & COURSE PAGES ====================
async function loadFeaturedCourses() {
  const container = $('#featuredCourses');
  if (!container) return;
  try {
    const res = await fetch(`${API}/courses`);
    const courses = await res.json();
    container.innerHTML = courses.slice(0, 3).map(c => `
      <div class="card course-card">
        <img src="${c.thumbnail || '/assets/images/default-course.jpg'}" alt="${c.title}" class="card-img" onerror="this.src='/assets/images/default-course.jpg'" />
        <div class="card-body">
          <h3 class="font-bold text-xl">${c.title}</h3>
          <p class="text-secondary text-sm">${c.description?.substring(0, 100)}...</p>
          <div class="flex items-baseline gap-2 mt-2">
            <span class="price-original">₹${c.originalPrice}</span>
            <span class="price-discounted">₹${c.price}</span>
          </div>
          <a href="/course-detail.html?id=${c._id}" class="btn-primary w-full mt-3 text-center">View Course</a>
        </div>
      </div>
    `).join('');
  } catch { container.innerHTML = '<p class="text-center text-secondary">Failed to load courses.</p>'; }
}

if (page === 'home' || window.location.pathname === '/' || window.location.pathname.includes('index')) {
  loadFeaturedCourses();
}

async function loadAllCourses() {
  const container = $('#allCourses');
  if (!container) return;
  try {
    const res = await fetch(`${API}/courses`);
    let courses = await res.json();
    const filterBtns = $$('.filter-btn');
    const searchInput = $('#courseSearch');
    let activeCategory = 'all';
    filterBtns.forEach(btn => btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      renderFiltered();
    }));
    function renderFiltered() {
      const searchTerm = searchInput?.value.toLowerCase() || '';
      const filtered = courses.filter(c => 
        (activeCategory === 'all' || c.category === activeCategory) &&
        c.title.toLowerCase().includes(searchTerm)
      );
      container.innerHTML = filtered.length ? filtered.map(c => `
        <div class="card course-card">
          <img src="${c.thumbnail || '/assets/images/default-course.jpg'}" alt="${c.title}" class="card-img" onerror="this.src='/assets/images/default-course.jpg'" />
          <div class="card-body">
            <h3>${c.title}</h3>
            <p class="text-secondary text-sm">${c.description?.substring(0, 80)}...</p>
            <div class="flex items-baseline gap-2 mt-2">
              <span class="price-original">₹${c.originalPrice}</span>
              <span class="price-discounted">₹${c.price}</span>
            </div>
            <a href="/course-detail.html?id=${c._id}" class="btn-outline w-full mt-3 text-center">Details</a>
          </div>
        </div>
      `).join('') : '<p class="text-secondary">No courses found.</p>';
    }
    renderFiltered();
    searchInput?.addEventListener('input', renderFiltered);
  } catch { container.innerHTML = '<p>Unable to load courses.</p>'; }
}

if (page === 'courses') loadAllCourses();

async function loadCourseDetail() {
  const detailContainer = $('#courseDetail');
  if (!detailContainer) return;
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) return detailContainer.innerHTML = '<p>Course not found.</p>';
  try {
    const res = await fetch(`${API}/courses/${id}`);
    const course = await res.json();
    detailContainer.innerHTML = `
      <div class="glass p-6 rounded-lg">
        <h1 class="text-3xl font-bold text-accent">${course.title}</h1>
        <p class="text-secondary mt-2">${course.description}</p>
        <div class="flex items-baseline gap-2 mt-4">
          <span class="price-original text-xl">₹${course.originalPrice}</span>
          <span class="price-discounted text-2xl">₹${course.price}</span>
        </div>
        <a href="https://wa.me/919876543210?text=I%20want%20to%20purchase%20${encodeURIComponent(course.title)}" class="btn-primary mt-4 inline-block">Buy Now (WhatsApp)</a>
        <div class="mt-6">
          <h3 class="text-xl font-semibold mb-2">Chapters</h3>
          ${course.chapters.map((ch, i) => `
            <div class="mb-3">
              <h4 class="font-medium">Chapter ${i+1}: ${ch.title}</h4>
              <ul class="ml-4 text-sm text-secondary">
                ${ch.lectures.map(l => `<li>• ${(l.title || l)}</li>`).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch { detailContainer.innerHTML = '<p>Failed to load course details.</p>'; }
}
if (page === 'course-detail') loadCourseDetail();

// ==================== DASHBOARD ====================
if (page === 'dashboard') {
  const sidebar = $('#sidebar');
  const topbar = $('.topbar');
  const content = $('#dashboardContent');
  let currentSection = 'my-courses';

  // Navigation
  $$('#sidebar .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth < 768) sidebar.classList.remove('mobile-open');
      loadSection(item.dataset.section);
    });
  });

  // Mobile toggle
  $('.menu-toggle')?.addEventListener('click', () => sidebar.classList.toggle('mobile-open'));

  // Auto-hide sidebar/topbar on scroll
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > lastScroll && y > 100) {
      topbar.classList.add('hidden');
      sidebar.classList.add('hidden');
    } else {
      topbar.classList.remove('hidden');
      sidebar.classList.remove('hidden');
    }
    lastScroll = y;
  });

  async function loadSection(section) {
    currentSection = section;
    $$('#sidebar .nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`#sidebar .nav-item[data-section="${section}"]`)?.classList.add('active');
    content.innerHTML = '<div class="text-center py-10">Loading...</div>';
    switch (section) {
      case 'my-courses': return await myCourses();
      case 'performance': return await performance();
      case 'ask-doubt': return await askDoubt();
      case 'my-doubts': return await myDoubtList();
      case 'ai-chat': return await aiChat();
      case 'tests': return await testsList();
      case 'practice': return await practiceTest();
      case 'messages': return await messages();
      case 'community': return await community();
      case 'notifications': return await notifications();
    }
  }

  // ---------- My Courses (with auto‑refresh) ----------
  async function myCourses() {
    // ✅ Force refresh of current user data so newly assigned courses appear immediately
    await getUser();
    const res = await fetchAuth(`${API}/enrolled-courses`);
    if (!res.ok) return content.innerHTML = '<p>Error loading courses. <button onclick="myCourses()" class="btn-outline text-sm">Retry</button></p>';
    const courses = await res.json();
    if (!courses.length) return content.innerHTML = '<p>No enrolled courses yet. <a href="/courses.html" class="text-accent">Browse courses</a>.</p>';
    content.innerHTML = courses.map(c => `
      <div class="card mb-4 p-4">
        <div class="flex justify-between items-center">
          <h3 class="text-xl font-bold">${c.title}</h3>
          <span class="text-accent">${c.progress}%</span>
        </div>
        <div class="progress-bar mt-2">
          <div style="width:${c.progress}%"></div>
        </div>
        <div class="mt-2 cursor-pointer lecture-toggle" data-course="${c._id}">View Lectures ▼</div>
        <div class="lecture-list hidden mt-2"></div>
      </div>
    `).join('');
    // Lecture expand
    $$('.lecture-toggle').forEach(toggle => {
      toggle.addEventListener('click', async function() {
        const listDiv = this.nextElementSibling;
        if (listDiv.classList.contains('hidden')) {
          listDiv.classList.remove('hidden');
          this.textContent = 'Hide Lectures ▲';
          const courseId = this.dataset.course;
          const res = await fetchAuth(`${API}/courses/${courseId}`);
          const course = await res.json();
          const allLectures = course.chapters.flatMap(ch => ch.lectures);
          listDiv.innerHTML = allLectures.map(l => `
            <div class="lecture-mobile-header glass mt-1" data-lecture="${l._id}">
              <span>${l.title}</span>
            </div>
            <div class="lecture-mobile-body p-2">
              <p><a href="${l.videoUrl}" target="_blank" class="btn-outline text-sm">Watch Video</a></p>
              ${l.notes ? `<p class="text-sm mt-1">Notes: ${l.notes}</p>` : ''}
              ${l.dppUrl ? `<a href="${l.dppUrl}" target="_blank" class="btn-outline text-sm mt-1">Download DPP</a>` : ''}
              <button class="btn-primary text-sm mt-2 mark-complete" data-lecture="${l._id}" onclick="event.stopPropagation()">Mark Complete</button>
            </div>
          `).join('');
          // Expandable mobile
          $$('.lecture-mobile-header').forEach(header => {
            header.addEventListener('click', () => {
              const body = header.nextElementSibling;
              body.classList.toggle('expanded');
            });
          });
          // Mark complete
          $$('.mark-complete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const lectureId = btn.dataset.lecture;
              await fetchAuth(`${API}/complete-lecture`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lectureId })
              });
              showToast('Lecture marked complete');
              myCourses(); // refresh progress
            });
          });
        } else {
          listDiv.classList.add('hidden');
          this.textContent = 'View Lectures ▼';
        }
      });
    });
  }

  // ---------- Performance ----------
  async function performance() {
    const res = await fetchAuth(`${API}/enrolled-courses`);
    const courses = await res.json();
    const userRes = await fetchAuth(`${API}/me`);
    const user = await userRes.json();
    content.innerHTML = '<h2 class="text-2xl font-bold mb-4">Performance Report</h2>';
    if (!courses.length) return content.innerHTML += '<p>No courses enrolled.</p>';
    courses.forEach(c => {
      content.innerHTML += `<div class="mb-2"><strong>${c.title}</strong> - ${c.progress}% completed</div>`;
    });
    content.innerHTML += `<p class="mt-4">Total lectures completed: ${user.completedLectures?.length || 0}</p>`;
  }

  // ---------- Ask Doubt ----------
  async function askDoubt() {
    const res = await fetchAuth(`${API}/enrolled-courses`);
    const courses = await res.json();
    let lectureOptions = '';
    for (const c of courses) {
      const detail = await fetchAuth(`${API}/courses/${c._id}`);
      const course = await detail.json();
      course.chapters.forEach(ch => ch.lectures.forEach(l => {
        lectureOptions += `<option value="${l._id}">${c.title} → ${l.title || 'Lecture'}</option>`;
      }));
    }
    content.innerHTML = `
      <h2 class="text-xl font-bold mb-4">Ask a Doubt</h2>
      <select id="doubtLecture" class="mb-2">${lectureOptions}</select>
      <textarea id="doubtQuestion" rows="3" placeholder="Describe your doubt..." class="mb-2"></textarea>
      <button id="submitDoubt" class="btn-primary">Submit</button>
      <div id="doubtReplyArea" class="mt-4"></div>
    `;
    $('#submitDoubt')?.addEventListener('click', async () => {
      const lectureId = $('#doubtLecture').value;
      const question = $('#doubtQuestion').value.trim();
      if (!question) return showToast('Enter question', 'error');
      const res = await fetchAuth(`${API}/doubts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lectureId, question })
      });
      if (res.ok) {
        showToast('Doubt submitted');
        $('#doubtQuestion').value = '';
        loadDoubtReplies(lectureId);
      } else showToast('Error', 'error');
    });
  }

  async function loadDoubtReplies(lectureId) {
    const area = $('#doubtReplyArea');
    area.innerHTML = '';
    const res = await fetchAuth(`${API}/doubts`);
    const doubts = await res.json();
    doubts.filter(d => d.lecture === lectureId).forEach(d => {
      area.innerHTML += `
        <div class="glass p-3 mb-2">
          <p><strong>Q:</strong> ${d.question}</p>
          <div class="ml-4 text-sm">${d.replies.map(r => `<p><em>${r.user?.name || 'Admin'}:</em> ${r.reply}</p>`).join('')}</div>
        </div>
      `;
    });
  }

  // ---------- My Doubts ----------
  async function myDoubtList() {
    const res = await fetchAuth(`${API}/doubts`);
    const doubts = await res.json();
    content.innerHTML = '<h2 class="text-xl font-bold mb-4">My Doubts</h2>';
    if (!doubts.length) return content.innerHTML += '<p>No doubts asked.</p>';
    doubts.forEach(d => {
      content.innerHTML += `
        <div class="glass p-3 mb-2">
          <p class="doubt-text truncated">${d.question}</p>
          ${d.question.length > 100 ? '<span class="read-more text-accent cursor-pointer">Read More</span>' : ''}
          <div class="ml-4 text-sm mt-1">Replies: ${d.replies.length}</div>
        </div>
      `;
    });
    $$('.read-more').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.previousElementSibling;
        text.classList.toggle('truncated');
        btn.textContent = text.classList.contains('truncated') ? 'Read More' : 'Read Less';
      });
    });
  }

  // ---------- Sankalp Sathi (AI Chat) ----------
  async function aiChat() {
    content.innerHTML = `
      <div class="flex flex-col h-[70vh]">
        <div id="chatMessages" class="flex-1 overflow-y-auto glass p-4 mb-4"></div>
        <div class="flex gap-2">
          <input id="chatInput" placeholder="Ask me anything about Sankalp..." class="flex-1" />
          <button id="sendChat" class="btn-primary">Send</button>
        </div>
      </div>
    `;
    const msgDiv = $('#chatMessages');
    const input = $('#chatInput');
    const send = $('#sendChat');

    const histRes = await fetchAuth(`${API}/ai-chat/history`);
    const history = await histRes.json();
    history.forEach(c => appendMessage(c.role, c.content));

    async function appendMessage(role, content) {
      const div = document.createElement('div');
      div.className = `mb-2 ${role === 'ai' ? 'text-accent' : ''}`;
      div.textContent = `${role === 'ai' ? 'Sathi' : 'You'}: ${content}`;
      msgDiv.appendChild(div);
      msgDiv.scrollTop = msgDiv.scrollHeight;
    }

    send.addEventListener('click', async () => {
      const msg = input.value.trim();
      if (!msg) return;
      appendMessage('user', msg);
      input.value = '';
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'mb-2 text-accent';
      loadingDiv.textContent = 'Sathi: ...';
      msgDiv.appendChild(loadingDiv);
      try {
        const res = await fetchAuth(`${API}/ai-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg })
        });
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        loadingDiv.textContent = 'Sathi: ';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          loadingDiv.textContent += decoder.decode(value);
          msgDiv.scrollTop = msgDiv.scrollHeight;
        }
      } catch {
        showToast('AI unavailable', 'error');
        loadingDiv.remove();
      }
    });
    input.addEventListener('keypress', e => { if (e.key === 'Enter') send.click(); });
  }

  // ---------- Tests ----------
  async function testsList() {
    const res = await fetchAuth(`${API}/tests`);
    const tests = await res.json();
    content.innerHTML = '<h2 class="text-xl font-bold mb-4">Available Tests</h2>';
    if (!tests.length) return content.innerHTML += '<p>No tests scheduled.</p>';
    tests.forEach(t => {
      content.innerHTML += `
        <div class="glass p-3 mb-2 flex justify-between items-center">
          <span>${t.title} (${t.duration} min)</span>
          <button class="btn-outline start-test" data-id="${t._id}">Start</button>
        </div>
      `;
    });
    $$('.start-test').forEach(btn => {
      btn.addEventListener('click', () => startTest(btn.dataset.id));
    });
  }

  async function startTest(testId) {
    const res = await fetchAuth(`${API}/tests/${testId}`);
    const test = await res.json();
    let answers = Array(test.questions.length).fill(null);
    let startTime = Date.now();
    let timerInterval;

    content.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <h2>${test.title}</h2>
        <div id="timer" class="text-accent font-bold">${test.duration}:00</div>
        <button id="submitTest" class="btn-primary">Submit</button>
      </div>
      <div class="flex flex-col md:flex-row gap-4">
        <div id="questionPalette" class="w-full md:w-1/4 glass p-3">
          <h3 class="text-lg mb-2">Questions</h3>
          <div class="grid grid-cols-5 gap-1">
            ${test.questions.map((_, i) => `<div class="palette-item w-8 h-8 flex items-center justify-center border cursor-pointer" data-q="${i}">${i+1}</div>`).join('')}
          </div>
        </div>
        <div id="questionArea" class="flex-1 glass p-4"></div>
      </div>
      <div id="explanationArea" class="mt-4"></div>
    `;

    let currentQ = 0;
    const paletteItems = $$('.palette-item');
    const questionDiv = $('#questionArea');
    const markedForReview = new Set();

    function renderQuestion(i) {
      const q = test.questions[i];
      questionDiv.innerHTML = `
        <h3 class="mb-2">Q${i+1}. ${q.questionText}</h3>
        ${q.image ? `<img src="${q.image}" class="max-w-full mb-2"/>` : ''}
        ${q.isNumerical ? `
          <input type="number" id="numericalAns" value="${answers[i] || ''}" placeholder="Enter answer" class="mt-2" />
        ` : q.options.map((opt, idx) => `
          <label class="block">
            <input type="radio" name="q${i}" value="${idx}" ${answers[i] === idx ? 'checked' : ''}> ${opt}
          </label>
        `).join('')}
        <button id="markReview" class="btn-outline mt-2 text-sm">${markedForReview.has(i) ? 'Unmark Review' : 'Mark for Review'}</button>
      `;
      if (q.isNumerical) {
        $('#numericalAns')?.addEventListener('input', e => answers[i] = parseFloat(e.target.value));
      } else {
        $$(`input[name="q${i}"]`).forEach(radio => {
          radio.addEventListener('change', () => answers[i] = parseInt(radio.value));
        });
      }
      $('#markReview')?.addEventListener('click', () => {
        if (markedForReview.has(i)) markedForReview.delete(i);
        else markedForReview.add(i);
        renderQuestion(i);
        updatePalette();
      });
      updatePalette();
    }

    function updatePalette() {
      paletteItems.forEach((item, idx) => {
        item.className = 'palette-item w-8 h-8 flex items-center justify-center border cursor-pointer';
        if (idx === currentQ) item.classList.add('bg-accent', 'text-black');
        if (answers[idx] !== null) item.classList.add('answered');
        if (markedForReview.has(idx)) item.classList.add('border-yellow-400');
      });
    }

    renderQuestion(0);

    paletteItems.forEach(item => {
      item.addEventListener('click', () => {
        currentQ = parseInt(item.dataset.q);
        renderQuestion(currentQ);
      });
    });

    // Timer
    let timeLeft = test.duration * 60;
    function updateTimer() {
      const min = Math.floor(timeLeft / 60);
      const sec = timeLeft % 60;
      $('#timer').textContent = `${min}:${sec.toString().padStart(2, '0')}`;
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        submitTest();
      }
      timeLeft--;
    }
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);

    // Tab switch warning
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) showToast('⚠️ Do not switch tabs!', 'error');
    });

    // Submit
    $('#submitTest')?.addEventListener('click', submitTest);

    async function submitTest() {
      clearInterval(timerInterval);
      const timeTaken = Math.round((Date.now() - startTime)/1000);
      const res = await fetchAuth(`${API}/submit-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, answers, timeTaken })
      });
      const result = await res.json();
      showToast(`Score: ${result.score}/${result.total}`);
      const fullTest = await (await fetchAuth(`${API}/tests/${testId}`)).json();
      let explHtml = '<h3 class="text-lg mt-4">Explanations</h3>';
      fullTest.questions.forEach((q, i) => {
        if (result.answers[i] !== q.correctAnswer && !q.isNumerical) {
          explHtml += `<div class="glass p-2 mb-2"><strong>Q${i+1}:</strong> ${q.explanation}</div>`;
        }
      });
      $('#explanationArea').innerHTML = explHtml;
    }
  }

  // ---------- Practice Test ----------
  async function practiceTest() {
    content.innerHTML = `
      <h2 class="text-xl font-bold mb-4">Generate Practice Test</h2>
      <input id="practiceTopic" placeholder="Topic (e.g., Kinematics)" class="mb-2" />
      <select id="practiceDifficulty" class="mb-2">
        <option>easy</option>
        <option selected>medium</option>
        <option>hard</option>
      </select>
      <button id="generatePractice" class="btn-primary mb-4">Generate</button>
      <div id="practiceArea"></div>
    `;
    $('#generatePractice')?.addEventListener('click', async () => {
      const topic = $('#practiceTopic').value.trim();
      const difficulty = $('#practiceDifficulty').value;
      if (!topic) return showToast('Enter topic', 'error');
      const res = await fetchAuth(`${API}/practice-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, difficulty })
      });
      const data = await res.json();
      if (data.questions) {
        startPracticeTest(data.questions);
      } else showToast(data.error, 'error');
    });
  }

  function startPracticeTest(questions) {
    let answers = Array(questions.length).fill(null);
    let currentQ = 0;
    const area = $('#practiceArea');
    area.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <span>Practice Test (${questions.length} Q)</span>
        <div id="practiceTimer">10:00</div>
        <button id="submitPractice" class="btn-primary">Submit</button>
      </div>
      <div id="practiceQuestion" class="glass p-4"></div>
      <div id="practiceExpl" class="mt-4"></div>
    `;
    function renderPracticeQuestion(i) {
      const q = questions[i];
      $('#practiceQuestion').innerHTML = `
        <h3>Q${i+1}. ${q.questionText}</h3>
        ${q.options.map((opt, idx) => `<label class="block"><input type="radio" name="pq${i}" value="${idx}" ${answers[i]===idx?'checked':''}> ${opt}</label>`).join('')}
      `;
      $$(`input[name="pq${i}"]`).forEach(radio => radio.addEventListener('change', e => answers[i] = parseInt(e.target.value)));
    }
    renderPracticeQuestion(0);
    document.addEventListener('click', function pqNav(e) {
      if (e.target.id === 'nextQ') { if (currentQ < questions.length-1) { currentQ++; renderPracticeQuestion(currentQ); } }
      if (e.target.id === 'prevQ') { if (currentQ > 0) { currentQ--; renderPracticeQuestion(currentQ); } }
    });
    area.insertAdjacentHTML('beforeend', `<div class="flex justify-between mt-2"><button id="prevQ" class="btn-outline">Prev</button><button id="nextQ" class="btn-outline">Next</button></div>`);
    $('#submitPractice')?.addEventListener('click', () => {
      let score = 0;
      questions.forEach((q, i) => { if (answers[i] === q.correctAnswer) score++; });
      showToast(`Your score: ${score}/${questions.length}`);
      let expl = '';
      questions.forEach((q, i) => {
        if (answers[i] !== q.correctAnswer) expl += `<p><strong>Q${i+1}:</strong> ${q.explanation}</p>`;
      });
      $('#practiceExpl').innerHTML = expl;
    });
  }

  // ---------- Messages ----------
  async function messages() {
    const usersRes = await fetchAuth(`${API}/users`);
    const users = await usersRes.json();
    content.innerHTML = `
      <div class="flex flex-col md:flex-row gap-4 h-[80vh]">
        <div id="userList" class="w-full md:w-1/3 glass p-3 overflow-y-auto">
          ${users.map(u => `<div class="user-item cursor-pointer p-2 hover:bg-gray-800" data-id="${u._id}">${u.name}</div>`).join('')}
        </div>
        <div id="chatArea" class="flex-1 flex flex-col glass p-3">
          <div id="messageList" class="flex-1 overflow-y-auto mb-2"></div>
          <div class="flex gap-2">
            <input id="messageInput" placeholder="Type..." class="flex-1" />
            <button id="sendMessage" class="btn-primary">Send</button>
          </div>
        </div>
      </div>
    `;
    let activeUser = null;
    $$('.user-item').forEach(ui => {
      ui.addEventListener('click', () => {
        activeUser = ui.dataset.id;
        loadChat(activeUser);
        $$('.user-item').forEach(u => u.classList.remove('bg-accent', 'text-black'));
        ui.classList.add('bg-accent', 'text-black');
      });
    });
    async function loadChat(userId) {
      const res = await fetchAuth(`${API}/messages/${userId}`);
      const msgs = await res.json();
      const list = $('#messageList');
      list.innerHTML = msgs.map(m => `<div class="mb-1"><strong>${m.sender?.name || 'You'}:</strong> ${m.message}</div>`).join('');
      list.scrollTop = list.scrollHeight;
    }
    $('#sendMessage')?.addEventListener('click', async () => {
      const msg = $('#messageInput').value.trim();
      if (!msg || !activeUser) return;
      await fetchAuth(`${API}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiver: activeUser, message: msg })
      });
      $('#messageInput').value = '';
      loadChat(activeUser);
    });
  }

  // ---------- Community ----------
  async function community() {
    content.innerHTML = `
      <h2 class="text-xl font-bold mb-2">Community Chat</h2>
      <div id="communityMessages" class="glass p-3 h-64 overflow-y-auto mb-2"></div>
      <div class="flex gap-2">
        <input id="communityInput" placeholder="Message..." class="flex-1" />
        <button id="sendCommunity" class="btn-primary">Send</button>
      </div>
    `;
    async function loadCommunity() {
      const res = await fetchAuth(`${API}/community`);
      const msgs = await res.json();
      const list = $('#communityMessages');
      list.innerHTML = msgs.map(m => `<div class="mb-1"><strong>${m.sender?.name}:</strong> ${m.message}</div>`).join('');
      list.scrollTop = list.scrollHeight;
    }
    loadCommunity();
    $('#sendCommunity')?.addEventListener('click', async () => {
      const msg = $('#communityInput').value.trim();
      if (!msg) return;
      await fetchAuth(`${API}/community`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      $('#communityInput').value = '';
      loadCommunity();
    });
    setInterval(loadCommunity, 10000);
  }

  // ---------- Notifications ----------
  async function notifications() {
    const res = await fetchAuth(`${API}/notifications`);
    const notifs = await res.json();
    content.innerHTML = '<h2 class="text-xl font-bold mb-4">Notifications</h2>';
    if (!notifs.length) return content.innerHTML += '<p>No notifications.</p>';
    notifs.forEach(n => {
      content.innerHTML += `
        <div class="glass p-2 mb-2 flex justify-between items-center ${n.read ? 'opacity-50' : ''}">
          <span>${n.message} <small class="text-secondary">${formatDate(n.createdAt)}</small></span>
          ${!n.read ? `<button class="btn-outline text-xs mark-read" data-id="${n._id}">Mark Read</button>` : ''}
        </div>
      `;
    });
    $$('.mark-read').forEach(btn => {
      btn.addEventListener('click', async () => {
        await fetchAuth(`${API}/notifications/${btn.dataset.id}/read`, { method: 'PUT' });
        notifications();
      });
    });
  }

  // Initial load
  loadSection('my-courses');
  getUser();
}

// ==================== ADMIN PANEL ====================
if (page === 'admin') {
  const sidebar = $('#adminSidebar');
  const content = $('#adminContent');
  const topbar = $('#adminTopbar');

  $$('#adminSidebar .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      loadAdminSection(item.dataset.section);
      if (window.innerWidth < 768) sidebar.classList.remove('mobile-open');
    });
  });

  $('.menu-toggle')?.addEventListener('click', () => sidebar.classList.toggle('mobile-open'));

  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > lastScroll && y > 100) {
      topbar.classList.add('hidden');
      sidebar.classList.add('hidden');
    } else {
      topbar.classList.remove('hidden');
      sidebar.classList.remove('hidden');
    }
    lastScroll = y;
  });

  async function loadAdminSection(section) {
    $$('#adminSidebar .nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`#adminSidebar .nav-item[data-section="${section}"]`)?.classList.add('active');
    content.innerHTML = '<div class="text-center py-10">Loading...</div>';
    switch(section) {
      case 'dashboard': return adminDashboard();
      case 'courses': return adminCourses();
      case 'tests': return adminTests();
      case 'students': return adminStudents();
      case 'doubts': return adminDoubtList();
      case 'broadcast': return adminBroadcast();
    }
  }

  async function adminDashboard() {
    const res = await fetchAuth(`${API}/admin/stats`);
    const stats = await res.json();
    content.innerHTML = `
      <h2 class="text-2xl font-bold mb-4">Admin Dashboard</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="stat-box"><h3>${stats.users}</h3><p>Students</p></div>
        <div class="stat-box"><h3>${stats.courses}</h3><p>Courses</p></div>
        <div class="stat-box"><h3>${stats.doubts}</h3><p>Doubts</p></div>
        <div class="stat-box"><h3>${stats.tests}</h3><p>Tests</p></div>
        <div class="stat-box"><h3>${stats.testAttempts}</h3><p>Attempts</p></div>
      </div>
    `;
  }

  // ---------- Manage Courses ----------
  async function adminCourses() {
    const res = await fetchAuth(`${API}/courses`);
    const courses = await res.json();
    content.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold">Manage Courses</h2>
        <button id="addCourseBtn" class="btn-primary">Add Course</button>
      </div>
      <div id="courseFormContainer" class="hidden glass p-4 mb-4"></div>
      <div id="courseList">
        ${courses.map(c => `
          <div class="glass p-3 mb-2 flex justify-between items-center">
            <span>${c.title}</span>
            <div>
              <button class="edit-course btn-outline text-xs" data-id="${c._id}">Edit</button>
              <button class="delete-course btn-outline text-xs text-danger" data-id="${c._id}">Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    $('#addCourseBtn')?.addEventListener('click', () => showCourseForm());
    $$('.edit-course').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id;
      const course = courses.find(c => c._id === id);
      showCourseForm(course);
    }));
    $$('.delete-course').forEach(btn => btn.addEventListener('click', async () => {
      if (confirm('Delete this course?')) {
        await fetchAuth(`${API}/admin/courses/${btn.dataset.id}`, { method: 'DELETE' });
        adminCourses();
      }
    }));
  }

  function showCourseForm(existing = null) {
    const container = $('#courseFormContainer');
    container.classList.remove('hidden');
    const isEdit = !!existing;
    container.innerHTML = `
      <h3>${isEdit ? 'Edit' : 'Add'} Course</h3>
      <input id="courseTitle" placeholder="Title" value="${existing?.title || ''}" class="mb-2" />
      <textarea id="courseDesc" placeholder="Description" class="mb-2">${existing?.description || ''}</textarea>
      <input id="coursePrice" type="number" placeholder="Price" value="${existing?.price || ''}" class="mb-2" />
      <input id="courseOriginalPrice" type="number" placeholder="Original Price" value="${existing?.originalPrice || ''}" class="mb-2" />
      <input id="courseThumbnail" placeholder="Thumbnail URL" value="${existing?.thumbnail || ''}" class="mb-2" />
      <input id="courseTeacher" placeholder="Teacher" value="${existing?.teacher || ''}" class="mb-2" />
      <input id="courseDuration" placeholder="Duration" value="${existing?.duration || ''}" class="mb-2" />
      <input id="courseCategory" placeholder="Category (jee/neet/foundation)" value="${existing?.category || ''}" class="mb-2" />
      <div class="flex gap-2">
        <button id="saveCourse" class="btn-primary">Save</button>
        <button id="cancelCourse" class="btn-outline">Cancel</button>
      </div>
    `;
    $('#saveCourse')?.addEventListener('click', async () => {
      const data = {
        title: $('#courseTitle').value,
        description: $('#courseDesc').value,
        price: Number($('#coursePrice').value),
        originalPrice: Number($('#courseOriginalPrice').value),
        thumbnail: $('#courseThumbnail').value,
        teacher: $('#courseTeacher').value,
        duration: $('#courseDuration').value,
        category: $('#courseCategory').value,
      };
      let url = `${API}/admin/courses`;
      let method = 'POST';
      if (isEdit) { url += `/${existing._id}`; method = 'PUT'; }
      const res = await fetchAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (res.ok) {
        showToast('Course saved');
        container.classList.add('hidden');
        adminCourses();
      } else {
        const err = await res.json();
        showToast(err.error, 'error');
      }
    });
    $('#cancelCourse')?.addEventListener('click', () => container.classList.add('hidden'));
  }

  // ---------- Manage Tests ----------
  async function adminTests() {
    const res = await fetchAuth(`${API}/tests`);
    const tests = await res.json();
    content.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold">Manage Tests</h2>
        <button id="addTestBtn" class="btn-primary">Add Test</button>
      </div>
      <div id="testFormContainer" class="hidden glass p-4 mb-4"></div>
      <div id="testList">
        ${tests.map(t => `
          <div class="glass p-3 mb-2 flex justify-between items-center">
            <span>${t.title}</span>
            <div>
              <button class="edit-test btn-outline text-xs" data-id="${t._id}">Edit</button>
              <button class="delete-test btn-outline text-xs text-danger" data-id="${t._id}">Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    $('#addTestBtn')?.addEventListener('click', () => showTestForm());
    $$('.edit-test').forEach(btn => btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const test = tests.find(t => t._id === id);
      showTestForm(test);
    }));
    $$('.delete-test').forEach(btn => btn.addEventListener('click', async () => {
      if (confirm('Delete test?')) {
        await fetchAuth(`${API}/admin/tests/${btn.dataset.id}`, { method: 'DELETE' });
        adminTests();
      }
    }));
  }

  async function showTestForm(existing = null) {
    const coursesRes = await fetchAuth(`${API}/courses`);
    const courses = await coursesRes.json();
    const container = $('#testFormContainer');
    container.classList.remove('hidden');
    const isEdit = !!existing;
    let questionsHtml = '';
    if (existing?.questions) {
      questionsHtml = existing.questions.map((q, i) => `
        <div class="glass p-2 mb-1">
          <input value="${q.questionText}" data-qidx="${i}" class="qtext mb-1" placeholder="Question text" />
          <div class="qoptions">${q.options ? q.options.map((opt, oi) => `<input value="${opt}" data-qidx="${i}" data-oidx="${oi}" class="qopt mb-1" placeholder="Option ${oi+1}" />`).join('') : ''}</div>
          <input value="${q.correctAnswer ?? ''}" data-qidx="${i}" class="qcorrect" placeholder="Correct answer index (0-3)" />
          <input value="${q.explanation || ''}" data-qidx="${i}" class="qexpl" placeholder="Explanation" />
        </div>
      `).join('');
    }
    container.innerHTML = `
      <h3>${isEdit ? 'Edit' : 'Add'} Test</h3>
      <input id="testTitle" placeholder="Title" value="${existing?.title || ''}" class="mb-2" />
      <select id="testCourse" class="mb-2">
        <option value="">Select Course</option>
        ${courses.map(c => `<option value="${c._id}" ${existing?.course === c._id ? 'selected' : ''}>${c.title}</option>`).join('')}
      </select>
      <input id="testDuration" type="number" placeholder="Duration (min)" value="${existing?.duration || ''}" class="mb-2" />
      <input id="testNegativeMarking" type="number" step="0.25" placeholder="Negative marking" value="${existing?.negativeMarking || 0}" class="mb-2" />
      <label class="block mb-2"><input type="checkbox" id="testLive" ${existing?.isLive ? 'checked' : ''}> Live</label>
      <div id="questionsContainer">${questionsHtml}</div>
      <button id="addQuestionBtn" class="btn-outline mb-2">Add Question</button>
      <div class="flex gap-2">
        <button id="saveTest" class="btn-primary">Save</button>
        <button id="cancelTest" class="btn-outline">Cancel</button>
      </div>
    `;

    $('#addQuestionBtn')?.addEventListener('click', () => {
      const qDiv = document.createElement('div');
      qDiv.className = 'glass p-2 mb-1';
      qDiv.innerHTML = `
        <input class="qtext mb-1" placeholder="Question text" />
        <input class="qopt mb-1" placeholder="Option A" />
        <input class="qopt mb-1" placeholder="Option B" />
        <input class="qopt mb-1" placeholder="Option C" />
        <input class="qopt mb-1" placeholder="Option D" />
        <input class="qcorrect mb-1" placeholder="Correct answer (0-3)" />
        <input class="qexpl mb-1" placeholder="Explanation" />
      `;
      $('#questionsContainer').appendChild(qDiv);
    });

    $('#saveTest')?.addEventListener('click', async () => {
      const questions = [...$$('#questionsContainer .glass')].map(qDiv => {
        const qtext = qDiv.querySelector('.qtext')?.value;
        const opts = [...qDiv.querySelectorAll('.qopt')].map(i => i.value).filter(Boolean);
        const correct = parseInt(qDiv.querySelector('.qcorrect')?.value);
        const expl = qDiv.querySelector('.qexpl')?.value;
        return { questionText: qtext, options: opts, correctAnswer: isNaN(correct) ? null : correct, isNumerical: opts.length === 0, numericalAnswer: null, explanation: expl };
      }).filter(q => q.questionText);
      const data = {
        title: $('#testTitle').value,
        course: $('#testCourse').value || null,
        duration: Number($('#testDuration').value),
        negativeMarking: Number($('#testNegativeMarking').value),
        isLive: $('#testLive').checked,
        questions
      };
      let url = `${API}/admin/tests`;
      let method = 'POST';
      if (isEdit) { url += `/${existing._id}`; method = 'PUT'; }
      const res = await fetchAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (res.ok) {
        showToast('Test saved');
        container.classList.add('hidden');
        adminTests();
      } else {
        const err = await res.json();
        showToast(err.error, 'error');
      }
    });
    $('#cancelTest')?.addEventListener('click', () => container.classList.add('hidden'));
  }

  // ---------- Students ----------
  async function adminStudents() {
    const res = await fetchAuth(`${API}/admin/students`);
    const students = await res.json();
    content.innerHTML = `<h2 class="text-2xl font-bold mb-4">Students (${students.length})</h2>`;
    students.forEach(s => {
      content.innerHTML += `
        <div class="glass p-3 mb-2">
          <p><strong>${s.name}</strong> (${s.email})</p>
          <p>Courses: ${s.enrolledCourses.map(c => c.title).join(', ') || 'None'}</p>
          <p>Completed Lectures: ${s.completedLecturesCount}</p>
          <button class="btn-outline text-xs assign-course-btn" data-userid="${s._id}">Assign Course</button>
        </div>
      `;
    });
    $$('.assign-course-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.userid;
        const coursesRes = await fetchAuth(`${API}/courses`);
        const courses = await coursesRes.json();
        const courseOptions = courses.map(c => `<option value="${c._id}">${c.title}</option>`).join('');
        const courseSelect = prompt('Select course ID:\n' + courses.map(c => `${c._id} - ${c.title}`).join('\n'));
        if (courseSelect) {
          if (confirm(`Assign course ${courseSelect} to this student?`)) {
            await fetchAuth(`${API}/admin/assign-course`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, courseId: courseSelect })
            });
            showToast('Course assigned');
            adminStudents();
          }
        }
      });
    });
  }

  // ---------- Doubt Management ----------
  async function adminDoubtList() {
    const res = await fetchAuth(`${API}/admin/doubts`);
    const doubts = await res.json();
    content.innerHTML = `<h2 class="text-2xl font-bold mb-4">Doubts</h2>`;
    if (!doubts.length) return content.innerHTML += '<p>No doubts yet.</p>';
    doubts.forEach(d => {
      content.innerHTML += `
        <div class="glass p-3 mb-2">
          <p><strong>${d.user?.name || 'Unknown'}</strong> (${d.lecture?.title || 'N/A'})</p>
          <p>${d.question}</p>
          <div class="text-sm">Replies: ${d.replies.length}</div>
          <button class="btn-outline text-xs reply-doubt-btn" data-id="${d._id}">Reply</button>
        </div>
      `;
    });
    $$('.reply-doubt-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const doubtId = btn.dataset.id;
        const reply = prompt('Enter reply:');
        if (reply) {
          await fetchAuth(`${API}/admin/doubts/${doubtId}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply })
          });
          showToast('Reply posted');
          adminDoubtList();
        }
      });
    });
  }

  // ---------- Broadcast ----------
  async function adminBroadcast() {
    content.innerHTML = `
      <h2 class="text-2xl font-bold mb-4">Broadcast Notification</h2>
      <textarea id="broadcastMsg" rows="3" placeholder="Message to all students..." class="mb-2"></textarea>
      <button id="sendBroadcast" class="btn-primary">Send</button>
    `;
    $('#sendBroadcast')?.addEventListener('click', async () => {
      const message = $('#broadcastMsg').value.trim();
      if (!message) return showToast('Enter a message', 'error');
      const res = await fetchAuth(`${API}/admin/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      if (data.success) showToast(`Sent to ${data.count} students`);
      else showToast(data.error, 'error');
    });
  }

  // Initial load
  loadAdminSection('dashboard');
  getUser();
}

// ---------- Toast styles ----------
const style = document.createElement('style');
style.textContent = `
.toast { position:fixed; bottom:20px; right:20px; padding:12px 24px; border-radius:4px; z-index:9999; color:white; font-weight:500; box-shadow:0 4px 12px rgba(0,0,0,0.3); animation: fadeUp 0.3s ease; }
.toast-success { background:#2ecc71; }
.toast-error { background:#ff4d6d; }
.palette-item.answered { background:#4fc3f7; color:#000; }
.progress-bar { background:#333; height:8px; border-radius:4px; overflow:hidden; }
.progress-bar > div { background:var(--accent); height:100%; border-radius:4px; transition:width 0.4s ease; }
.stat-box { background:var(--card-bg); border:1px solid var(--border); border-radius:6px; padding:20px; text-align:center; }
`;
document.head.appendChild(style);
