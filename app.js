/**
 * LancerLink Full-Stack Frontend Engine
 * Real Server-Backed State & Security Integration
 */

// Global Frontend State
let currentUser = null;
let csrfToken = "";
let chatPollInterval = null;
let globalPollInterval = null;

let activeChatProjectId = null;
let activeChatFreelancerId = null;
let activeChatLastId = 0;
let isChatPollerActive = false;

let selectedReviewRating = 0;

// ========================================================
// INITIALIZATION ENGINE
// ========================================================
document.addEventListener("DOMContentLoaded", () => {
  checkExistingSession();
});

// Session Check on Application Startup
async function checkExistingSession() {
  try {
    const res = await apiRequest("/api/auth/me");
    if (res.success) {
      currentUser = res.data.user;
      csrfToken = res.data.csrf_token;
      loginUser(currentUser, currentUser.role);
    } else {
      logoutSessionCleanup();
    }
  } catch (err) {
    logoutSessionCleanup();
  }
}

// Clean up local session state and timers
function logoutSessionCleanup() {
  currentUser = null;
  csrfToken = "";
  
  if (chatPollInterval) {
    clearInterval(chatPollInterval);
    chatPollInterval = null;
  }
  if (globalPollInterval) {
    clearInterval(globalPollInterval);
    globalPollInterval = null;
  }
  isChatPollerActive = false;
  
  showView("welcome-section");
}

// ========================================================
// REUSABLE API REQUEST HELPER
// ========================================================
async function apiRequest(url, options = {}) {
  options.credentials = "same-origin";
  
  if (!options.headers) {
    options.headers = {};
  }
  
  if (options.body && typeof options.body === "object") {
    options.body = JSON.stringify(options.body);
    options.headers["Content-Type"] = "application/json";
  }
  
  if (csrfToken) {
    options.headers["X-CSRF-Token"] = csrfToken;
  }
  
  try {
    const response = await fetch(url, options);
    
    if (response.status === 401) {
      logoutSessionCleanup();
      showToast("Session expired. Please sign in again.", "error");
      throw new Error("Session expired");
    }
    
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error || `HTTP error! Status: ${response.status}`);
    }
    
    return json;
  } catch (err) {
    console.error(`API Error [${url}]:`, err);
    if (err.message !== "Session expired") {
      showToast(err.message || "Network request failed", "error");
    }
    throw err;
  }
}

// Escaping helper for user-generated content injection prevention
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ========================================================
// TOAST NOTIFICATION SERVICE
// ========================================================
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast glass-card flex items-center gap-3 px-5 py-4 rounded-2xl border custom-shadow max-w-sm w-full`;
  
  let icon = '<i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-600"></i>';
  let border = "border-emerald-200/60 bg-emerald-50/90";
  
  if (type === "error") {
    icon = '<i data-lucide="alert-triangle" class="w-5 h-5 text-red-500"></i>';
    border = "border-red-200/60 bg-red-50/90";
  } else if (type === "info") {
    icon = '<i data-lucide="info" class="w-5 h-5 text-blue-500"></i>';
    border = "border-blue-200/60 bg-blue-50/90";
  }

  toast.innerHTML = `
    <div class="flex-shrink-0">${icon}</div>
    <div class="flex-grow">
      <p class="text-sm font-semibold text-slate-900">${message}</p>
    </div>
    <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 transition-colors">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;

  toast.classList.add(...border.split(" "));
  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.classList.add("hide");
    toast.addEventListener("animationend", () => {
      toast.remove();
    });
  }, 4000);
}

// ========================================================
// VIEW TRANSITIONS & SPA ROUTER
// ========================================================
function showView(viewId) {
  const views = ["welcome-section", "client-dashboard-section", "freelancer-dashboard-section"];
  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) {
      if (v === viewId) {
        el.classList.remove("hidden");
        el.classList.add("flex");
      } else {
        el.classList.remove("flex");
        el.classList.add("hidden");
      }
    }
  });
  lucide.createIcons();
}

function switchTab(role, tabName) {
  const contents = document.querySelectorAll(`#${role}-dashboard-section .tab-content`);
  contents.forEach(c => {
    c.classList.remove("active");
  });

  const buttons = document.querySelectorAll(`#${role}-dashboard-section nav button`);
  buttons.forEach(b => {
    b.className = "w-full px-4 py-3 rounded-2xl text-left font-semibold text-sm flex items-center gap-3 transition-all duration-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800";
  });

  const targetContent = document.getElementById(`${role}-tab-${tabName}`);
  if (targetContent) {
    targetContent.classList.add("active");
  }

  const targetBtn = document.getElementById(`${role}-tab-${tabName}-btn`);
  if (targetBtn) {
    targetBtn.className = "w-full px-4 py-3 rounded-2xl text-left font-semibold text-sm flex items-center gap-3 transition-all duration-200 bg-brand-50 text-brand-700 shadow-sm border border-brand-100/40";
  }

  // Save tab selection preference
  localStorage.setItem(`lancerlink_last_tab_${role}`, tabName);

  lucide.createIcons();
  
  if (role === "client" && tabName === "my-projects") {
    renderClientProjects();
  } else if (role === "client" && tabName === "wallet-portal") {
    refreshWalletAndTransactions("client");
  } else if (role === "freelancer" && tabName === "find-work") {
    renderLiveProjectFeed();
  } else if (role === "freelancer" && tabName === "workspace") {
    renderFreelancerWorkspace();
  } else if (role === "freelancer" && tabName === "earnings") {
    refreshWalletAndTransactions("freelancer");
  }
}

// ========================================================
// AUTHENTICATION CONTROLLERS
// ========================================================
let currentAuthRole = "client";
let currentAuthTab = "signup";

function openAuthModal(role) {
  currentAuthRole = role;
  currentAuthTab = "signup";
  
  const modal = document.getElementById("auth-modal");
  const modalTitle = document.getElementById("auth-modal-title");
  const roleBadge = document.getElementById("auth-role-badge");
  
  if (role === "client") {
    roleBadge.textContent = "CLIENT PORTAL";
    roleBadge.className = "inline-flex px-2.5 py-1 rounded-xl text-[9px] font-extrabold uppercase bg-brand-600 text-white mb-2 shadow-sm shadow-brand-600/10";
    modalTitle.textContent = "Hire Expert Developers";
  } else {
    roleBadge.textContent = "FREELANCER PORTAL";
    roleBadge.className = "inline-flex px-2.5 py-1 rounded-xl text-[9px] font-extrabold uppercase bg-slate-900 text-white mb-2 shadow-sm shadow-slate-900/10";
    modalTitle.textContent = "Find Elite Projects";
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  toggleAuthTab("signup");
}

function closeAuthModal() {
  const modal = document.getElementById("auth-modal");
  modal.classList.remove("flex");
  modal.classList.add("hidden");
  document.getElementById("auth-form").reset();
}

function toggleAuthTab(tab) {
  currentAuthTab = tab;
  
  const signupTabBtn = document.getElementById("auth-tab-signup");
  const loginTabBtn = document.getElementById("auth-tab-login");
  const nameField = document.getElementById("auth-field-name");
  const nameInput = document.getElementById("auth-name");
  const submitBtn = document.getElementById("auth-submit-btn");

  if (tab === "signup") {
    signupTabBtn.className = "flex-1 py-3 text-center text-sm font-bold border-b-2 border-brand-600 text-brand-600 transition-all";
    loginTabBtn.className = "flex-1 py-3 text-center text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-700 transition-all";
    nameField.classList.remove("hidden");
    nameInput.required = true;
    submitBtn.textContent = currentAuthRole === "client" ? "Create Client Account" : "Join as Freelancer";
  } else {
    signupTabBtn.className = "flex-1 py-3 text-center text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-700 transition-all";
    loginTabBtn.className = "flex-1 py-3 text-center text-sm font-bold border-b-2 border-brand-600 text-brand-600 transition-all";
    nameField.classList.add("hidden");
    nameInput.required = false;
    submitBtn.textContent = "Sign In & Enter Dashboard";
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  
  const emailInput = document.getElementById("auth-email").value.trim().toLowerCase();
  const passwordInput = document.getElementById("auth-password").value;
  const nameInput = document.getElementById("auth-name").value.trim();
  
  const url = currentAuthTab === "signup" ? "/api/auth/register" : "/api/auth/login";
  const payload = {
    email: emailInput,
    password: passwordInput,
    role: currentAuthRole
  };
  
  if (currentAuthTab === "signup") {
    payload.name = nameInput || "Ledger Entity";
  }

  try {
    const res = await apiRequest(url, {
      method: "POST",
      body: payload
    });

    if (res.success) {
      currentUser = res.data.user;
      csrfToken = res.data.csrf_token;
      showToast(currentAuthTab === "signup" ? "Account registered successfully!" : `Welcome back, ${currentUser.name}!`, "success");
      loginUser(currentUser, currentAuthRole);
      closeAuthModal();
    }
  } catch (err) {
    // Errors handled by apiRequest toast
  }
}

function loginUser(user, role) {
  // Start Global Polling for Notifications and Conversations list every 15 seconds
  if (globalPollInterval) clearInterval(globalPollInterval);
  globalPollInterval = setInterval(pollGlobalUpdates, 15000);
  pollGlobalUpdates(); // initial run

  const savedTab = localStorage.getItem(`lancerlink_last_tab_${role}`);

  if (role === "client") {
    document.getElementById("client-username-display").textContent = user.name;
    updateClientWalletPills(user.wallet_cents);
    showView("client-dashboard-section");
    switchTab("client", savedTab || "my-projects");
  } else {
    document.getElementById("freelancer-username-display").textContent = user.name;
    updateFreelancerWalletPills(user.wallet_cents);
    showView("freelancer-dashboard-section");
    switchTab("freelancer", savedTab || "find-work");
  }
}

async function logout() {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
  } catch (err) {}
  logoutSessionCleanup();
  showToast("Logged out successfully.", "info");
}

// ========================================================
// WALLET MANAGEMENT
// ========================================================
function updateClientWalletPills(walletCents) {
  const usd = (walletCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const display = document.getElementById("client-wallet-display");
  const portalDisplay = document.getElementById("wallet-portal-client-balance");
  
  if (display) display.textContent = `$${usd}`;
  if (portalDisplay) portalDisplay.textContent = `$${usd}`;
}

function updateFreelancerWalletPills(walletCents) {
  const usd = (walletCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const display = document.getElementById("freelancer-wallet-display");
  const portalDisplay = document.getElementById("wallet-portal-freelancer-balance");
  
  if (display) display.textContent = `$${usd}`;
  if (portalDisplay) portalDisplay.textContent = `$${usd}`;
}

async function refreshWalletAndTransactions(role) {
  try {
    const res = await apiRequest("/api/wallet/transactions");
    const profileRes = await apiRequest("/api/auth/me");
    
    if (profileRes.success) {
      currentUser = profileRes.data.user;
      if (role === "client") {
        updateClientWalletPills(currentUser.wallet_cents);
        updateClientEscrowStats();
      } else {
        updateFreelancerWalletPills(currentUser.wallet_cents);
        updateFreelancerEscrowStats();
      }
    }

    if (res.success) {
      renderTransactionsList(role, res.data.transactions);
    }
  } catch (err) {}
}

async function updateClientEscrowStats() {
  try {
    const res = await apiRequest(`/api/projects?client_id=${currentUser.id}`);
    if (res.success) {
      let lockedFundsCents = 0;
      res.data.projects.forEach(p => {
        if (p.status === "hired" || p.status === "submitted" || p.status === "revision_requested") {
          lockedFundsCents += p.escrow_cents;
        }
      });

      const usd = (lockedFundsCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const lockedDisplay = document.getElementById("client-locked-funds-display");
      const lockedBar = document.getElementById("client-locked-funds-bar");

      if (lockedDisplay) lockedDisplay.textContent = `$${usd}`;
      if (lockedBar) {
        const totalCents = currentUser.wallet_cents + lockedFundsCents;
        const pct = totalCents > 0 ? (lockedFundsCents / totalCents) * 100 : 0;
        lockedBar.style.width = `${pct}%`;
      }
    }
  } catch (err) {}
}

async function updateFreelancerEscrowStats() {
  try {
    const res = await apiRequest(`/api/projects?hired_freelancer_id=${currentUser.id}`);
    if (res.success) {
      let pendingEscrowCents = 0;
      res.data.projects.forEach(p => {
        if (p.status === "hired" || p.status === "submitted" || p.status === "revision_requested") {
          pendingEscrowCents += p.escrow_cents;
        }
      });

      const usd = (pendingEscrowCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const display = document.getElementById("freelancer-locked-funds-display");
      const bar = document.getElementById("freelancer-locked-funds-bar");

      if (display) display.textContent = `$${usd}`;
      if (bar) {
        const totalCents = currentUser.wallet_cents + pendingEscrowCents;
        const pct = totalCents > 0 ? (pendingEscrowCents / totalCents) * 100 : 0;
        bar.style.width = `${pct}%`;
      }
    }
  } catch (err) {}
}

async function handleDeposit(event) {
  event.preventDefault();
  const amtInput = document.getElementById("deposit-amount");
  const depositVal = parseFloat(amtInput.value);

  if (isNaN(depositVal) || depositVal <= 0) {
    showToast("Please enter a valid deposit amount.", "error");
    return;
  }

  try {
    const res = await apiRequest("/api/wallet/deposit", {
      method: "POST",
      body: { amount: depositVal }
    });

    if (res.success) {
      currentUser.wallet_cents = res.data.wallet_cents;
      updateClientWalletPills(currentUser.wallet_cents);
      showToast(`Instantly deposited $${depositVal.toLocaleString()} into your virtual wallet!`, "success");
      amtInput.value = "";
      refreshWalletAndTransactions("client");
    }
  } catch (err) {}
}

function setQuickDeposit(amount) {
  document.getElementById("deposit-amount").value = amount;
}

function openDepositModal() {
  switchTab("client", "wallet-portal");
}

async function handleWithdraw(event) {
  event.preventDefault();
  const amtInput = document.getElementById("withdraw-amount");
  const routeSelect = document.getElementById("withdraw-bank");
  const amountVal = parseFloat(amtInput.value);

  if (isNaN(amountVal) || amountVal <= 0) {
    showToast("Please enter a valid withdrawal amount.", "error");
    return;
  }

  try {
    const res = await apiRequest("/api/wallet/withdraw", {
      method: "POST",
      body: {
        amount: amountVal,
        bank_route: routeSelect.value
      }
    });

    if (res.success) {
      currentUser.wallet_cents = res.data.wallet_cents;
      updateFreelancerWalletPills(currentUser.wallet_cents);
      showToast(`Simulated withdrawal of $${amountVal.toLocaleString()} completed successfully.`, "success");
      amtInput.value = "";
      refreshWalletAndTransactions("freelancer");
    }
  } catch (err) {}
}

function renderTransactionsList(role, txs) {
  const container = document.getElementById(`${role}-transactions-list`);
  if (!container) return;

  if (txs.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 font-semibold">No transactions found in sandbox ledger.</div>`;
    return;
  }

  let html = "";
  txs.forEach(t => {
    const amountUsd = t.amount_cents / 100;
    const absVal = Math.abs(amountUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const isOutflow = t.amount_cents < 0;
    const sign = isOutflow ? "-" : "+";
    const color = isOutflow ? "text-slate-600 font-semibold" : "text-emerald-600 font-bold";
    const dateStr = new Date(t.created_at).toLocaleString();
    
    // Project reference title if exists
    const projectRef = t.project_title ? ` &bull; Ref: <span class="font-bold text-slate-700">${escapeHtml(t.project_title)}</span>` : "";

    html += `
      <div class="transaction-row">
        <div>
          <span class="text-xs uppercase font-extrabold tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded mr-2">${t.transaction_type}</span>
          <span class="text-slate-500 font-medium">${escapeHtml(t.description)}${projectRef}</span>
          <p class="text-[10px] text-slate-400 font-semibold mt-1">${dateStr}</p>
        </div>
        <div class="text-right">
          <span class="${color}">${sign}$${absVal}</span>
          <p class="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Bal: $${(t.balance_after_cents / 100).toLocaleString()}</p>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ========================================================
// CLIENT WORKSPACE & PROJECTS LOGIC
// ========================================================
async function handlePostProject(event) {
  event.preventDefault();

  const title = document.getElementById("post-title").value.trim();
  const category = document.getElementById("post-category").value;
  const budget = parseFloat(document.getElementById("post-budget").value);
  const description = document.getElementById("post-description").value.trim();

  if (!title || !category || isNaN(budget) || budget <= 0 || !description) {
    showToast("Please fill out all contract fields properly.", "error");
    return;
  }

  try {
    const res = await apiRequest("/api/projects", {
      method: "POST",
      body: { title, category, budget, description }
    });

    if (res.success) {
      showToast("New marketplace contract published successfully!", "success");
      document.getElementById("post-project-form").reset();
      switchTab("client", "my-projects");
    }
  } catch (err) {}
}

function renderProjectMilestones(p) {
  if (!p.milestone || p.milestone < 1) {
    return "";
  }
  
  const steps = [
    { num: 1, label: "Hired & Escrow" },
    { num: 2, label: "Work Submitted" },
    { num: 3, label: "Payment Released" },
    { num: 4, label: "Mutual Feedback" }
  ];
  
  let progressWidth = "0%";
  if (p.milestone === 2) progressWidth = "33%";
  else if (p.milestone === 3) progressWidth = "66%";
  else if (p.milestone >= 4) progressWidth = "100%";
  
  let stepsHtml = "";
  steps.forEach(s => {
    let stateClass = "milestone-future";
    let icon = s.num;
    if (s.num < p.milestone) {
      stateClass = "milestone-complete";
      icon = '<i data-lucide="check" class="w-3.5 h-3.5"></i>';
    } else if (s.num === p.milestone) {
      stateClass = "milestone-current";
    }
    
    stepsHtml += `
      <div class="milestone-step ${stateClass}">
        <div class="milestone-circle">${icon}</div>
        <div class="milestone-label">${s.label}</div>
      </div>
    `;
  });
  
  return `
    <div class="milestone-tracker">
      <div class="milestone-line"></div>
      <div class="milestone-line-progress" style="width: ${progressWidth}"></div>
      ${stepsHtml}
    </div>
  `;
}

async function renderClientProjects() {
  const container = document.getElementById("client-projects-container");
  if (!container) return;

  try {
    const res = await apiRequest(`/api/projects?client_id=${currentUser.id}`);
    if (!res.success) return;

    const myProjects = res.data.projects;

    // Mini Stats Bar Counters
    document.getElementById("stat-client-open").textContent = myProjects.filter(p => p.status === "open").length;
    document.getElementById("stat-client-hired").textContent = myProjects.filter(p => p.status === "hired").length;
    document.getElementById("stat-client-review").textContent = myProjects.filter(p => p.status === "submitted" || p.status === "revision_requested").length;
    document.getElementById("stat-client-completed").textContent = myProjects.filter(p => p.status === "completed").length;

    if (myProjects.length === 0) {
      container.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-3xl p-12 text-center custom-shadow">
          <div class="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4">
            <i data-lucide="folder-open" class="w-8 h-8"></i>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-1">No Projects Found</h3>
          <p class="text-sm text-slate-400 max-w-sm mx-auto mb-6">Create a contract proposal and submit it to our network of freelancers.</p>
          <button onclick="switchTab('client', 'post-project')" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-all shadow-sm">
            Create First Contract
          </button>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    // Sort status weights
    const statusWeight = { "submitted": 1, "revision_requested": 1, "open": 2, "hired": 3, "completed": 4, "cancelled": 5 };
    myProjects.sort((a, b) => {
      if (statusWeight[a.status] !== statusWeight[b.status]) {
        return statusWeight[a.status] - statusWeight[b.status];
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

    let html = "";

    for (let p of myProjects) {
      let statusBadge = "";
      let borderStyle = "border-slate-200";
      let footerHtml = "";

      // Render 4-Stage Lifecycle Tracker HTML ( backend authoritative )
      const milestonesTrackerHtml = renderProjectMilestones(p);

      if (p.status === "open") {
        statusBadge = `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 border border-blue-200 text-blue-600"><i data-lucide="search" class="w-3.5 h-3.5"></i> Open Bidding</span>`;
        
        // Fetch Bids from server
        const bidsRes = await apiRequest(`/api/projects/${p.id}/bids`);
        const projBids = bidsRes.success ? bidsRes.data.bids : [];

        // Edit/Cancel action controls
        const controlsHtml = `
          <div class="flex gap-2">
            <button onclick="openEditProjectModal('${p.id}')" class="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-brand-500 hover:bg-brand-50 text-slate-600 hover:text-brand-600 font-bold text-xs transition-all flex items-center gap-1">
              <i data-lucide="pencil" class="w-3 h-3"></i> Edit Specs
            </button>
            <button onclick="handleCancelProject('${p.id}')" class="px-3.5 py-1.5 rounded-xl border border-red-200 hover:border-red-500 hover:bg-red-50 text-red-600 hover:text-red-600 font-bold text-xs transition-all flex items-center gap-1">
              <i data-lucide="trash-2" class="w-3 h-3"></i> Cancel
            </button>
          </div>
        `;

        if (projBids.length === 0) {
          footerHtml = `
            <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-semibold rounded-b-3xl">
              <span>No proposals submitted yet</span>
              ${controlsHtml}
            </div>
          `;
        } else {
          let bidsListHtml = "";
          projBids.forEach(b => {
            const freelancerRatingBadge = b.freelancer_rating 
              ? `<span class="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-extrabold text-[10px]"><i data-lucide="star" class="w-3 h-3 fill-emerald-600 text-emerald-600"></i> ${b.freelancer_rating} (${b.freelancer_review_count})</span>`
              : `<span class="ml-2 text-[10px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">New Member</span>`;

            bidsListHtml += `
              <div class="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-3">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <h5 class="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <div class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 font-extrabold uppercase">${b.freelancer_name[0]}</div>
                      ${escapeHtml(b.freelancer_name)}
                      ${freelancerRatingBadge}
                    </h5>
                    <p class="text-xs text-slate-400 font-semibold mt-1">Delivery Estimate: <span class="text-slate-700">${escapeHtml(b.timeline)}</span></p>
                  </div>
                  <div class="text-right">
                    <span class="text-base font-extrabold text-brand-600">$${(b.amount_cents / 100).toLocaleString()}</span>
                    <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Proposed Rate</p>
                  </div>
                </div>
                <p class="text-xs text-slate-600 leading-relaxed font-medium bg-white p-3.5 rounded-xl border border-slate-200/50 italic">"${escapeHtml(b.pitch)}"</p>
                
                <div class="flex items-center justify-between">
                  <button onclick="openChatDrawer('${p.id}', '${b.freelancer_id}', '${escapeHtml(p.title)}', '${escapeHtml(b.freelancer_name)}')" class="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-brand-500 text-slate-600 hover:text-brand-600 font-bold text-xs transition-all flex items-center gap-1">
                    <i data-lucide="message-square" class="w-3.5 h-3.5"></i> Message Freelancer
                  </button>
                  <button onclick="handleHireClient('${b.id}')" class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition-all shadow-sm flex items-center gap-1">
                    <i data-lucide="lock" class="w-3.5 h-3.5"></i> Hire & Lock Escrow
                  </button>
                </div>
              </div>
            `;
          });

          footerHtml = `
            <div class="px-6 py-5 bg-slate-50 border-t border-slate-100 rounded-b-3xl space-y-4">
              <div class="flex items-center justify-between">
                <h4 class="text-xs uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1">
                  <i data-lucide="message-square" class="w-3.5 h-3.5 text-slate-400"></i>
                  Active Bids (${projBids.length})
                </h4>
                ${controlsHtml}
              </div>
              <div class="space-y-3 max-h-96 overflow-y-auto pr-1">
                ${bidsListHtml}
              </div>
            </div>
          `;
        }

      } else if (p.status === "hired") {
        statusBadge = `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-600"><i data-lucide="clock" class="w-3.5 h-3.5"></i> In Progress (Escrow Locked)</span>`;
        borderStyle = "border-amber-200/80 bg-white";

        const hiredName = p.hired_freelancer_id ? await fetchParticipantName(p.hired_freelancer_id) : "Contractor";
        const hiredPrice = p.escrow_cents / 100;

        footerHtml = `
          <div class="px-6 py-4 bg-amber-50/20 border-t border-amber-100/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs rounded-b-3xl">
            <span class="font-medium text-slate-500 flex items-center gap-1.5">
              <i data-lucide="user-check" class="w-4 h-4 text-amber-600"></i>
              Contractor: <strong class="text-slate-800">${escapeHtml(hiredName)}</strong>
              <button onclick="openChatDrawer('${p.id}', '${p.hired_freelancer_id}', '${escapeHtml(p.title)}', '${escapeHtml(hiredName)}')" class="ml-2 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-brand-600 transition-all font-semibold flex items-center gap-1">
                <i data-lucide="message-square" class="w-3.5 h-3.5"></i> Open Chat
              </button>
            </span>
            <span class="font-bold text-amber-700 flex items-center gap-1.5">
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 escrow-pulse shrink-0"></span>
              $${hiredPrice.toLocaleString()} locked in Escrow
            </span>
          </div>
        `;

      } else if (p.status === "submitted" || p.status === "revision_requested") {
        const isRev = p.status === "revision_requested";
        statusBadge = isRev
          ? `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-50 border border-red-200 text-red-600"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Revision Requested</span>`
          : `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 border border-purple-200 text-purple-600"><i data-lucide="eye" class="w-3.5 h-3.5"></i> Deliverable Under Review</span>`;
        
        borderStyle = isRev ? "border-red-200 bg-white" : "border-purple-200 bg-white shadow-purple-50/20";

        const hiredName = p.hired_freelancer_id ? await fetchParticipantName(p.hired_freelancer_id) : "Contractor";
        const payoutVal = p.escrow_cents / 100;

        let submissionNoteHtml = "";
        if (p.submitted_file) {
          submissionNoteHtml = `
            <div class="bg-white border border-purple-200/80 p-4 rounded-2xl flex items-start gap-3">
              <div class="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                <i data-lucide="file-archive" class="w-5 h-5"></i>
              </div>
              <div class="flex-grow">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-bold text-slate-900 font-mono">${escapeHtml(p.submitted_file)}</span>
                  <span class="text-[10px] text-slate-400 font-semibold">${new Date(p.submitted_at).toLocaleDateString()}</span>
                </div>
                <p class="text-xs text-slate-500 mt-1 italic font-medium leading-relaxed">"${escapeHtml(p.submitted_comment)}"</p>
              </div>
            </div>
          `;
        }

        let revisionBlock = "";
        if (isRev) {
          revisionBlock = `
            <div class="p-3 bg-red-50/50 border border-red-100 rounded-2xl text-xs text-red-700 font-medium">
              <strong>Your Revision Requirement:</strong> "${escapeHtml(p.revision_note)}"
            </div>
          `;
        }

        const buttonsRow = isRev 
          ? `<button onclick="openChatDrawer('${p.id}', '${p.hired_freelancer_id}', '${escapeHtml(p.title)}', '${escapeHtml(hiredName)}')" class="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-brand-600 font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm">
               <i data-lucide="message-square" class="w-4 h-4"></i> Open Chat
             </button>`
          : `<div class="flex gap-2">
               <button onclick="openChatDrawer('${p.id}', '${p.hired_freelancer_id}', '${escapeHtml(p.title)}', '${escapeHtml(hiredName)}')" class="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-brand-600 font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm">
                 <i data-lucide="message-square" class="w-4 h-4"></i> Open Chat
               </button>
               <button onclick="openRevisionModal('${p.id}')" class="px-4 py-2 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm">
                 <i data-lucide="refresh-cw" class="w-4 h-4"></i> Request Revision
               </button>
               <button onclick="handleAcceptPayment('${p.id}', ${payoutVal})" class="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition-all shadow-md flex items-center gap-1.5">
                 <i data-lucide="unlock" class="w-4 h-4"></i> Accept & Release Funds
               </button>
             </div>`;

        footerHtml = `
          <div class="px-6 py-5 bg-purple-50/20 border-t border-purple-100 rounded-b-3xl space-y-4">
            ${submissionNoteHtml}
            ${revisionBlock}
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              <span class="text-xs text-slate-400 font-semibold">Contractor: <strong class="text-slate-700">${escapeHtml(hiredName)}</strong> &bull; Locked Escrow: <strong class="text-emerald-600">$${payoutVal.toLocaleString()}</strong></span>
              ${buttonsRow}
            </div>
          </div>
        `;

      } else if (p.status === "completed") {
        statusBadge = `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-brand-50 border border-brand-200 text-brand-600"><i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Completed & Released</span>`;
        
        const hiredName = p.hired_freelancer_id ? await fetchParticipantName(p.hired_freelancer_id) : "Contractor";
        const releasedAmt = p.budget_cents / 100;

        // Fetch Reviews and calculate double blind displays
        const reviewsRes = await apiRequest(`/api/projects/${p.id}/reviews`);
        const reviews = reviewsRes.success ? reviewsRes.data.reviews : [];
        const blinded = reviewsRes.success ? reviewsRes.data.blinded : true;

        let reviewAreaHtml = "";
        
        if (reviews.length === 2) {
          // Double blind released, display both reviews
          const clientRev = reviews.find(r => r.reviewer_role === "client");
          const freeRev = reviews.find(r => r.reviewer_role === "freelancer");

          reviewAreaHtml = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-100">
              <div class="review-card space-y-1">
                <span class="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Your Review to Freelancer</span>
                <div class="flex items-center text-emerald-500 gap-0.5">${'<i data-lucide="star" class="w-3 h-3 fill-emerald-500 text-emerald-500"></i>'.repeat(clientRev.rating)}</div>
                <p class="text-xs text-slate-600 italic mt-1 font-medium">"${escapeHtml(clientRev.comment)}"</p>
              </div>
              <div class="review-card space-y-1">
                <span class="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Freelancer Feedback to You</span>
                <div class="flex items-center text-emerald-500 gap-0.5">${'<i data-lucide="star" class="w-3 h-3 fill-emerald-500 text-emerald-500"></i>'.repeat(freeRev.rating)}</div>
                <p class="text-xs text-slate-600 italic mt-1 font-medium">"${escapeHtml(freeRev.comment)}"</p>
              </div>
            </div>
          `;
        } else {
          // Double-blind is still active
          const myReview = reviews.find(r => r.reviewer_id === currentUser.id);
          if (myReview) {
            reviewAreaHtml = `
              <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 font-semibold text-center mt-3">
                Your review has been submitted. Waiting for the freelancer to submit their review.
              </div>
            `;
          } else {
            reviewAreaHtml = `
              <div class="flex items-center justify-between p-4 bg-brand-50/50 border border-brand-100 rounded-2xl mt-3">
                <div class="text-xs text-brand-800 font-semibold">Contract finalized. Exchange feedback to release public ratings.</div>
                <button onclick="openReviewModal('${p.id}', '${escapeHtml(p.title)}')" class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition-all shadow-sm">
                  Review Contractor
                </button>
              </div>
            `;
          }
        }

        footerHtml = `
          <div class="px-6 py-5 bg-brand-50/20 border-t border-brand-100 rounded-b-3xl space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p class="text-xs font-bold text-slate-800">Finalized by ${escapeHtml(hiredName)}</p>
                <p class="text-[10px] text-slate-400 font-semibold">Ledger Receipt: $${releasedAmt.toLocaleString()} credited successfully.</p>
              </div>
              <div class="flex gap-2">
                <button onclick="openChatDrawer('${p.id}', '${p.hired_freelancer_id}', '${escapeHtml(p.title)}', '${escapeHtml(hiredName)}')" class="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-brand-600 transition-all font-semibold flex items-center gap-1 text-xs shadow-sm">
                  <i data-lucide="message-square" class="w-3.5 h-3.5"></i> Chat Log
                </button>
                <button onclick="simulateDeliverableDownload('${escapeHtml(p.title)}', '${escapeHtml(p.submitted_file || 'deliverable.zip')}')" class="deliverable-link px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-brand-500 hover:bg-brand-50 text-slate-700 hover:text-brand-600 font-semibold text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-sm">
                  <i data-lucide="download" class="w-4 h-4"></i> Download Deliverable
                </button>
              </div>
            </div>
            ${reviewAreaHtml}
          </div>
        `;
      } else if (p.status === "cancelled") {
        statusBadge = `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 border border-slate-200 text-slate-400"><i data-lucide="slash" class="w-3.5 h-3.5"></i> Cancelled</span>`;
        borderStyle = "border-slate-200 opacity-60";
        footerHtml = `
          <div class="px-6 py-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-semibold rounded-b-3xl">
            Contract cancelled on sandbox ledger. All pending bids were rejected.
          </div>
        `;
      }

      html += `
        <div class="bg-white border ${borderStyle} rounded-3xl custom-shadow animate-fade-in-up">
          <div class="p-6 md:p-8 space-y-4">
            <div class="flex items-start justify-between gap-4">
              <span class="text-xs uppercase font-extrabold tracking-wider text-slate-400">${escapeHtml(p.category)}</span>
              ${statusBadge}
            </div>
            
            <h3 class="text-xl font-bold text-slate-950">${escapeHtml(p.title)}</h3>
            <p class="text-sm text-slate-500 font-medium leading-relaxed font-sans">${escapeHtml(p.description)}</p>
            
            ${milestonesTrackerHtml}

            <div class="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100/60">
              <span class="text-xs text-slate-400 font-semibold">Contract Budget</span>
              <span class="text-lg font-black text-slate-900">$${(p.budget_cents / 100).toLocaleString()}</span>
            </div>
          </div>
          ${footerHtml}
        </div>
      `;
    }

    container.innerHTML = html;
    lucide.createIcons();
  } catch (err) {}
}

async function fetchParticipantName(id) {
  try {
    const res = await apiRequest(`/api/users/${id}`);
    if (res.success) {
      return res.data.user.name;
    }
  } catch (err) {}
  return "Specialist";
}

async function handleHireClient(bidId) {
  try {
    const res = await apiRequest(`/api/bids/${bidId}/award`, {
      method: "POST"
    });

    if (res.success) {
      showToast("Contract awarded successfully! Escrow balance locked.", "success");
      checkExistingSession(); // update client wallet balance
      renderClientProjects();
    }
  } catch (err) {}
}

async function handleAcceptPayment(projectId, amount) {
  if (!confirm(`Are you sure you want to release the locked escrow of $${amount.toLocaleString()}? This action is irreversible.`)) {
    return;
  }

  try {
    const res = await apiRequest(`/api/projects/${projectId}/accept-work`, {
      method: "POST"
    });

    if (res.success) {
      showToast("Escrow cleared & virtual payout released to freelancer!", "success");
      checkExistingSession();
      renderClientProjects();
    }
  } catch (err) {}
}

function simulateDeliverableDownload(projectTitle, fileName) {
  const dataContent = `LANCERLINK CONTRACT DELIVERABLE RECEIPT
===================================================
Project: ${projectTitle}
Deliverable File Name: ${fileName}
Ledger Transaction Hash: ll_hash_${Date.now().toString(36)}
Status: PAYMENT RELEASED & VERIFIED BY SANDBOX LEDGER
Date of Delivery: ${new Date().toLocaleDateString()}

Thank you for utilizing the LancerLink database-backed freelance ledger!`;

  const blob = new Blob([dataContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lancerlink_deliverable_${fileName.replace(/\.[^/.]+$/, "")}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  showToast("Deliverable receipt downloaded successfully!", "info");
}

// Edit & Cancel project actions
function openEditProjectModal(projectId) {
  apiRequest(`/api/projects/${projectId}`).then(res => {
    if (res.success) {
      const p = res.data.project;
      document.getElementById("edit-project-id").value = p.id;
      document.getElementById("edit-title").value = p.title;
      document.getElementById("edit-category").value = p.category;
      document.getElementById("edit-budget").value = p.budget_cents / 100;
      document.getElementById("edit-description").value = p.description;

      const modal = document.getElementById("edit-project-modal");
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }
  });
}

function closeEditProjectModal() {
  const modal = document.getElementById("edit-project-modal");
  modal.classList.remove("flex");
  modal.classList.add("hidden");
}

async function handleEditProjectSubmit(event) {
  event.preventDefault();
  const id = document.getElementById("edit-project-id").value;
  const title = document.getElementById("edit-title").value.trim();
  const category = document.getElementById("edit-category").value;
  const budget = parseFloat(document.getElementById("edit-budget").value);
  const description = document.getElementById("edit-description").value.trim();

  try {
    const res = await apiRequest(`/api/projects/${id}`, {
      method: "PATCH",
      body: { title, category, budget, description }
    });

    if (res.success) {
      showToast("Contract specifications updated successfully.", "success");
      closeEditProjectModal();
      renderClientProjects();
    }
  } catch (err) {}
}

async function handleCancelProject(id) {
  if (!confirm("Are you sure you want to cancel this contract? Bidding will be closed, and freelancers notified.")) {
    return;
  }

  try {
    const res = await apiRequest(`/api/projects/${id}/cancel`, {
      method: "POST"
    });
    if (res.success) {
      showToast("Contract cancelled successfully.", "info");
      renderClientProjects();
    }
  } catch (err) {}
}

// Revision requests
function openRevisionModal(projectId) {
  document.getElementById("revision-project-id").value = projectId;
  document.getElementById("revision-note").value = "";
  
  const modal = document.getElementById("revision-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeRevisionModal() {
  const modal = document.getElementById("revision-modal");
  modal.classList.remove("flex");
  modal.classList.add("hidden");
}

async function handleRevisionSubmit(event) {
  event.preventDefault();
  const projectId = document.getElementById("revision-project-id").value;
  const note = document.getElementById("revision-note").value.trim();

  try {
    const res = await apiRequest(`/api/projects/${projectId}/request-revision`, {
      method: "POST",
      body: { revision_note: note }
    });

    if (res.success) {
      showToast("Revision request transmitted successfully.", "info");
      closeRevisionModal();
      renderClientProjects();
    }
  } catch (err) {}
}

// ========================================================
// FREELANCER WORKSPACE & FEED LOGIC
// ========================================================
async function renderLiveProjectFeed() {
  const container = document.getElementById("freelancer-feed-container");
  if (!container) return;

  const searchVal = document.getElementById("work-search").value.trim();
  const categoryFilter = document.getElementById("work-filter-category").value;

  try {
    let url = `/api/projects?status=open`;
    if (categoryFilter) url += `&category=${encodeURIComponent(categoryFilter)}`;
    if (searchVal) url += `&search=${encodeURIComponent(searchVal)}`;

    const res = await apiRequest(url);
    if (!res.success) return;

    const openProjects = res.data.projects;

    if (openProjects.length === 0) {
      container.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-3xl p-12 text-center custom-shadow">
          <div class="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4">
            <i data-lucide="search-code" class="w-8 h-8"></i>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-1">No Available Contracts</h3>
          <p class="text-sm text-slate-400 max-w-sm mx-auto">No open bids matched your filter configurations or database ledger is currently idle.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    // Sort newest
    openProjects.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    let html = "";
    for (let p of openProjects) {
      // Fetch user's bid on this project
      const bidsRes = await apiRequest(`/api/projects/${p.id}/bids`);
      const myBid = bidsRes.success && bidsRes.data.bids.length > 0 ? bidsRes.data.bids[0] : null;

      let bidActionHtml = "";

      if (myBid) {
        bidActionHtml = `
          <div class="flex items-center gap-3">
            <span class="text-xs text-brand-600 font-bold bg-brand-50 border border-brand-200/50 px-3.5 py-2 rounded-xl">
              You Bid: $${(myBid.amount_cents / 100).toLocaleString()} (${escapeHtml(myBid.timeline)})
            </span>
            <div class="flex gap-2">
              <button onclick="openChatDrawer('${p.id}', '${currentUser.id}', '${escapeHtml(p.title)}', '${escapeHtml(p.client_name)}')" class="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-brand-600 font-bold text-xs transition-all flex items-center gap-1">
                <i data-lucide="message-square" class="w-3.5 h-3.5"></i> Chat
              </button>
              <button onclick="openBidModal('${p.id}')" class="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-brand-500 text-slate-600 hover:text-brand-600 font-bold text-xs transition-all">
                Revise
              </button>
              <button onclick="handleWithdrawBid('${myBid.id}')" class="px-4 py-2.5 rounded-xl border border-red-200 hover:border-red-500 text-red-600 hover:text-red-600 font-bold text-xs transition-all">
                Withdraw
              </button>
            </div>
          </div>
        `;
      } else {
        bidActionHtml = `
          <button onclick="openBidModal('${p.id}')" class="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition-all shadow-sm">
            Submit Contract Proposal
          </button>
        `;
      }

      const clientRatingHtml = p.client_rating 
        ? `<span class="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-extrabold text-[9px]"><i data-lucide="star" class="w-2.5 h-2.5 fill-emerald-600 text-emerald-600"></i> ${p.client_rating} (${p.client_review_count})</span>`
        : `<span class="ml-2 text-[9px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">New Member</span>`;

      html += `
        <div class="bg-white border border-slate-200 rounded-3xl custom-shadow hover:border-brand-500/30 transition-all duration-300 p-6 md:p-8 space-y-4 animate-fade-in-up">
          <div class="flex items-start justify-between gap-4">
            <div>
              <span class="text-xs uppercase font-extrabold tracking-wider text-slate-400">${escapeHtml(p.category)}</span>
              <h4 class="text-[10px] text-slate-400 font-semibold mt-1">Contract by: <strong class="text-slate-600 font-bold">${escapeHtml(p.client_name)}</strong> ${clientRatingHtml} &bull; Posted ${new Date(p.created_at).toLocaleDateString()}</h4>
            </div>
            <span class="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-200/30">Escrow Validated</span>
          </div>
          
          <h3 class="text-xl font-bold text-slate-950">${escapeHtml(p.title)}</h3>
          <p class="text-sm text-slate-500 leading-relaxed font-medium font-sans">${escapeHtml(p.description)}</p>
          
          <div class="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-black text-slate-900">$${(p.budget_cents / 100).toLocaleString()}</span>
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client Budget Cap</span>
            </div>
            
            ${bidActionHtml}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
    lucide.createIcons();
  } catch (err) {}
}

async function handleWithdrawBid(bidId) {
  if (!confirm("Are you sure you want to withdraw this bid?")) return;
  try {
    const res = await apiRequest(`/api/bids/${bidId}/withdraw`, { method: "POST" });
    if (res.success) {
      showToast("Bid withdrawn successfully.", "info");
      renderLiveProjectFeed();
    }
  } catch (err) {}
}

// Bidding Form Modals
async function openBidModal(projectId) {
  try {
    const res = await apiRequest(`/api/projects/${projectId}`);
    if (!res.success) return;

    const project = res.data.project;
    document.getElementById("bid-project-id").value = project.id;
    document.getElementById("bid-modal-project-title").textContent = project.title;
    document.getElementById("bid-modal-client-name").textContent = project.client_name;
    document.getElementById("bid-modal-project-budget").textContent = `$${(project.budget_cents / 100).toLocaleString()}`;

    // Load existing bid details if editing
    const bidsRes = await apiRequest(`/api/projects/${project.id}/bids`);
    const myBid = bidsRes.success && bidsRes.data.bids.length > 0 ? bidsRes.data.bids[0] : null;

    const amountInput = document.getElementById("bid-amount");
    const timelineSelect = document.getElementById("bid-timeline");
    const pitchText = document.getElementById("bid-pitch");

    if (myBid) {
      amountInput.value = myBid.amount_cents / 100;
      timelineSelect.value = myBid.timeline;
      pitchText.value = myBid.pitch;
    } else {
      amountInput.value = project.budget_cents / 100;
      timelineSelect.value = "5 Days";
      pitchText.value = "";
    }

    const modal = document.getElementById("bid-modal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  } catch (err) {}
}

function closeBidModal() {
  const modal = document.getElementById("bid-modal");
  modal.classList.remove("flex");
  modal.classList.add("hidden");
  document.getElementById("bid-form").reset();
}

async function handleBidSubmit(event) {
  event.preventDefault();

  const projectId = document.getElementById("bid-project-id").value;
  const bidAmt = parseFloat(document.getElementById("bid-amount").value);
  const timeline = document.getElementById("bid-timeline").value;
  const pitch = document.getElementById("bid-pitch").value.trim();

  if (isNaN(bidAmt) || bidAmt <= 0 || !timeline || !pitch) {
    showToast("Please complete the bidding parameters properly.", "error");
    return;
  }

  // Check if we are updating an existing bid
  const bidsRes = await apiRequest(`/api/projects/${projectId}/bids`);
  const myBid = bidsRes.success && bidsRes.data.bids.length > 0 ? bidsRes.data.bids[0] : null;

  try {
    let res;
    if (myBid) {
      // Revise existing
      res = await apiRequest(`/api/bids/${myBid.id}`, {
        method: "PATCH",
        body: { amount: bidAmt, timeline, pitch }
      });
      if (res.success) {
        showToast("Proposal specifications revised successfully!", "success");
      }
    } else {
      // Create new
      res = await apiRequest(`/api/projects/${projectId}/bids`, {
        method: "POST",
        body: { amount: bidAmt, timeline, pitch }
      });
      if (res.success) {
        showToast("Proposal successfully transmitted! Open chat enabled.", "success");
      }
    }

    if (res.success) {
      closeBidModal();
      renderLiveProjectFeed();
    }
  } catch (err) {}
}

// Freelancer Workspace Render
async function renderFreelancerWorkspace() {
  const container = document.getElementById("freelancer-workspace-container");
  if (!container) return;

  try {
    const res = await apiRequest(`/api/projects?hired_freelancer_id=${currentUser.id}`);
    if (!res.success) return;

    const hiredProjects = res.data.projects;

    if (hiredProjects.length === 0) {
      container.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-3xl p-12 text-center custom-shadow">
          <div class="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4">
            <i data-lucide="laptop" class="w-8 h-8"></i>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-1">Workspace Currently Empty</h3>
          <p class="text-sm text-slate-400 max-w-sm mx-auto mb-6">Bid on available marketplace contracts to secure workspace assignments.</p>
          <button onclick="switchTab('freelancer', 'find-work')" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-all shadow-sm">
            Browse Contracts
          </button>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    const statusWeight = { "hired": 1, "revision_requested": 1, "submitted": 2, "completed": 3 };
    hiredProjects.sort((a, b) => statusWeight[a.status] - statusWeight[b.status]);

    let html = "";

    for (let p of hiredProjects) {
      let cardBorder = "border-slate-200";
      let badgeHtml = "";
      let actionAreaHtml = "";

      const milestonesTrackerHtml = renderProjectMilestones(p);

      const lockedEscrowVal = p.escrow_cents / 100;

      if (p.status === "hired") {
        cardBorder = "border-amber-200/80 bg-white";
        badgeHtml = `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-600"><i data-lucide="clock" class="w-3.5 h-3.5"></i> Contract Active</span>`;
        
        actionAreaHtml = `
          <div class="px-6 py-5 bg-amber-50/20 border-t border-amber-100/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-b-3xl">
            <span class="text-xs text-amber-800 font-bold flex items-center gap-1">
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 escrow-pulse shrink-0"></span>
              $${lockedEscrowVal.toLocaleString()} secured in LancerLink Escrow
            </span>
            <div class="flex gap-2">
              <button onclick="openChatDrawer('${p.id}', '${currentUser.id}', '${escapeHtml(p.title)}', '${escapeHtml(p.client_name)}')" class="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-brand-600 font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm">
                <i data-lucide="message-square" class="w-4 h-4"></i> Open Chat
              </button>
              <button onclick="openSubmitWorkModal('${p.id}')" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-md flex items-center gap-1.5">
                <i data-lucide="check" class="w-4 h-4"></i> Deliver Finished Work
              </button>
            </div>
          </div>
        `;
      } else if (p.status === "revision_requested") {
        cardBorder = "border-red-200/80 bg-white";
        badgeHtml = `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-50 border border-red-200 text-red-600"><i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> Revision Requested</span>`;

        actionAreaHtml = `
          <div class="px-6 py-5 bg-red-50/20 border-t border-red-100 rounded-b-3xl space-y-4">
            <div class="p-4 bg-white border border-red-200 rounded-2xl text-xs text-red-700 font-medium leading-relaxed">
              <strong>Client Revision Feedback Note:</strong> "${escapeHtml(p.revision_note)}"
            </div>
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span class="text-xs text-red-800 font-bold">Escrow Funds ($${lockedEscrowVal.toLocaleString()}) secured in vault.</span>
              <div class="flex gap-2">
                <button onclick="openChatDrawer('${p.id}', '${currentUser.id}', '${escapeHtml(p.title)}', '${escapeHtml(p.client_name)}')" class="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-brand-600 font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm">
                  <i data-lucide="message-square" class="w-4 h-4"></i> Open Chat
                </button>
                <button onclick="openSubmitWorkModal('${p.id}')" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-md flex items-center gap-1.5">
                  <i data-lucide="check" class="w-4 h-4"></i> Resubmit Deliverables
                </button>
              </div>
            </div>
          </div>
        `;
      } else if (p.status === "submitted") {
        cardBorder = "border-purple-200/80 bg-white shadow-purple-50/20";
        badgeHtml = `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 border border-purple-200 text-purple-600"><i data-lucide="refresh-cw" class="w-3.5 h-3.5 animate-spin"></i> Delivered & Awaiting Review</span>`;

        actionAreaHtml = `
          <div class="px-6 py-5 bg-purple-50/20 border-t border-purple-100 rounded-b-3xl space-y-3">
            <div class="bg-white border border-purple-200 p-4 rounded-2xl flex items-start gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                <i data-lucide="file-archive" class="w-4.5 h-4.5"></i>
              </div>
              <div>
                <p class="text-xs font-bold text-slate-800 font-mono">${escapeHtml(p.submitted_file)}</p>
                <p class="text-xs text-slate-500 mt-1 leading-relaxed font-medium italic">"${escapeHtml(p.submitted_comment)}"</p>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <button onclick="openChatDrawer('${p.id}', '${currentUser.id}', '${escapeHtml(p.title)}', '${escapeHtml(p.client_name)}')" class="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-brand-600 transition-all font-semibold flex items-center gap-1 text-xs">
                <i data-lucide="message-square" class="w-3.5 h-3.5"></i> Project Chat
              </button>
              <p class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider text-right">Awaiting payment release trigger</p>
            </div>
          </div>
        `;
      } else if (p.status === "completed") {
        badgeHtml = `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-brand-50 border border-brand-200 text-brand-600"><i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Paid & Finalized</span>`;
        
        // Fetch reviews
        const reviewsRes = await apiRequest(`/api/projects/${p.id}/reviews`);
        const reviews = reviewsRes.success ? reviewsRes.data.reviews : [];
        
        let reviewAreaHtml = "";
        
        if (reviews.length === 2) {
          const clientRev = reviews.find(r => r.reviewer_role === "client");
          const freeRev = reviews.find(r => r.reviewer_role === "freelancer");

          reviewAreaHtml = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-100">
              <div class="review-card space-y-1">
                <span class="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Client Feedback to You</span>
                <div class="flex items-center text-emerald-500 gap-0.5">${'<i data-lucide="star" class="w-3 h-3 fill-emerald-500 text-emerald-500"></i>'.repeat(clientRev.rating)}</div>
                <p class="text-xs text-slate-600 italic mt-1 font-medium">"${escapeHtml(clientRev.comment)}"</p>
              </div>
              <div class="review-card space-y-1">
                <span class="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Your Review to Client</span>
                <div class="flex items-center text-emerald-500 gap-0.5">${'<i data-lucide="star" class="w-3 h-3 fill-emerald-500 text-emerald-500"></i>'.repeat(freeRev.rating)}</div>
                <p class="text-xs text-slate-600 italic mt-1 font-medium">"${escapeHtml(freeRev.comment)}"</p>
              </div>
            </div>
          `;
        } else {
          const myReview = reviews.find(r => r.reviewer_id === currentUser.id);
          if (myReview) {
            reviewAreaHtml = `
              <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 font-semibold text-center mt-3">
                Your review has been submitted. Waiting for the client to submit their feedback.
              </div>
            `;
          } else {
            reviewAreaHtml = `
              <div class="flex items-center justify-between p-4 bg-brand-50/50 border border-brand-100 rounded-2xl mt-3">
                <div class="text-xs text-brand-800 font-semibold">Contract finalized. Exchange feedback to release public ratings.</div>
                <button onclick="openReviewModal('${p.id}', '${escapeHtml(p.title)}')" class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition-all shadow-sm">
                  Review Client
                </button>
              </div>
            `;
          }
        }

        actionAreaHtml = `
          <div class="px-6 py-5 bg-brand-50/20 border-t border-brand-100 rounded-b-3xl space-y-4">
            <div class="flex items-center justify-between text-xs text-brand-800 font-bold">
              <span>Funds successfully credited to your wallet</span>
              <div class="flex gap-2 items-center">
                <button onclick="openChatDrawer('${p.id}', '${currentUser.id}', '${escapeHtml(p.title)}', '${escapeHtml(p.client_name)}')" class="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-brand-600 transition-all font-semibold flex items-center gap-1 text-xs shadow-sm">
                  <i data-lucide="message-square" class="w-3.5 h-3.5"></i> Chat Logs
                </button>
                <span class="flex items-center gap-1 text-emerald-600 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                  <i data-lucide="badge-check" class="w-4 h-4 text-emerald-600"></i>
                  +$${(p.budget_cents / 100).toLocaleString()} Earnings Cleared
                </span>
              </div>
            </div>
            ${reviewAreaHtml}
          </div>
        `;
      }

      html += `
        <div class="bg-white border ${cardBorder} rounded-3xl custom-shadow animate-fade-in-up">
          <div class="p-6 md:p-8 space-y-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <span class="text-xs uppercase font-extrabold tracking-wider text-slate-400">${escapeHtml(p.category)}</span>
                <p class="text-[10px] text-slate-400 font-semibold mt-1">Client Contract: <strong class="font-bold text-slate-600">${escapeHtml(p.client_name)}</strong></p>
              </div>
              ${badgeHtml}
            </div>

            <h3 class="text-xl font-bold text-slate-950">${escapeHtml(p.title)}</h3>
            <p class="text-sm text-slate-500 font-medium leading-relaxed font-sans">${escapeHtml(p.description)}</p>
            
            ${milestonesTrackerHtml}

            <div class="flex items-center justify-between border-t border-slate-100 pt-3">
              <span class="text-xs text-slate-400 font-semibold">Contract Budget</span>
              <span class="text-lg font-black text-slate-900">$${(p.budget_cents / 100).toLocaleString()}</span>
            </div>
          </div>
          ${actionAreaHtml}
        </div>
      `;
    }

    container.innerHTML = html;
    lucide.createIcons();
  } catch (err) {}
}

function openSubmitWorkModal(projectId) {
  apiRequest(`/api/projects/${projectId}`).then(res => {
    if (res.success) {
      const p = res.data.project;
      const rate = p.budget_cents / 100;

      document.getElementById("submit-work-project-id").value = p.id;
      document.getElementById("submit-work-project-title").textContent = p.title;
      document.getElementById("submit-work-project-budget").textContent = `$${rate.toLocaleString()}`;
      document.getElementById("submit-filename").value = p.category.toLowerCase().replace(/\s+/g, '_') + "_deliverables.zip";

      const modal = document.getElementById("submit-work-modal");
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }
  });
}

function closeSubmitWorkModal() {
  const modal = document.getElementById("submit-work-modal");
  modal.classList.remove("flex");
  modal.classList.add("hidden");
  document.getElementById("submit-work-form").reset();
}

async function handleSubmitWork(event) {
  event.preventDefault();

  const projectId = document.getElementById("submit-work-project-id").value;
  const fileType = document.getElementById("submit-file-type").value;
  const filename = document.getElementById("submit-filename").value.trim() || fileType;
  const comment = document.getElementById("submit-comment").value.trim();

  if (!projectId || !filename || !comment) {
    showToast("Please fill out all delivery fields properly.", "error");
    return;
  }

  try {
    const res = await apiRequest(`/api/projects/${projectId}/submit-work`, {
      method: "POST",
      body: { filename, comment }
    });

    if (res.success) {
      showToast("Deliverable successfully submitted! Awaiting review.", "success");
      closeSubmitWorkModal();
      renderFreelancerWorkspace();
    }
  } catch (err) {}
}

// ========================================================
// REVIEWS AND FEEDBACK EXCHANGER
// ========================================================
function openReviewModal(projectId, projectTitle) {
  document.getElementById("review-project-id").value = projectId;
  document.getElementById("review-project-title-header").textContent = projectTitle;
  document.getElementById("review-comment").value = "";
  
  // Clear stars
  setReviewRating(0);

  const modal = document.getElementById("review-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeReviewModal() {
  const modal = document.getElementById("review-modal");
  modal.classList.remove("flex");
  modal.classList.add("hidden");
  document.getElementById("review-form-element").reset();
}

function setReviewRating(rating) {
  selectedReviewRating = rating;
  document.getElementById("review-rating-value").value = rating > 0 ? rating : "";

  const stars = document.querySelectorAll("#star-picker-container .rating-star");
  stars.forEach((star, index) => {
    if (index < rating) {
      star.classList.add("star-active");
    } else {
      star.classList.remove("star-active");
    }
  });
}

async function handleReviewSubmit(event) {
  event.preventDefault();
  const projectId = document.getElementById("review-project-id").value;
  const comment = document.getElementById("review-comment").value.trim();

  if (!selectedReviewRating || !comment) {
    showToast("Please select a star rating and leave feedback comment.", "error");
    return;
  }

  try {
    const res = await apiRequest(`/api/projects/${projectId}/reviews`, {
      method: "POST",
      body: {
        rating: selectedReviewRating,
        comment: comment
      }
    });

    if (res.success) {
      showToast("Feedback review submitted securely. Double-blind active.", "success");
      closeReviewModal();
      if (currentUser.role === "client") {
        renderClientProjects();
      } else {
        renderFreelancerWorkspace();
      }
    }
  } catch (err) {}
}

// ========================================================
// CONTEXTUAL MESSAGING SYSTEM & HTTP POLLING
// ========================================================
function openChatDrawer(projectId, freelancerId, projectTitle, participantName) {
  activeChatProjectId = projectId;
  activeChatFreelancerId = freelancerId;
  activeChatLastId = 0;
  
  document.getElementById("chat-project-title").textContent = projectTitle;
  document.getElementById("chat-participant").textContent = participantName;
  document.getElementById("chat-thread").innerHTML = `<div class="p-6 text-center text-xs text-slate-400 font-semibold">Loading conversation history...</div>`;
  document.getElementById("chat-input").value = "";

  const drawer = document.getElementById("chat-drawer");
  const overlay = document.getElementById("chat-overlay");
  drawer.classList.add("open");
  overlay.classList.add("open");

  // Load chat draft if exists in LocalStorage
  const draftKey = `lancerlink_draft_${projectId}_${freelancerId}`;
  const savedDraft = localStorage.getItem(draftKey);
  if (savedDraft) {
    document.getElementById("chat-input").value = savedDraft;
  }

  // Listen to draft changes
  document.getElementById("chat-input").oninput = (e) => {
    localStorage.setItem(draftKey, e.target.value);
  };

  // Immediate message pull
  pullMessages(true);

  // Setup short-polling (every 2 seconds)
  if (chatPollInterval) clearInterval(chatPollInterval);
  chatPollInterval = setInterval(() => pullMessages(false), 2000);
  isChatPollerActive = true;
}

function closeChatDrawer() {
  const drawer = document.getElementById("chat-drawer");
  const overlay = document.getElementById("chat-overlay");
  drawer.classList.remove("open");
  overlay.classList.remove("open");

  if (chatPollInterval) {
    clearInterval(chatPollInterval);
    chatPollInterval = null;
  }
  isChatPollerActive = false;
  
  activeChatProjectId = null;
  activeChatFreelancerId = null;
  activeChatLastId = 0;
}

async function pullMessages(isInitial = false) {
  if (!activeChatProjectId || !activeChatFreelancerId) return;

  try {
    const res = await apiRequest(`/api/projects/${activeChatProjectId}/messages?freelancer_id=${activeChatFreelancerId}&after_id=${activeChatLastId}`);
    if (!res.success) return;

    const messages = res.data.messages;
    const threadContainer = document.getElementById("chat-thread");

    if (isInitial) {
      threadContainer.innerHTML = "";
    }

    if (messages.length > 0) {
      let isScrollAtBottom = threadContainer.scrollHeight - threadContainer.scrollTop <= threadContainer.clientHeight + 80;

      messages.forEach(m => {
        const rowClass = m.sender_id === currentUser.id ? "message-row-own" : "message-row-other";
        
        // Find correct bubble color based on sender's role
        // Server returns the message. The joining sender user could be client/freelancer.
        // We join or verify role. Clients are emerald, Freelancers are slate.
        // We check if sender is jane (client) or check role. Or simpler:
        // Client ID of project determines client vs freelancer bubbles.
        const isClientMsg = m.sender_id === m.client_id;
        const bubbleClass = isClientMsg ? "message-bubble-client" : "message-bubble-freelancer";

        const msgEl = document.createElement("div");
        msgEl.className = `message-row ${rowClass} message-enter`;
        msgEl.innerHTML = `
          <div class="message-bubble ${bubbleClass}">
            <div class="text-[9px] font-bold opacity-60 mb-0.5 flex items-center justify-between gap-4">
              <span>${escapeHtml(m.sender_name)}</span>
              <span>${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p class="whitespace-pre-wrap font-medium break-words">${escapeHtml(m.body)}</p>
          </div>
        `;
        threadContainer.appendChild(msgEl);
        
        activeChatLastId = m.id;
      });

      lucide.createIcons();

      if (isInitial || isScrollAtBottom) {
        threadContainer.scrollTop = threadContainer.scrollHeight;
      }
    }

    if (isInitial && messages.length === 0) {
      threadContainer.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 font-semibold">No messages yet. Send a message to start discussion.</div>`;
    }

    // Mark messages as read
    if (messages.length > 0) {
      await apiRequest("/api/messages/mark-read", {
        method: "POST",
        body: {
          project_id: activeChatProjectId,
          freelancer_id: activeChatFreelancerId
        }
      });
    }

  } catch (err) {
    if (isInitial) {
      document.getElementById("chat-thread").innerHTML = `<div class="p-6 text-center text-xs text-red-400 font-bold">Failed to load messages history. Close and try again.</div>`;
    }
  }
}

async function handleSendMessage(event) {
  event.preventDefault();
  const inputEl = document.getElementById("chat-input");
  const body = inputEl.value.trim();

  if (!body) return;

  try {
    const res = await apiRequest(`/api/projects/${activeChatProjectId}/messages`, {
      method: "POST",
      body: {
        freelancer_id: activeChatFreelancerId,
        body: body
      }
    });

    if (res.success) {
      // Clear input and draft cache
      inputEl.value = "";
      localStorage.removeItem(`lancerlink_draft_${activeChatProjectId}_${activeChatFreelancerId}`);
      pullMessages(false);
    }
  } catch (err) {}
}

// Support Enter key for sending (Shift+Enter for newline)
document.getElementById("chat-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    document.getElementById("chat-input-form").requestSubmit();
  }
});

// ========================================================
// NOTIFICATIONS SYSTEM
// ========================================================
let isNotificationsOpen = false;

function toggleNotificationsDropdown(event, role) {
  event.stopPropagation();
  const dropdown = document.getElementById(`${role}-notification-dropdown`);
  
  // Close other dropdowns
  const otherRole = role === "client" ? "freelancer" : "client";
  const otherDropdown = document.getElementById(`${otherRole}-notification-dropdown`);
  if (otherDropdown) otherDropdown.classList.add("hidden");

  if (dropdown.classList.contains("hidden")) {
    dropdown.classList.remove("hidden");
    isNotificationsOpen = true;
    renderNotificationsList(role);
  } else {
    dropdown.classList.add("hidden");
    isNotificationsOpen = false;
  }
}

// Close dropdown on clicking outside
document.addEventListener("click", () => {
  const dropdowns = ["client-notification-dropdown", "freelancer-notification-dropdown"];
  dropdowns.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
  isNotificationsOpen = false;
});

async function pollGlobalUpdates() {
  if (!currentUser) return;
  
  try {
    // 1. Poll notifications count
    const res = await apiRequest("/api/notifications");
    if (res.success) {
      const count = res.data.unread_count;
      const role = currentUser.role;
      const badge = document.getElementById(`${role}-notification-count`);

      if (badge) {
        if (count > 0) {
          badge.textContent = count;
          badge.classList.remove("hidden");
        } else {
          badge.classList.add("hidden");
        }
      }

      // If open, redraw list
      if (isNotificationsOpen) {
        renderNotificationsList(role, res.data.notifications);
      }
    }

    // 2. Refresh current dashboard lists depending on active tabs
    const activeDashboard = document.getElementById(`${currentUser.role}-dashboard-section`);
    if (activeDashboard && !activeDashboard.classList.contains("hidden")) {
      const activeTabContent = activeDashboard.querySelector(".tab-content.active");
      if (activeTabContent) {
        const id = activeTabContent.id;
        if (id === "client-tab-my-projects") {
          renderClientProjects();
        } else if (id === "freelancer-tab-find-work") {
          renderLiveProjectFeed();
        } else if (id === "freelancer-tab-workspace") {
          renderFreelancerWorkspace();
        }
      }
    }
  } catch (err) {}
}

async function renderNotificationsList(role, preFetchedNotifs = null) {
  const listContainer = document.getElementById(`${role}-notification-list`);
  if (!listContainer) return;

  try {
    let notifs = preFetchedNotifs;
    if (!notifs) {
      const res = await apiRequest("/api/notifications");
      if (res.success) notifs = res.data.notifications;
    }

    if (!notifs || notifs.length === 0) {
      listContainer.innerHTML = `<div class="px-4 py-6 text-center text-xs text-slate-400 font-semibold">No recent notifications.</div>`;
      return;
    }

    let html = "";
    notifs.forEach(n => {
      const unreadStyle = n.is_read === 0 ? "bg-emerald-50/60 font-semibold" : "";
      const dateStr = new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      
      html += `
        <div onclick="handleNotificationClick(event, ${n.id}, '${n.project_id}', '${n.notification_type}')" 
             class="px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer text-xs text-slate-700 flex flex-col gap-1 ${unreadStyle}">
          <p class="leading-relaxed">${escapeHtml(n.message)}</p>
          <span class="text-[9px] text-slate-400 font-bold">${dateStr}</span>
        </div>
      `;
    });

    listContainer.innerHTML = html;
  } catch (err) {}
}

async function handleNotificationClick(event, notificationId, projectId, type) {
  event.stopPropagation();
  
  try {
    // Mark read
    await apiRequest(`/api/notifications/${notificationId}/read`, { method: "POST" });
    
    // Close dropdown
    const role = currentUser.role;
    document.getElementById(`${role}-notification-dropdown`).classList.add("hidden");
    isNotificationsOpen = false;

    // Refresh bell count
    pollGlobalUpdates();

    // Navigate to appropriate tab based on type
    if (role === "client") {
      switchTab("client", "my-projects");
    } else {
      if (type === "hired" || type === "revision_requested" || type === "payment_released") {
        switchTab("freelancer", "workspace");
      } else {
        switchTab("freelancer", "find-work");
      }
    }
  } catch (err) {}
}

async function markAllNotificationsRead(event, role) {
  event.stopPropagation();
  try {
    const res = await apiRequest("/api/notifications/read-all", { method: "POST" });
    if (res.success) {
      showToast("All notifications marked as read.", "success");
      pollGlobalUpdates();
    }
  } catch (err) {}
}
