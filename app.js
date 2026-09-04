// LocalStorage keys
const USER_KEY = 'aurastudy_user';
const TASKS_KEY = 'aurastudy_tasks';
const CHAT_KEY = 'aurastudy_chat';
const GOAL_KEY = 'aurastudy_daily_goal';
const STUDY_DAYS_KEY = 'aurastudy_study_days';
const ACTIVITY_KEY = 'aurastudy_activity';
const PROFILES_KEY = 'aurastudy_profiles';

// State
let currentUser = null;
let tasks = [];
let chats = [];
let timerInterval = null;
let timerSeconds = 25 * 60;
let isTimerRunning = false;
let dailyGoal = 60;
let studyDays = [];
let activities = [];
let editingTaskId = null;
let audioContext = null;
let ambienceSource = null;
let ambienceGain = null;
let ambienceFilter = null;
let uploadedAudio = null;

// DOM Elements
const authModal = document.getElementById('auth-modal');
const appContainer = document.getElementById('app');
const authForm = document.getElementById('auth-form');
const themeToggles = document.querySelectorAll('.theme-toggle');

// Initialize App
function init() {
  currentUser = JSON.parse(localStorage.getItem(USER_KEY));
  if (!currentUser) {
    authModal.classList.remove('hidden');
    appContainer.classList.add('hidden');
  } else {
    currentUser = openProfile(currentUser.name);
    authModal.classList.add('hidden');
    appContainer.classList.remove('hidden');
    document.querySelector('.display-user').textContent = currentUser.name;
    document.querySelector('.dash-user').textContent = currentUser.name;
    loadData();
    renderTasks();
    renderChats();
  }
}

// User Registration Form
authForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('user-name-input').value.trim();
  if (!name) return;
  currentUser = openProfile(name);
  init();
});

document.querySelector('.reset-btn').addEventListener('click', () => {
  clearInterval(timerInterval);
  localStorage.removeItem(USER_KEY);
  location.reload();
});

function profileId(name) {
  return encodeURIComponent(name.trim().toLowerCase());
}

function profileKey(baseKey, id = currentUser?.profileId) {
  return `${baseKey}_${id}`;
}

function migrateLegacyProfile(name, id) {
  const legacyUser = JSON.parse(localStorage.getItem(USER_KEY));
  if (!legacyUser || legacyUser.name.trim().toLowerCase() !== name.trim().toLowerCase()) return;

  const keys = [TASKS_KEY, CHAT_KEY, GOAL_KEY, STUDY_DAYS_KEY, ACTIVITY_KEY];
  keys.forEach(key => {
    const namespacedKey = profileKey(key, id);
    if (localStorage.getItem(namespacedKey) === null && localStorage.getItem(key) !== null) {
      localStorage.setItem(namespacedKey, localStorage.getItem(key));
    }
  });
}

function openProfile(name) {
  const id = profileId(name);
  migrateLegacyProfile(name, id);
  const saved = JSON.parse(localStorage.getItem(profileKey(USER_KEY, id))) || { name, minutesStudied: 0 };
  currentUser = { ...saved, name, profileId: id };
  localStorage.setItem(profileKey(USER_KEY, id), JSON.stringify(currentUser));
  localStorage.setItem(USER_KEY, JSON.stringify({ name, profileId: id }));
  return currentUser;
}

function saveCurrentUser() {
  localStorage.setItem(profileKey(USER_KEY), JSON.stringify(currentUser));
  localStorage.setItem(USER_KEY, JSON.stringify({ name: currentUser.name, profileId: currentUser.profileId }));
}

// Theme Switcher
themeToggles.forEach(themeToggle => themeToggle.addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
}));

// Navigation Engine
const sidebar = document.getElementById('sidebar');
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const mobileMenuIcon = document.getElementById('mobile-menu-icon');

function setMobileMenu(isOpen) {
  if (!sidebar || !mobileMenuToggle || !mobileMenuIcon) return;
  sidebar.classList.toggle('hidden', !isOpen);
  sidebar.classList.toggle('flex', isOpen);
  mobileMenuToggle.setAttribute('aria-expanded', String(isOpen));
  mobileMenuToggle.title = isOpen ? 'Close navigation' : 'Open navigation';
  mobileMenuIcon.textContent = isOpen ? '×' : '☰';
  mobileMenuToggle.querySelector('.sr-only').textContent = isOpen ? 'Close navigation' : 'Open navigation';
  mobileMenuToggle.classList.toggle('text-brand-600', !isOpen);
  mobileMenuToggle.classList.toggle('dark:text-brand-400', !isOpen);
  mobileMenuToggle.classList.toggle('border-brand-200', !isOpen);
  mobileMenuToggle.classList.toggle('dark:border-brand-500/40', !isOpen);
  mobileMenuToggle.classList.toggle('hover:bg-brand-50', !isOpen);
  mobileMenuToggle.classList.toggle('dark:hover:bg-brand-500/10', !isOpen);
  mobileMenuToggle.classList.toggle('text-rose-600', isOpen);
  mobileMenuToggle.classList.toggle('dark:text-rose-400', isOpen);
  mobileMenuToggle.classList.toggle('border-rose-200', isOpen);
  mobileMenuToggle.classList.toggle('dark:border-rose-500/40', isOpen);
  mobileMenuToggle.classList.toggle('hover:bg-rose-50', isOpen);
  mobileMenuToggle.classList.toggle('dark:hover:bg-rose-500/10', isOpen);
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.remove('bg-brand-50', 'text-brand-600', 'dark:bg-brand-500/10', 'dark:text-brand-500');
      b.classList.add('text-slate-600', 'dark:text-slate-400');
    });
    btn.classList.add('bg-brand-50', 'text-brand-600', 'dark:bg-brand-500/10', 'dark:text-brand-500');

    const view = btn.dataset.view;
    document.querySelectorAll('.view-content').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    setMobileMenu(false);
  });
});

if (mobileMenuToggle) {
  mobileMenuToggle.addEventListener('click', () => {
    setMobileMenu(mobileMenuToggle.getAttribute('aria-expanded') !== 'true');
  });
}

// Load Saved Data
function loadData() {
  tasks = JSON.parse(localStorage.getItem(profileKey(TASKS_KEY))) || [];
  chats = JSON.parse(localStorage.getItem(profileKey(CHAT_KEY))) || [];
  dailyGoal = Number(localStorage.getItem(profileKey(GOAL_KEY))) || 60;
  studyDays = JSON.parse(localStorage.getItem(profileKey(STUDY_DAYS_KEY))) || [];
  activities = JSON.parse(localStorage.getItem(profileKey(ACTIVITY_KEY))) || [];
  document.getElementById('goal-target-input').value = dailyGoal;
  updateDashboardStats();
}

function updateDashboardStats() {
  const completed = tasks.filter(t => t.done).length;
  document.getElementById('completed-count-display').textContent = `${completed}/${tasks.length}`;
  document.getElementById('total-time-display').textContent = `${currentUser.minutesStudied || 0}m`;
  updateGoalStats();
  renderHeatmap();
  renderActivity();
}

function getDateKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function getTodayKey() {
  return getDateKey();
}

function getTodayMinutes() {
  return studyDays.find(entry => entry.date === getTodayKey())?.minutes || 0;
}

function getCurrentStreak() {
  const studiedDates = new Set(studyDays.filter(entry => entry.minutes > 0).map(entry => entry.date));
  const date = new Date();
  let streak = 0;

  while (studiedDates.has(getDateKey(date))) {
    streak++;
    date.setDate(date.getDate() - 1);
  }

  return streak;
}

function updateGoalStats() {
  const minutes = getTodayMinutes();
  const percentage = Math.min(100, Math.round((minutes / dailyGoal) * 100));
  const circumference = 326.73;
  const progressRing = document.getElementById('goal-progress-ring');
  const streak = getCurrentStreak();

  document.getElementById('goal-minutes-display').textContent = minutes;
  document.getElementById('goal-target-display').textContent = dailyGoal;
  document.getElementById('goal-progress-percent').textContent = `${percentage}%`;
  document.getElementById('streak-badge').textContent = `🔥 ${streak} day${streak === 1 ? '' : 's'} streak`;
  progressRing.style.strokeDashoffset = circumference - (circumference * percentage) / 100;
}

function addActivity(text, icon = '•') {
  activities.unshift({ id: Date.now(), text, icon, date: new Date().toLocaleDateString() });
  activities = activities.slice(0, 8);
  localStorage.setItem(profileKey(ACTIVITY_KEY), JSON.stringify(activities));
  renderActivity();
}

function renderActivity() {
  const feed = document.getElementById('activity-feed');
  if (!activities.length) {
    feed.innerHTML = '<p class="text-sm text-slate-500">Your study activity will appear here.</p>';
    return;
  }
  feed.innerHTML = activities.map(activity => `
    <div class="flex items-center gap-3 text-sm">
      <span class="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center">${activity.icon}</span>
      <span class="flex-1">${activity.text}</span>
      <span class="text-[10px] text-slate-400">${activity.date}</span>
    </div>
  `).join('');
}

function renderHeatmap() {
  const heatmap = document.getElementById('study-heatmap');
  const minutesByDate = new Map(studyDays.map(entry => [entry.date, entry.minutes]));
  const today = new Date();
  const cells = [];
  let activeDays = 0;

  for (let offset = 27; offset >= 0; offset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = getDateKey(date);
    const minutes = minutesByDate.get(key) || 0;
    if (minutes > 0) activeDays++;
    const intensity = minutes >= 60 ? 'bg-brand-600' : minutes >= 25 ? 'bg-brand-400' : minutes > 0 ? 'bg-brand-200 dark:bg-brand-500/40' : 'bg-slate-100 dark:bg-slate-700';
    cells.push(`<span title="${key}: ${minutes} minutes" class="aspect-square rounded-md ${intensity}"></span>`);
  }
  heatmap.innerHTML = cells.join('');
  document.getElementById('active-days-display').textContent = `${activeDays} active day${activeDays === 1 ? '' : 's'}`;

  const streak = getCurrentStreak();
  document.getElementById('motivation-message').textContent = streak >= 3
    ? `You are on a ${streak}-day run. Keep the rhythm going.`
    : activeDays > 0
      ? 'A little progress today is enough to keep momentum.'
      : 'Start a focus session and make today count.';
}

function logStudyMinutes(minutes) {
  currentUser.minutesStudied = (currentUser.minutesStudied || 0) + minutes;
  saveCurrentUser();

  const today = getTodayKey();
  const todayEntry = studyDays.find(entry => entry.date === today);
  if (todayEntry) {
    todayEntry.minutes += minutes;
  } else {
    studyDays.push({ date: today, minutes });
  }
  localStorage.setItem(profileKey(STUDY_DAYS_KEY), JSON.stringify(studyDays));
  addActivity(`Completed a ${minutes}-minute focus session`, '⏱️');
  updateDashboardStats();
}

function celebrateCompletion() {
  const timerCard = document.getElementById('focus-timer-card');
  const message = document.getElementById('timer-completion-message');
  timerCard.classList.remove('timer-complete');
  void timerCard.offsetWidth;
  timerCard.classList.add('timer-complete');
  message.classList.remove('hidden');
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];
  for (let index = 0; index < 18; index++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${45 + Math.random() * 10}%`;
    piece.style.backgroundColor = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.25}s`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 1400);
  }
}

document.getElementById('goal-save-btn').addEventListener('click', () => {
  const input = document.getElementById('goal-target-input');
  dailyGoal = Math.min(600, Math.max(5, Number(input.value) || 60));
  input.value = dailyGoal;
  localStorage.setItem(profileKey(GOAL_KEY), dailyGoal);
  updateGoalStats();
  const status = document.getElementById('goal-save-status');
  status.textContent = 'Saved';
  status.className = 'text-xs text-emerald-500';
  setTimeout(() => {
    status.textContent = '';
  }, 1800);
});

document.getElementById('goal-target-input').addEventListener('keydown', event => {
  if (event.key === 'Enter') document.getElementById('goal-save-btn').click();
});

function stopAmbience() {
  if (ambienceSource) {
    try {
      ambienceSource.stop();
    } catch (error) {}
    ambienceSource.disconnect();
    ambienceSource = null;
  }
  if (ambienceFilter) {
    ambienceFilter.disconnect();
    ambienceFilter = null;
  }
  if (ambienceGain) {
    ambienceGain.disconnect();
    ambienceGain = null;
  }
  if (uploadedAudio) uploadedAudio.pause();
  document.getElementById('ambience-toggle').textContent = 'Play';
}

function startAmbience() {
  const type = document.getElementById('ambience-select').value;
  if (type === 'none') return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext = audioContext || new AudioContextClass();
  if (audioContext.state === 'suspended') audioContext.resume();
  ambienceGain = audioContext.createGain();
  ambienceGain.gain.value = Number(document.getElementById('ambience-volume').value);
  ambienceGain.connect(audioContext.destination);
  if (['brown', 'rain', 'ocean', 'cafe', 'white'].includes(type)) {
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 6, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOutput = 0;
    for (let index = 0; index < data.length; index++) {
      const white = Math.random() * 2 - 1;
      if (type === 'brown') {
        lastOutput = (lastOutput + 0.02 * white) / 1.02;
        data[index] = lastOutput * 3.5;
      } else if (type === 'ocean') {
        const wave = 0.2 + (Math.sin(index / audioContext.sampleRate * 0.18) + 1) * 0.28;
        data[index] = white * wave;
      } else if (type === 'cafe') {
        const burst = Math.random() > 0.997 ? (Math.random() * 2 - 1) * 0.9 : 0;
        data[index] = white * 0.22 + burst;
      } else {
        data[index] = white;
      }
    }
    ambienceSource = audioContext.createBufferSource();
    ambienceSource.buffer = buffer;
    ambienceSource.loop = true;
    if (type === 'rain' || type === 'ocean') {
      ambienceFilter = audioContext.createBiquadFilter();
      ambienceFilter.type = 'lowpass';
      ambienceFilter.frequency.value = type === 'rain' ? 1400 : 700;
      ambienceSource.connect(ambienceFilter);
      ambienceFilter.connect(ambienceGain);
    } else if (type === 'cafe') {
      ambienceFilter = audioContext.createBiquadFilter();
      ambienceFilter.type = 'bandpass';
      ambienceFilter.frequency.value = 900;
      ambienceFilter.Q.value = 0.7;
      ambienceSource.connect(ambienceFilter);
      ambienceFilter.connect(ambienceGain);
    } else {
      ambienceSource.connect(ambienceGain);
    }
  } else if (type === 'lofi') {
    const melody = audioContext.createOscillator();
    const bass = audioContext.createOscillator();
    const beat = audioContext.createOscillator();
    const melodyGain = audioContext.createGain();
    const bassGain = audioContext.createGain();
    const beatGain = audioContext.createGain();
    melody.type = 'triangle';
    bass.type = 'sine';
    beat.type = 'square';
    melody.frequency.value = 261.63;
    bass.frequency.value = 130.81;
    beat.frequency.value = 70;
    melodyGain.gain.value = 0.18;
    bassGain.gain.value = 0.12;
    beatGain.gain.value = 0.025;
    melody.connect(melodyGain).connect(ambienceGain);
    bass.connect(bassGain).connect(ambienceGain);
    beat.connect(beatGain).connect(ambienceGain);
    melody.start();
    bass.start();
    beat.start();
    ambienceSource = {
      start() {},
      stop() { melody.stop(); bass.stop(); beat.stop(); },
      disconnect() {
        melody.disconnect();
        bass.disconnect();
        beat.disconnect();
      }
    };
  } else if (type === 'upload' && uploadedAudio) {
    uploadedAudio.volume = Number(document.getElementById('ambience-volume').value);
    uploadedAudio.loop = true;
    uploadedAudio.play();
    ambienceSource = {
      stop() { uploadedAudio.pause(); },
      disconnect() {}
    };
  } else if (type === 'upload') {
    document.getElementById('ambience-track-status').textContent = 'Choose an audio file first.';
    ambienceGain.disconnect();
    ambienceGain = null;
    return;
  } else {
    ambienceSource = audioContext.createOscillator();
    ambienceSource.frequency.value = 432;
    ambienceSource.type = 'triangle';
    ambienceSource.connect(ambienceGain);
  }
  ambienceSource.start();
  document.getElementById('ambience-toggle').textContent = 'Stop';
}

document.getElementById('ambience-toggle').addEventListener('click', () => {
  if (ambienceSource) stopAmbience();
  else startAmbience();
});

document.getElementById('ambience-select').addEventListener('change', () => {
  if (ambienceSource) {
    stopAmbience();
    startAmbience();
  }
});

document.getElementById('ambience-volume').addEventListener('input', event => {
  if (ambienceGain) ambienceGain.gain.value = Number(event.target.value);
  if (uploadedAudio) uploadedAudio.volume = Number(event.target.value);
});

document.getElementById('ambience-file').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  if (uploadedAudio) uploadedAudio.pause();
  uploadedAudio = new Audio(URL.createObjectURL(file));
  document.getElementById('ambience-select').value = 'upload';
  document.getElementById('ambience-track-status').textContent = `${file.name} ready to play`;
  if (ambienceSource) stopAmbience();
});

// Task Manager
document.getElementById('add-task-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('task-title');
  const subjectInput = document.getElementById('task-subject');
  const priorityInput = document.getElementById('task-priority');
  const taskData = { title: input.value.trim(), subject: subjectInput.value.trim(), priority: priorityInput.value };
  if (editingTaskId) {
    tasks = tasks.map(task => task.id === editingTaskId ? { ...task, ...taskData } : task);
    addActivity(`Updated task: ${taskData.title}`, '✏️');
    editingTaskId = null;
    document.getElementById('task-submit-btn').textContent = 'Add Task';
  } else {
    tasks.push({ id: Date.now(), ...taskData, done: false });
    addActivity(`Added task: ${taskData.title}`, '📝');
  }
  localStorage.setItem(profileKey(TASKS_KEY), JSON.stringify(tasks));
  input.value = '';
  subjectInput.value = '';
  priorityInput.value = 'medium';
  renderTasks();
  updateDashboardStats();
});

function renderTasks() {
  const list = document.getElementById('planner-tasks-list');
  list.innerHTML = '';
  if (!tasks.length) {
    list.innerHTML = '<p class="text-sm text-slate-500">No tasks yet. Add your first study goal above.</p>';
    return;
  }
  tasks.forEach(t => {
    const item = document.createElement('div');
    const priorityColor = t.priority === 'high' ? 'text-red-500' : t.priority === 'low' ? 'text-slate-400' : 'text-amber-500';
    item.className = 'flex items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800';
    item.innerHTML = `
      <div class="flex items-center gap-3">
        <input type="checkbox" ${t.done ? 'checked' : ''} class="task-checkbox rounded border-slate-300 text-brand-600 focus:ring-brand-500">
        <div>
          <span class="task-title ${t.done ? 'line-through text-slate-400' : ''} text-sm font-medium"></span>
          <div class="flex gap-2 mt-1 text-[10px] font-semibold uppercase"><span class="${priorityColor}">${t.priority || 'medium'} priority</span><span class="task-subject text-slate-400"></span></div>
        </div>
      </div>
      <div class="flex items-center gap-3 shrink-0"><button class="edit-task text-xs text-brand-600">Edit</button><button class="delete-task text-xs text-red-500">Delete</button></div>
    `;
    item.querySelector('.task-title').textContent = t.title;
    item.querySelector('.task-subject').textContent = t.subject || '';
    item.querySelector('.task-checkbox').addEventListener('change', () => toggleTask(t.id));
    item.querySelector('.edit-task').addEventListener('click', () => editTask(t.id));
    item.querySelector('.delete-task').addEventListener('click', () => deleteTask(t.id));
    list.appendChild(item);
  });
}

function editTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;
  editingTaskId = id;
  document.getElementById('task-title').value = task.title;
  document.getElementById('task-subject').value = task.subject || '';
  document.getElementById('task-priority').value = task.priority || 'medium';
  document.getElementById('task-submit-btn').textContent = 'Save Task';
  document.getElementById('task-title').focus();
}

window.toggleTask = (id) => {
  const task = tasks.find(item => item.id === id);
  tasks = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
  localStorage.setItem(profileKey(TASKS_KEY), JSON.stringify(tasks));
  if (task && !task.done) addActivity(`Completed task: ${task.title}`, '✅');
  renderTasks();
  updateDashboardStats();
};

window.deleteTask = (id) => {
  const task = tasks.find(item => item.id === id);
  tasks = tasks.filter(t => t.id !== id);
  localStorage.setItem(profileKey(TASKS_KEY), JSON.stringify(tasks));
  if (task) addActivity(`Removed task: ${task.title}`, '🗑️');
  renderTasks();
  updateDashboardStats();
};

// Pomodoro Timer
const timerDisplay = document.getElementById('timer-display');
const timerStart = document.getElementById('timer-start');

timerStart.addEventListener('click', () => {
  if (isTimerRunning) {
    clearInterval(timerInterval);
    timerStart.textContent = 'Start';
  } else {
    timerInterval = setInterval(() => {
      if (timerSeconds > 0) {
        timerSeconds--;
        const mins = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
        const secs = (timerSeconds % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${mins}:${secs}`;
      } else {
        clearInterval(timerInterval);
        isTimerRunning = false;
        timerStart.textContent = 'Start';
        logStudyMinutes(25);
        celebrateCompletion();
        alert('Pomodoro session completed! 25 minutes logged.');
      }
    }, 1000);
    timerStart.textContent = 'Pause';
  }
  isTimerRunning = !isTimerRunning;
});

document.getElementById('timer-reset').addEventListener('click', () => {
  clearInterval(timerInterval);
  isTimerRunning = false;
  timerSeconds = 25 * 60;
  timerDisplay.textContent = '25:00';
  timerStart.textContent = 'Start';
  document.getElementById('timer-completion-message').classList.add('hidden');
});

// Netlify Serverless Function Handler
async function callAI(prompt) {
  try {
    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    return data.reply || "No response received from AI.";
  } catch (err) {
    return "Error connecting to AI service.";
  }
}

// AI Chat Assistant
document.getElementById('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const userText = input.value;
  input.value = '';

  chats.push({ role: 'user', text: userText });
  renderChats();

  const aiReply = await callAI(userText);
  chats.push({ role: 'ai', text: aiReply });
  localStorage.setItem(profileKey(CHAT_KEY), JSON.stringify(chats));
  renderChats();
});

function renderChats() {
  const box = document.getElementById('chat-box');
  box.innerHTML = '';
  chats.forEach(c => {
    const div = document.createElement('div');
    div.className = `p-4 rounded-xl text-sm max-w-[80%] ${c.role === 'user' ? 'bg-brand-600 text-white ml-auto' : 'bg-slate-100 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200'}`;
    div.textContent = c.text;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

// Preset Tools Launcher
document.querySelectorAll('.tool-card').forEach(card => {
  card.addEventListener('click', () => {
    const presetPrompt = card.dataset.prompt;
    document.querySelector('[data-view="assistant"]').click();
    document.getElementById('chat-input').value = presetPrompt;
  });
});

function parseAIJson(text) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned);
}

function renderQuiz(quiz) {
  const container = document.getElementById('quiz-container');
  let score = 0;
  let answered = 0;
  container.innerHTML = `<div class="flex items-center justify-between"><p class="text-sm font-semibold">Choose the best answer for each question.</p><span id="quiz-score" class="text-sm text-brand-600">0 / ${quiz.length}</span></div>`;

  quiz.forEach((question, questionIndex) => {
    const card = document.createElement('div');
    card.className = 'p-4 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-3';
    const title = document.createElement('p');
    title.className = 'text-sm font-semibold';
    title.textContent = `${questionIndex + 1}. ${question.question}`;
    card.appendChild(title);
    const options = document.createElement('div');
    options.className = 'grid gap-2';
    question.options.forEach((option, optionIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-option text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:border-brand-500 transition';
      button.textContent = option;
      button.addEventListener('click', () => {
        if (options.dataset.answered) return;
        options.dataset.answered = 'true';
        answered++;
        const isCorrect = optionIndex === question.answer;
        if (isCorrect) score++;
        button.classList.add(isCorrect ? 'bg-emerald-100' : 'bg-red-100');
        if (!isCorrect) options.children[question.answer].classList.add('bg-emerald-100');
        const explanation = document.createElement('p');
        explanation.className = 'text-xs text-slate-500';
        explanation.textContent = question.explanation || (isCorrect ? 'Correct.' : 'Review this concept and try again later.');
        card.appendChild(explanation);
        document.getElementById('quiz-score').textContent = `${score} / ${quiz.length}`;
        if (answered === quiz.length) addActivity(`Completed a ${score}/${quiz.length} quiz`, '🧪');
      });
      options.appendChild(button);
    });
    card.appendChild(options);
    container.appendChild(card);
  });
}

// Quiz Generator
document.getElementById('quiz-gen-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const topic = document.getElementById('quiz-topic').value;
  const container = document.getElementById('quiz-container');
  container.innerHTML = '<p class="text-sm text-slate-500">Generating quiz...</p>';

  const prompt = `Create a 3-question multiple choice quiz about ${topic}. Return only valid JSON as an array. Each item must have this exact shape: {"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}. The answer is the zero-based option index.`;
  const quizText = await callAI(prompt);
  try {
    const quiz = parseAIJson(quizText);
    renderQuiz(quiz);
  } catch (error) {
    container.innerHTML = '<p class="text-sm text-red-500">The quiz format could not be read. Please try again.</p>';
  }
});

document.getElementById('flashcard-gen-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const topic = document.getElementById('flashcard-topic').value;
  const container = document.getElementById('flashcard-container');
  container.innerHTML = '<p class="text-sm text-slate-500">Creating flashcards...</p>';
  const prompt = `Create 5 flashcards about ${topic}. Return only valid JSON as an array of objects with exactly these fields: {"question":"...","answer":"..."}.`;
  const response = await callAI(prompt);
  try {
    const cards = parseAIJson(response);
    container.innerHTML = '';
    cards.forEach((card, index) => {
      const cardElement = document.createElement('div');
      cardElement.className = 'border border-slate-200 dark:border-slate-700 rounded-xl p-4';
      cardElement.innerHTML = `<p class="text-xs text-slate-400 font-semibold uppercase">Card ${index + 1}</p><p class="flashcard-question text-sm font-semibold mt-2"></p><button type="button" class="flashcard-reveal mt-3 text-xs text-brand-600 font-semibold">Reveal answer</button><p class="flashcard-answer hidden text-sm text-slate-500 mt-3"></p>`;
      cardElement.querySelector('.flashcard-question').textContent = card.question;
      cardElement.querySelector('.flashcard-answer').textContent = card.answer;
      cardElement.querySelector('.flashcard-reveal').addEventListener('click', event => {
        const answer = cardElement.querySelector('.flashcard-answer');
        answer.classList.toggle('hidden');
        event.currentTarget.textContent = answer.classList.contains('hidden') ? 'Reveal answer' : 'Hide answer';
      });
      container.appendChild(cardElement);
    });
    addActivity(`Created flashcards about ${topic}`, '🎴');
  } catch (error) {
    container.innerHTML = '<p class="text-sm text-red-500">The flashcard format could not be read. Please try again.</p>';
  }
});

// Launch App
init();