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

document.querySelectorAll('.reset-btn').forEach(resetButton => resetButton.addEventListener('click', () => {
  clearInterval(timerInterval);
  localStorage.removeItem(USER_KEY);
  location.reload();
}));

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

// Offline educational knowledge used by the assistant, quiz generator, and flashcards.
const EDUCATION_DATA = [
  {
    terms: ['photosynthesis', 'chlorophyll'], topic: 'Biology', title: 'Photosynthesis',
    answer: 'Photosynthesis is the process plants use to make glucose from light energy, water, and carbon dioxide. It mainly happens in chloroplasts, where chlorophyll captures light energy. Oxygen is released as a by-product.',
    cards: [['What is the main purpose of photosynthesis?', 'To convert light energy into chemical energy stored in glucose.'], ['What gas do plants take in during photosynthesis?', 'Carbon dioxide.']],
    questions: [{ question: 'Which substance captures light energy in plants?', options: ['Chlorophyll', 'Hemoglobin', 'Keratin', 'Insulin'], answer: 0, explanation: 'Chlorophyll is the green pigment that absorbs light.' }, { question: 'Which gas is released during photosynthesis?', options: ['Nitrogen', 'Oxygen', 'Methane', 'Hydrogen'], answer: 1, explanation: 'Oxygen is released when water molecules are split.' }]
  },
  {
    terms: ['mitosis', 'cell division', 'meiosis'], topic: 'Biology', title: 'Cell division',
    answer: 'Mitosis produces two genetically similar body cells for growth and repair. Meiosis produces sex cells with half the usual number of chromosomes and creates genetic variation.',
    cards: [['What does mitosis produce?', 'Two genetically similar cells.'], ['Why is meiosis important?', 'It produces sex cells and increases genetic variation.']],
    questions: [{ question: 'Which process produces genetically similar body cells?', options: ['Mitosis', 'Meiosis', 'Diffusion', 'Respiration'], answer: 0, explanation: 'Mitosis supports growth and repair.' }]
  },
  {
    terms: ['force', 'newton', 'motion', 'physics'], topic: 'Physics', title: 'Force and motion',
    answer: "A force is a push or pull that can change an object's motion. Newton's second law relates force, mass, and acceleration: F = m × a. A larger force produces a larger acceleration when mass stays constant.",
    cards: [["What is the formula for Newton's second law?", 'F = m × a.'], ["What can a force change?", "An object's speed, direction, or shape."]],
    questions: [{ question: 'What happens to acceleration when force increases and mass stays constant?', options: ['It increases', 'It decreases', 'It becomes zero', 'It cannot change'], answer: 0, explanation: 'From F = m × a, acceleration rises with force when mass is fixed.' }]
  },
  {
    terms: ['gravity', 'gravitational'], topic: 'Physics', title: 'Gravity',
    answer: 'Gravity is the attractive force between objects with mass. On Earth it pulls objects toward the planet’s center and gives falling objects an acceleration of about 9.8 m/s², ignoring air resistance.',
    cards: [['What does gravity do near Earth?', 'It accelerates objects toward Earth’s center.']],
    questions: [{ question: 'What is the approximate acceleration due to gravity on Earth?', options: ['9.8 m/s²', '98 m/s²', '0.98 m/s²', '1 m/s²'], answer: 0, explanation: 'The standard approximate value is 9.8 m/s².' }]
  },
  {
    terms: ['algebra', 'equation', 'variable', 'math', 'mathematics'], topic: 'Mathematics', title: 'Solving equations',
    answer: 'To solve an equation, use inverse operations to isolate the unknown while performing the same operation on both sides. For example, x + 3 = 7 becomes x = 4 after subtracting 3 from both sides.',
    cards: [['What should you do to both sides of an equation?', 'Apply the same operation to preserve equality.'], ['What is the inverse of multiplication?', 'Division.']],
    questions: [{ question: 'If x + 3 = 7, what is x?', options: ['3', '4', '10', '21'], answer: 1, explanation: 'Subtract 3 from both sides: x = 4.' }]
  },
  {
    terms: ['fraction', 'fractions'], topic: 'Mathematics', title: 'Fractions',
    answer: 'A fraction represents part of a whole. The numerator is the top number and counts selected parts; the denominator is the bottom number and names the total equal parts. Equivalent fractions have the same value.',
    cards: [['What does the denominator show?', 'The number of equal parts in the whole.']],
    questions: [{ question: 'In 3/5, what is the numerator?', options: ['3', '5', '8', '15'], answer: 0, explanation: 'The numerator is the top number, 3.' }]
  },
  {
    terms: ['atom', 'element', 'chemistry'], topic: 'Chemistry', title: 'Atoms and elements',
    answer: "An atom is the smallest unit of an element that keeps that element's properties. It contains protons and neutrons in a nucleus, with electrons in regions around the nucleus. The number of protons identifies the element.",
    cards: [['What identifies an element?', 'Its number of protons, called the atomic number.'], ['Where are protons found?', "In the atom's nucleus."]],
    questions: [{ question: "Which particle determines an element's identity?", options: ['Electron', 'Neutron', 'Proton', 'Photon'], answer: 2, explanation: 'The atomic number equals the number of protons.' }]
  },
  {
    terms: ['ecosystem', 'food chain', 'ecology'], topic: 'Environmental science', title: 'Ecosystems',
    answer: 'An ecosystem includes living organisms and the non-living environment interacting in an area. Energy usually enters through producers such as plants, then moves to consumers and decomposers through food webs.',
    cards: [['What is a producer?', 'An organism, usually a plant, that makes its own food.'], ['What do decomposers do?', 'They break down dead matter and recycle nutrients.']],
    questions: [{ question: 'Which organism is usually a producer?', options: ['A green plant', 'A hawk', 'A mushroom', 'A wolf'], answer: 0, explanation: 'Plants make food using photosynthesis.' }]
  },
  {
    terms: ['history', 'revolution', 'civilization'], topic: 'History', title: 'Studying history',
    answer: 'History studies change and continuity over time using evidence such as documents, artifacts, oral accounts, and archaeological remains. Strong historical explanations distinguish primary sources from later interpretations and consider context and bias.',
    cards: [['What is a primary source?', 'Evidence created during the period being studied.']],
    questions: [{ question: 'Which is a primary source?', options: ['A diary written during an event', 'A modern textbook', 'A later documentary', 'An encyclopedia summary'], answer: 0, explanation: 'A diary created at the time is direct historical evidence.' }]
  },
  {
    terms: ['grammar', 'writing', 'essay', 'english'], topic: 'Language arts', title: 'Clear academic writing',
    answer: 'Clear academic writing states a focused claim, supports it with relevant evidence, explains how the evidence proves the claim, and uses organized paragraphs. Revising for clarity and checking sources are part of the writing process.',
    cards: [['What should evidence do in an essay?', 'Support the claim and be explained in context.']],
    questions: [{ question: 'What is the main claim of an essay called?', options: ['A thesis', 'A citation', 'A heading', 'A footnote'], answer: 0, explanation: "The thesis states the essay's central argument." }]
  },
  {
    terms: ['geography', 'map', 'continent', 'climate'], topic: 'Geography', title: 'Maps and climate',
    answer: 'Geography studies places, people, environments, and the relationships between them. Weather describes short-term atmospheric conditions, while climate describes long-term patterns in a region. Maps use symbols and scale to represent space.',
    cards: [['What is the difference between weather and climate?', 'Weather is short-term; climate is the long-term pattern.'], ['What does map scale show?', 'The relationship between distance on a map and distance in the real world.']],
    questions: [{ question: 'Which term describes long-term atmospheric patterns?', options: ['Climate', 'Weather', 'Latitude', 'Altitude'], answer: 0, explanation: 'Climate describes patterns measured over long periods.' }]
  },
  {
    terms: ['economics', 'economy', 'supply', 'demand'], topic: 'Economics', title: 'Supply and demand',
    answer: 'Supply is the amount sellers are willing to offer, while demand is the amount buyers are willing to purchase. In a competitive market, price is influenced by how supply and demand interact. A shortage occurs when demand is greater than supply.',
    cards: [['What is demand?', 'The amount consumers are willing and able to buy.'], ['What is a shortage?', 'A situation where demand is greater than supply.']],
    questions: [{ question: 'What usually happens when demand rises while supply stays the same?', options: ['Price pressure tends to rise', 'All prices become zero', 'Supply disappears permanently', 'Consumers stop wanting the product'], answer: 0, explanation: 'More demand competing for the same supply generally puts upward pressure on price.' }]
  },
  {
    terms: ['computer science', 'computer', 'algorithm', 'coding', 'programming'], topic: 'Computer science', title: 'Algorithms and programming',
    answer: 'An algorithm is a finite, ordered set of instructions for solving a problem. A program expresses an algorithm in a language a computer can execute. Good algorithms are correct, clear, and efficient for the size of the input.',
    cards: [['What is an algorithm?', 'A step-by-step procedure for solving a problem.'], ['What does a program do?', 'It expresses instructions that a computer can execute.']],
    questions: [{ question: 'Which quality means an algorithm uses reasonable resources?', options: ['Efficiency', 'Decoration', 'Ambiguity', 'Randomness'], answer: 0, explanation: 'Efficiency concerns the time and memory an algorithm uses.' }]
  },
  {
    terms: ['statistics', 'mean', 'median', 'data'], topic: 'Statistics', title: 'Describing data',
    answer: 'Statistics collects, organizes, analyzes, and interprets data. The mean is the arithmetic average, the median is the middle value after sorting, and the mode is the most frequent value. The best measure depends on the shape of the data.',
    cards: [['How is the mean calculated?', 'Add all values and divide by the number of values.'], ['What is the median?', 'The middle value in an ordered data set.']],
    questions: [{ question: 'Which measure is the middle value in an ordered list?', options: ['Median', 'Mean', 'Range', 'Mode'], answer: 0, explanation: 'The median divides an ordered data set into two halves.' }]
  },
  {
    terms: ['probability', 'chance', 'random'], topic: 'Mathematics', title: 'Probability',
    answer: 'Probability measures how likely an event is. For equally likely outcomes, probability equals the number of favorable outcomes divided by the total number of outcomes. It ranges from 0 for impossible to 1 for certain.',
    cards: [['What values can probability have?', 'Values from 0 to 1, or 0% to 100%.'], ['How is simple probability found?', 'Favorable outcomes divided by total equally likely outcomes.']],
    questions: [{ question: 'What does a probability of 0 mean?', options: ['The event is impossible', 'The event is certain', 'The event is half likely', 'There are no outcomes'], answer: 0, explanation: 'Zero probability represents an impossible event.' }]
  },
  {
    terms: ['geometry', 'triangle', 'angle', 'area', 'perimeter'], topic: 'Mathematics', title: 'Geometry basics',
    answer: 'Geometry studies shapes, sizes, positions, and properties of space. Perimeter measures the distance around a two-dimensional shape, while area measures the surface inside it. The angles in every triangle add to 180 degrees.',
    cards: [['What does perimeter measure?', 'The distance around a shape.'], ['What is the angle sum of a triangle?', '180 degrees.']],
    questions: [{ question: 'What do the interior angles of a triangle add to?', options: ['180 degrees', '90 degrees', '270 degrees', '360 degrees'], answer: 0, explanation: 'Every triangle has an interior angle sum of 180 degrees.' }]
  },
  {
    terms: ['astronomy', 'space', 'planet', 'solar system'], topic: 'Astronomy', title: 'The solar system',
    answer: 'The solar system contains the Sun, planets, moons, dwarf planets, asteroids, and comets held together mainly by gravity. Planets orbit the Sun, and their apparent motion comes from their movement through space and the viewing position of Earth.',
    cards: [['What is at the center of our solar system?', 'The Sun.'], ['What force keeps planets in orbit?', 'Gravity.']],
    questions: [{ question: 'What is the main force governing planetary orbits?', options: ['Gravity', 'Friction', 'Sound', 'Magnetism alone'], answer: 0, explanation: 'The Sun\'s gravity provides the force that keeps planets in orbit.' }]
  },
  {
    terms: ['earth science', 'geology', 'rock', 'earthquake', 'volcano'], topic: 'Earth science', title: 'Earth systems',
    answer: 'Earth science studies the planet\'s solid Earth, water, atmosphere, and space environment. Plate tectonics explains the movement of large crustal plates, which can cause earthquakes, form mountains, and create volcanoes at their boundaries.',
    cards: [['What does plate tectonics describe?', 'The movement of large plates that make up Earth\'s crust.'], ['What can plate boundaries cause?', 'Earthquakes, mountains, and volcanic activity.']],
    questions: [{ question: 'What theory explains the movement of Earth\'s crustal plates?', options: ['Plate tectonics', 'Cell theory', 'Germ theory', 'Relativity'], answer: 0, explanation: 'Plate tectonics explains crustal plate movement and its effects.' }]
  },
  {
    terms: ['psychology', 'memory', 'behavior', 'brain'], topic: 'Psychology', title: 'Learning and memory',
    answer: 'Psychology studies behavior and mental processes. Learning involves a relatively lasting change based on experience, while memory involves encoding, storing, and retrieving information. Practice, retrieval, and meaningful connections can strengthen learning.',
    cards: [['What are three memory processes?', 'Encoding, storage, and retrieval.'], ['What is retrieval practice?', 'Trying to recall information instead of only rereading it.']],
    questions: [{ question: 'Which action is an example of retrieval practice?', options: ['Answering questions from memory', 'Highlighting every sentence', 'Avoiding review', 'Copying a page without thinking'], answer: 0, explanation: 'Retrieval practice strengthens learning by recalling information.' }]
  },
  {
    terms: ['civics', 'government', 'democracy', 'citizenship'], topic: 'Civics', title: 'Democracy and government',
    answer: 'Civics studies how people participate in public life and how governments make and apply decisions. In a democracy, political power is limited by rules and citizens can participate through voting, discussion, representation, and peaceful civic action.',
    cards: [['What is civic participation?', 'Taking part in public decisions and community life.'], ['Why are rules important in government?', 'They limit power and help protect rights and responsibilities.']],
    questions: [{ question: 'Which is an example of civic participation?', options: ['Voting in an election', 'Ignoring every public issue', 'Destroying evidence', 'Refusing all discussion'], answer: 0, explanation: 'Voting is a direct way citizens participate in government.' }]
  },
  {
    terms: ['health', 'nutrition', 'wellness', 'body'], topic: 'Health education', title: 'Healthy habits',
    answer: 'Health education develops knowledge and skills for physical, mental, and social well-being. Helpful foundations include regular movement, nutritious food, adequate sleep, stress management, hygiene, and seeking qualified help when needed.',
    cards: [['What areas does health include?', 'Physical, mental, and social well-being.'], ['Why is sleep important for students?', 'It supports attention, memory, mood, and physical recovery.']],
    questions: [{ question: 'Which habit supports learning and memory?', options: ['Adequate sleep', 'Constant sleep loss', 'Skipping all meals', 'Avoiding movement'], answer: 0, explanation: 'Adequate sleep supports attention, memory, and recovery.' }]
  },
  {
    terms: ['literature', 'poetry', 'novel', 'story'], topic: 'Literature', title: 'Reading literature',
    answer: 'Literature uses language to explore experiences, ideas, and imagination. Theme is a central idea, plot is the sequence of events, setting is where and when a story happens, and characterization shows how a character is presented and developed.',
    cards: [['What is a theme?', 'A central idea or message explored by a work.'], ['What is setting?', 'The time and place of a story.']],
    questions: [{ question: 'What does a story\'s setting describe?', options: ['Its time and place', 'Only its title', 'The author\'s biography', 'The number of pages'], answer: 0, explanation: 'Setting establishes when and where the events occur.' }]
  },
  {
    terms: ['philosophy', 'ethics', 'logic'], topic: 'Philosophy', title: 'Reasoning and ethics',
    answer: 'Philosophy examines fundamental questions about knowledge, reality, reasoning, and values. Logic evaluates whether conclusions follow from premises, while ethics examines ideas about right action, responsibility, and what makes a life good.',
    cards: [['What does logic examine?', 'Whether conclusions follow from premises.'], ['What does ethics study?', 'Questions about right action, values, and responsibility.']],
    questions: [{ question: 'Which field studies right action and responsibility?', options: ['Ethics', 'Geometry', 'Astronomy', 'Linguistics'], answer: 0, explanation: 'Ethics examines moral values and responsible action.' }]
  },
  {
    terms: ['business', 'entrepreneurship', 'marketing'], topic: 'Business studies', title: 'Business basics',
    answer: 'A business organizes people and resources to create value through products or services. Revenue is money earned, cost is money spent, and profit is revenue minus costs. Marketing communicates value to a chosen audience.',
    cards: [['How is profit calculated?', 'Revenue minus costs.'], ['What is marketing?', 'Communicating a product or service\'s value to an audience.']],
    questions: [{ question: 'If revenue is $100 and costs are $70, what is profit?', options: ['$30', '$70', '$100', '$170'], answer: 0, explanation: 'Profit equals revenue minus costs: $100 - $70 = $30.' }]
  },
  {
    terms: ['art', 'design', 'color', 'visual arts'], topic: 'Art and design', title: 'Elements of visual art',
    answer: 'Visual art uses elements such as line, shape, color, texture, form, space, and value. Artists combine these elements with principles such as contrast, balance, rhythm, emphasis, and unity to communicate ideas or create an experience.',
    cards: [['What is contrast?', 'A noticeable difference between visual elements.'], ['What is value in art?', 'How light or dark a color or surface appears.']],
    questions: [{ question: 'Which is an element of visual art?', options: ['Color', 'Profit', 'Gravity', 'Supply'], answer: 0, explanation: 'Color is one of the basic elements artists use to communicate.' }]
  },
  {
    terms: ['music', 'rhythm', 'melody', 'harmony'], topic: 'Music', title: 'Music foundations',
    answer: 'Music organizes sound through elements such as rhythm, melody, harmony, dynamics, timbre, and form. Rhythm concerns patterns in time, melody is a sequence of pitches, and harmony is the sounding of pitches together.',
    cards: [['What is rhythm?', 'A pattern of sounds and silences in time.'], ['What is melody?', 'A sequence of pitches heard as a musical idea.']],
    questions: [{ question: 'What does rhythm organize?', options: ['Sounds and silences in time', 'Only the color of an instrument', 'The price of a concert', 'The temperature of a room'], answer: 0, explanation: 'Rhythm creates patterns in musical time.' }]
  },
  {
    terms: ['study skills', 'studying', 'revision', 'exam', 'learning'], topic: 'Study skills', title: 'Effective learning',
    answer: 'Effective learning combines clear goals, focused practice, retrieval from memory, spaced review, useful feedback, and enough rest. A practical cycle is: understand the idea, close the notes, recall it, check the answer, then practise it again later.',
    cards: [['What is spaced practice?', 'Reviewing information across several sessions instead of cramming once.'], ['What is retrieval practice?', 'Recalling information from memory before checking the answer.']],
    questions: [{ question: 'Which method usually strengthens long-term recall?', options: ['Spaced retrieval practice', 'Cramming once', 'Only rereading', 'Avoiding feedback'], answer: 0, explanation: 'Spacing and retrieval give memory repeated, effortful practice.' }]
  },
  {
    terms: ['time management', 'productivity', 'procrastination', 'planning'], topic: 'Life skills', title: 'Time and priorities',
    answer: 'Time management means choosing what deserves attention and turning it into realistic actions. Start with the most important outcome, break it into a small next step, estimate the time, schedule focused work, and review what changed.',
    cards: [['What is a useful first step for a large task?', 'Define one small, visible next action.'], ['Why estimate task time?', 'To create a realistic plan and notice hidden work.']],
    questions: [{ question: 'Which action makes a large task easier to start?', options: ['Break it into a small next step', 'Wait for perfect motivation', 'Add more vague goals', 'Ignore the deadline'], answer: 0, explanation: 'A small next step lowers the barrier to beginning.' }]
  },
  {
    terms: ['goals', 'goal setting', 'motivation', 'success'], topic: 'Life skills', title: 'Goals and motivation',
    answer: 'A useful goal describes a meaningful outcome and a way to measure progress. Convert it into repeatable actions, choose a realistic schedule, expect setbacks, and adjust the plan without treating one missed day as failure.',
    cards: [['What makes a goal measurable?', 'It has a clear indicator of progress or completion.'], ['How should setbacks be handled?', 'Review what happened, adjust the plan, and continue.']],
    questions: [{ question: 'What should a good goal include?', options: ['A clear way to measure progress', 'Only a vague wish', 'No time or action', 'An impossible standard'], answer: 0, explanation: 'Measurement makes progress visible and helps guide the next action.' }]
  },
  {
    terms: ['communication', 'conversation', 'listening', 'public speaking'], topic: 'Life skills', title: 'Communication',
    answer: 'Good communication is a two-way process. Listen to understand, ask clarifying questions, state ideas clearly, consider the other person\'s perspective, and check what was understood. In conflict, describe the issue and its impact instead of attacking the person.',
    cards: [['What is active listening?', 'Giving attention, checking understanding, and responding to what was said.'], ['How can conflict be discussed safely?', 'Focus on the issue, impact, needs, and possible next steps.']],
    questions: [{ question: 'Which behavior supports active listening?', options: ['Checking your understanding', 'Interrupting immediately', 'Assuming motives', 'Planning a reply without listening'], answer: 0, explanation: 'Checking understanding reduces confusion and shows attention.' }]
  },
  {
    terms: ['relationships', 'friendship', 'boundaries', 'respect'], topic: 'Life skills', title: 'Healthy relationships',
    answer: 'Healthy relationships are built on respect, honesty, consent, communication, trust, and room for each person\'s boundaries. A boundary communicates what you are comfortable with and what you will do to protect your well-being; it is not a tool for controlling another person.',
    cards: [['What is a boundary?', 'A clear limit that protects a person\'s comfort, time, safety, or values.'], ['What supports trust?', 'Consistent respectful actions and honest communication.']],
    questions: [{ question: 'What is the purpose of a personal boundary?', options: ['To communicate and protect a limit', 'To control every choice another person makes', 'To avoid all communication', 'To win every disagreement'], answer: 0, explanation: 'Boundaries explain limits and support respectful interaction.' }]
  },
  {
    terms: ['money', 'budget', 'saving', 'finance', 'financial literacy'], topic: 'Life skills', title: 'Personal finance',
    answer: 'Financial literacy includes tracking income and spending, distinguishing needs from wants, planning a buffer, comparing costs, understanding interest, protecting personal information, and making decisions based on reliable terms rather than pressure.',
    cards: [['What is a budget?', 'A plan for how money will be used over a period of time.'], ['Why keep an emergency buffer?', 'To handle unexpected costs without immediately relying on harmful debt.']],
    questions: [{ question: 'What is the purpose of a budget?', options: ['To plan and track money', 'To make spending invisible', 'To guarantee instant wealth', 'To ignore future costs'], answer: 0, explanation: 'A budget gives income and spending a visible plan.' }]
  },
  {
    terms: ['career', 'job', 'work', 'resume', 'interview'], topic: 'Life skills', title: 'Career development',
    answer: 'Career development is an ongoing process of learning skills, understanding your interests, building evidence through projects or experience, communicating your value, and making informed choices. A resume should show relevant actions and results rather than only list traits.',
    cards: [['What should a strong resume show?', 'Relevant actions, skills, and results supported by evidence.'], ['Why build projects?', 'Projects demonstrate what you can apply, not just what you can name.']],
    questions: [{ question: 'What makes a resume statement stronger?', options: ['A specific action and result', 'Only a vague adjective', 'An unrelated story', 'A promise with no evidence'], answer: 0, explanation: 'Specific evidence helps another person understand your contribution.' }]
  },
  {
    terms: ['decision making', 'decisions', 'problem solving', 'critical thinking'], topic: 'Life skills', title: 'Decision-making',
    answer: 'Good decision-making defines the problem, separates facts from assumptions, identifies options, considers consequences and values, checks risks, chooses a next step, and learns from the result. Not every decision needs perfect certainty.',
    cards: [['What should be separated during a decision?', 'Evidence, assumptions, options, and consequences.'], ['What happens after a decision?', 'Observe the result and update your approach when needed.']],
    questions: [{ question: 'Which is a useful decision-making step?', options: ['Compare options and consequences', 'Treat every assumption as a fact', 'Refuse to define the problem', 'Ignore new evidence'], answer: 0, explanation: 'Comparing consequences makes the choice more deliberate.' }]
  },
  {
    terms: ['emotions', 'stress', 'resilience', 'mental health', 'wellbeing'], topic: 'Life skills', title: 'Emotional well-being',
    answer: 'Emotional well-being includes noticing feelings, naming what may be affecting them, using healthy coping strategies, connecting with trusted people, and seeking qualified professional support when distress is intense, persistent, or unsafe. Education can help, but it is not a substitute for care.',
    cards: [['What is a healthy coping strategy?', 'A safe action such as breathing, movement, rest, writing, or talking to support.'], ['When should professional support be considered?', 'When distress is persistent, intense, or affecting safety and daily life.']],
    questions: [{ question: 'Which response can support emotional well-being?', options: ['Talk with a trusted support person', 'Hide every feeling forever', 'Stop sleeping', 'Make major choices while overwhelmed'], answer: 0, explanation: 'Support and connection can make difficult feelings easier to understand and manage.' }]
  },
  {
    terms: ['digital literacy', 'internet safety', 'online safety', 'privacy', 'cybersecurity'], topic: 'Life skills', title: 'Digital literacy and safety',
    answer: 'Digital literacy means finding, evaluating, creating, and communicating information with technology. Protect accounts with unique passwords and multi-factor authentication, question surprising claims, check sources, limit unnecessary personal data, and pause before opening links or sharing content.',
    cards: [['What is a reliable online habit?', 'Check the source, evidence, date, and purpose before trusting a claim.'], ['Why use multi-factor authentication?', 'It adds another verification step if a password is exposed.']],
    questions: [{ question: 'What should you do with a surprising online claim?', options: ['Check its source and evidence', 'Share it immediately', 'Trust the headline alone', 'Remove all context'], answer: 0, explanation: 'Source and evidence checks reduce the chance of spreading false information.' }]
  },
  {
    terms: ['cooking', 'food safety', 'household', 'home skills'], topic: 'Life skills', title: 'Everyday home skills',
    answer: 'Everyday independence includes planning simple meals, keeping work areas clean, reading instructions, storing food safely, doing basic laundry, organizing documents, and asking for help with tasks that involve serious risk or specialist knowledge.',
    cards: [['Why read food labels and instructions?', 'To understand ingredients, use, storage, and safety information.'], ['What is a good rule for unfamiliar risky equipment?', 'Read the instructions and get qualified help before using it.']],
    questions: [{ question: 'What is a safe approach to unfamiliar equipment?', options: ['Read instructions and seek qualified help', 'Guess while it is running', 'Ignore warnings', 'Remove safety features'], answer: 0, explanation: 'Instructions and qualified help reduce preventable injury and damage.' }]
  },
  {
    terms: ['first aid', 'emergency', 'safety', 'injury'], topic: 'Life skills', title: 'Safety and first response',
    answer: 'Safety starts with preventing hazards and knowing when to contact local emergency services. In a serious emergency, protect yourself, call for professional help, follow dispatcher instructions, and do not attempt care beyond your training. First-aid learning should come from qualified local organizations.',
    cards: [['What is the first priority in an emergency?', 'Make sure the scene is safe and contact professional help.'], ['Where should first-aid skills be learned?', 'From qualified training and trusted local health organizations.']],
    questions: [{ question: 'What should happen first at a dangerous emergency scene?', options: ['Check safety and call professional help', 'Rush in without checking hazards', 'Post it online', 'Move every person immediately'], answer: 0, explanation: 'Your safety and rapid professional assistance come first.' }]
  }
];

function normalizeText(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function findEducationEntries(text) {
  const normalized = normalizeText(text);
  const words = new Set(normalized.split(' '));
  return EDUCATION_DATA.map(entry => {
    const score = entry.terms.reduce((total, term) => {
      const normalizedTerm = normalizeText(term);
      if (normalized.includes(normalizedTerm)) return total + (normalizedTerm.includes(' ') ? 3 : 2);
      if (normalizedTerm.endsWith('s') && words.has(normalizedTerm.slice(0, -1))) return total + 1;
      return total;
    }, 0);
    return { entry, score };
  }).filter(match => match.score > 0).sort((left, right) => right.score - left.score).slice(0, 3).map(match => match.entry);
}

function findStoredQuestion(text) {
  const normalized = normalizeText(text);
  const stopWords = new Set(['what', 'which', 'where', 'when', 'why', 'how', 'does', 'do', 'the', 'a', 'an', 'is', 'are', 'to', 'of', 'in', 'for', 'on', 'and']);
  let bestMatch = null;
  let bestScore = 0;
  EDUCATION_DATA.forEach(entry => {
    entry.questions.forEach(question => {
      const questionText = normalizeText(question.question);
      const questionWords = questionText.split(' ').filter(word => !stopWords.has(word) && (word.length > 2 || /^\d+$/.test(word) || word === 'x'));
      const matches = questionWords.filter(word => normalized.split(' ').includes(word));
      const score = questionWords.length ? matches.length / questionWords.length : 0;
      const exactMatch = normalized.includes(questionText);
      if ((exactMatch || (questionWords.length >= 2 && score >= 0.75)) && score > bestScore) {
        bestScore = score;
        bestMatch = { entry, question };
      }
    });
  });
  return bestMatch;
}

function isEducationalRequest(text) {
  return findEducationEntries(text).length > 0 || /learn|study|explain|what|why|how|quiz|flashcard|math|science|history|biology|chemistry|physics|essay|grammar|equation|formula|topic|school|education|life|skill|goal|money|career|job|relationship|communication|stress|budget|decision|problem|safety|home|work/i.test(text);
}

function localAnswer(prompt) {
  const entries = findEducationEntries(prompt);
  const name = currentUser?.name || 'student';
  if (!isEducationalRequest(prompt)) return `I am AuraStudy, an education and life-skills assistant. I can help ${name} with school subjects, explanations, study plans, practical skills, decisions, quizzes, and flashcards. Please ask about learning or a constructive life skill.`;
  const storedQuestion = findStoredQuestion(prompt);
  if (storedQuestion) {
    const { entry, question } = storedQuestion;
    return `Hi ${name}. The correct answer is: ${question.options[question.answer]}\n\nExplanation: ${question.explanation} (${entry.topic})`;
  }
  if (entries.length) return buildTeachingResponse(prompt, entries, name);
  return buildGeneralGuidance(prompt, name);
}

function buildTeachingResponse(prompt, entries, name) {
  const normalized = prompt.toLowerCase();
  const isActionRequest = /how|steps|plan|start|practice|improve|learn|study/.test(normalized);
  const isComparison = /compare|difference|versus| vs /.test(normalized);
  const heading = isComparison ? 'Here is the key comparison' : isActionRequest ? 'Here is a practical way to work with it' : 'Here is the core idea';
  const details = entries.map(entry => {
    const cards = entry.cards.slice(0, 2).map(([question, answer]) => `- ${question} ${answer}`).join('\n');
    const action = isActionRequest ? `\nTry this: ${entry.cards[0]?.[1] || 'Write the idea in your own words, then practise recalling it later.'}` : '';
    return `${entry.title} (${entry.topic})\n${entry.answer}${action}\nKey checks:\n${cards}`;
  }).join('\n\n');
  return `Hi ${name}. ${heading}.\n\n${details}`;
}

function buildGeneralGuidance(prompt, name) {
  const normalized = prompt.toLowerCase();
  if (/plan|start|organize|manage/.test(normalized)) {
    return `Hi ${name}. Start with this simple plan:\n1. Define the result you want.\n2. Break it into one small next action.\n3. Set a realistic time, do the action, and review what worked.\n\nFor a more specific answer, include the subject, goal, or situation.`;
  }
  if (/why|explain|what|how|learn|study/.test(normalized)) {
    return `Hi ${name}. I can explain this, but I need a little more focus because my offline lessons are organized by topic. Add the subject and the exact idea you want to understand, such as “explain supply and demand” or “how do I study for biology?”`;
  }
  return `Hi ${name}. I can help with school subjects, study methods, practical life skills, decisions, and constructive personal development. Tell me the topic and whether you want an explanation, example, comparison, plan, or quiz.`;
}

function localQuiz(prompt) {
  const entries = findEducationEntries(prompt);
  const source = entries.length ? entries : EDUCATION_DATA;
  const levelMatch = prompt.match(/difficulty level:\s*(beginner|intermediate|advanced)/i);
  const level = levelMatch ? levelMatch[1].toLowerCase() : 'beginner';
  const questions = source.flatMap(entry => entry.questions.map((question, index) => ({ entry, question, index })));
  const selected = questions.slice(0, 3).map(({ entry, question }) => {
    if (level === 'beginner') return { ...question, difficulty: level };
    const advancedPrompt = level === 'advanced'
      ? `Which statement most accurately applies the main idea of ${entry.title}?`
      : `Which explanation best describes ${entry.title}?`;
    return {
      question: advancedPrompt,
      options: [entry.answer, 'It is unrelated to the topic and has no measurable effect.', 'It only applies in a fictional or imaginary situation.', 'It is a definition that contradicts the study evidence.'],
      answer: 0,
      explanation: `${entry.answer} This is the most complete explanation for the ${level} level question.`,
      difficulty: level
    };
  });
  return JSON.stringify(selected);
}

function localFlashcards(prompt) {
  const entries = findEducationEntries(prompt);
  const source = entries.length ? entries : EDUCATION_DATA;
  const cards = source.flatMap(entry => entry.cards).slice(0, 5);
  return JSON.stringify(cards.map(([question, answer]) => ({ question, answer })));
}

async function callAI(prompt) {
  const normalized = prompt.toLowerCase();
  if (normalized.includes('multiple choice quiz')) return localQuiz(prompt);
  if (normalized.includes('flashcards')) return localFlashcards(prompt);
  return localAnswer(prompt);
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
    const level = question.difficulty ? question.difficulty[0].toUpperCase() + question.difficulty.slice(1) : 'Study';
    const levelBadge = document.createElement('span');
    levelBadge.className = 'inline-flex px-2 py-1 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-semibold uppercase';
    levelBadge.textContent = `${level} level`;
    card.appendChild(levelBadge);
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
        explanation.textContent = `Explanation: ${question.explanation || (isCorrect ? 'Correct.' : 'Review this concept and try again later.')}`;
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
  const level = document.getElementById('quiz-level').value;
  const container = document.getElementById('quiz-container');
  container.innerHTML = '<p class="text-sm text-slate-500">Generating quiz...</p>';

  const prompt = `Create a 3-question multiple choice quiz about ${topic}. Difficulty level: ${level}. Return only valid JSON as an array. Each item must have this exact shape: {"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}. The answer is the zero-based option index.`;
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