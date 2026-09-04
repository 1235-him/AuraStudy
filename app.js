// LocalStorage keys
const USER_KEY = 'aurastudy_user';
const TASKS_KEY = 'aurastudy_tasks';
const CHAT_KEY = 'aurastudy_chat';

// State
let currentUser = null;
let tasks = [];
let chats = [];
let timerInterval = null;
let timerSeconds = 25 * 60;
let isTimerRunning = false;

// DOM Elements
const authModal = document.getElementById('auth-modal');
const appContainer = document.getElementById('app');
const authForm = document.getElementById('auth-form');
const themeToggle = document.getElementById('theme-toggle');

// Initialize
function init() {
  currentUser = JSON.parse(localStorage.getItem(USER_KEY));
  if (!currentUser) {
    authModal.classList.remove('hidden');
    appContainer.classList.add('hidden');
  } else {
    authModal.classList.add('hidden');
    appContainer.classList.remove('hidden');
    document.getElementById('display-user').textContent = currentUser.name;
    document.getElementById('dash-user').textContent = currentUser.name;
    loadData();
    renderTasks();
    renderChats();
  }
}

// Onboarding
authForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('user-name-input').value;
  const apiKey = document.getElementById('api-key-input').value;
  currentUser = { name, apiKey, minutesStudied: 0 };
  localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  init();
});

document.getElementById('reset-btn').addEventListener('click', () => {
  localStorage.clear();
  location.reload();
});

// Theme Switcher
themeToggle.addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
});

// Navigation Engine
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
  });
});

// Data Management
function loadData() {
  tasks = JSON.parse(localStorage.getItem(TASKS_KEY)) || [];
  chats = JSON.parse(localStorage.getItem(CHAT_KEY)) || [];
  updateDashboardStats();
}

function updateDashboardStats() {
  const completed = tasks.filter(t => t.done).length;
  document.getElementById('completed-count-display').textContent = `${completed}/${tasks.length}`;
  document.getElementById('total-time-display').textContent = `${currentUser.minutesStudied || 0}m`;
}

// Tasks / Schedule Logic
document.getElementById('add-task-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('task-title');
  tasks.push({ id: Date.now(), title: input.value, done: false });
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  input.value = '';
  renderTasks();
  updateDashboardStats();
});

function renderTasks() {
  const list = document.getElementById('planner-tasks-list');
  list.innerHTML = '';
  tasks.forEach(t => {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800';
    item.innerHTML = `
      <div class="flex items-center gap-3">
        <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask(${t.id})" class="rounded border-slate-300 text-brand-600 focus:ring-brand-500">
        <span class="${t.done ? 'line-through text-slate-400' : ''} text-sm font-medium">${t.title}</span>
      </div>
      <button onclick="deleteTask(${t.id})" class="text-xs text-red-500">Delete</button>
    `;
    list.appendChild(item);
  });
}

window.toggleTask = (id) => {
  tasks = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  renderTasks();
  updateDashboardStats();
};

window.deleteTask = (id) => {
  tasks = tasks.filter(t => t.id !== id);
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
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
        currentUser.minutesStudied = (currentUser.minutesStudied || 0) + 25;
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
        updateDashboardStats();
        alert('Session finished! 25 minutes logged.');
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
});

// AI Assistant & Tools Integration
async function callAI(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${currentUser.apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";
}

document.getElementById('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const userText = input.value;
  input.value = '';

  chats.push({ role: 'user', text: userText });
  renderChats();

  const aiReply = await callAI(userText);
  chats.push({ role: 'ai', text: aiReply });
  localStorage.setItem(CHAT_KEY, JSON.stringify(chats));
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

// AI Tools Preset Trigger
document.querySelectorAll('.tool-card').forEach(card => {
  card.addEventListener('click', () => {
    const presetPrompt = card.dataset.prompt;
    document.querySelector('[data-view="assistant"]').click();
    document.getElementById('chat-input').value = presetPrompt;
  });
});

// Quiz Generator Feature
document.getElementById('quiz-gen-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const topic = document.getElementById('quiz-topic').value;
  const container = document.getElementById('quiz-container');
  container.innerHTML = '<p class="text-sm text-slate-500">Generating questions...</p>';

  const prompt = `Create a 3-question multiple choice quiz on the topic: ${topic}. Format output clearly as Question, Options (A, B, C, D), and Answer key.`;
  const quizText = await callAI(prompt);

  container.innerHTML = `<div class="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm whitespace-pre-line leading-relaxed">${quizText}</div>`;
});

// Run Init
init();