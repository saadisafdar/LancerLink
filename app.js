/**
 * LancerLink Core Application Engine
 * Pure Vanilla ES6+ State & LocalStorage Ledger System
 */

// Global Application Database & State Model
let db = {
  users: [],
  projects: [],
  bids: [],
  activeSession: null // Stores current logged-in user object { id, role }
};

// Seeding Initial Mock Data to wow users instantly on first load
const SEED_DATA = {
  users: [
    {
      id: "usr_client_jane",
      email: "jane@lancerlink.co",
      password: "password123",
      name: "Jane Cooper",
      role: "client",
      wallet: 3500.00
    },
    {
      id: "usr_free_alex",
      email: "alex@lancerlink.co",
      password: "password123",
      name: "Alex Mercer",
      role: "freelancer",
      wallet: 850.00
    },
    {
      id: "usr_free_sarah",
      email: "sarah@lancerlink.co",
      password: "password123",
      name: "Sarah Jenkins",
      role: "freelancer",
      wallet: 0.00
    }
  ],
  projects: [
    {
      id: "proj_seed_1",
      title: "Custom FinTech Dashboard UI Layout",
      description: "Looking for an expert brand and UI designer to craft a gorgeous White & Green design scheme for our web SaaS. Requires 15 high-fidelity wireframes in Figma with modern layout standards. Budget must include revisions.",
      category: "Brand Design",
      budget: 1200,
      clientId: "usr_client_jane",
      clientName: "Jane Cooper",
      createdAt: "2026-05-20T10:15:30.000Z",
      status: "open",
      hiredFreelancerId: null,
      hiredBidId: null,
      submittedFile: null,
      submittedComment: null,
      submittedAt: null
    },
    {
      id: "proj_seed_2",
      title: "Scale MySQL Database Schema for Logistics CRM",
      description: "Our current fleet tracking system is hitting bottleneck errors. Need a database engineer to optimize index parameters, restructure foreign keys, and write scalable clean migration scripts.",
      category: "Database Engineering",
      budget: 2500,
      clientId: "usr_client_jane",
      clientName: "Jane Cooper",
      createdAt: "2026-05-19T08:45:00.000Z",
      status: "hired",
      hiredFreelancerId: "usr_free_alex",
      hiredBidId: "bid_seed_alex",
      submittedFile: null,
      submittedComment: null,
      submittedAt: null
    },
    {
      id: "proj_seed_3",
      title: "Mobile App for Local Courier Service",
      description: "Develop a lightweight geolocational React Native or Flutter application to handle package tracking and customer delivery sheets. Clean modular backend hooks are pre-built.",
      category: "Mobile Applications",
      budget: 3000,
      clientId: "usr_client_jane",
      clientName: "Jane Cooper",
      createdAt: "2026-05-21T11:00:00.000Z",
      status: "submitted",
      hiredFreelancerId: "usr_free_alex",
      hiredBidId: "bid_seed_mobile",
      submittedFile: "courier_app_v1_0.zip",
      submittedComment: "All source files packaged. Live prototype link is embedded inside the readme file. Awaiting your approval!",
      submittedAt: "2026-05-21T18:30:00.000Z"
    }
  ],
  bids: [
    {
      id: "bid_seed_alex",
      projectId: "proj_seed_1",
      freelancerId: "usr_free_alex",
      freelancerName: "Alex Mercer",
      amount: 1100,
      timeline: "5 Days",
      pitch: "Hi Jane! I love white & green visual systems. I have built 4 SaaS financial interfaces with gorgeous custom styling and highly fluid grids. Let me know if you would like to see my catalog.",
      createdAt: "2026-05-20T12:30:00.000Z"
    },
    {
      id: "bid_seed_sarah",
      projectId: "proj_seed_1",
      freelancerId: "usr_free_sarah",
      freelancerName: "Sarah Jenkins",
      amount: 1200,
      timeline: "1 Week",
      pitch: "Hey there. I specialize in luxury minimalist corporate systems. I can translate your brand guides into responsive vectors directly. Ready to start immediately.",
      createdAt: "2026-05-20T14:10:00.000Z"
    },
    {
      id: "bid_seed_mobile",
      projectId: "proj_seed_3",
      freelancerId: "usr_free_alex",
      freelancerName: "Alex Mercer",
      amount: 3000,
      timeline: "2 Weeks",
      pitch: "Hired at standard price point.",
      createdAt: "2026-05-21T11:15:00.000Z"
    }
  ]
};

// Current Authentication Form State Helpers
let currentAuthRole = "client"; // "client" or "freelancer"
let currentAuthTab = "signup";   // "signup" or "login"

// ========================================================
// INITIALIZATION ENGINE
// ========================================================
document.addEventListener("DOMContentLoaded", () => {
  initDatabase();
  checkExistingSession();
  lucide.createIcons();
});

// Database LocalStorage Engine Syncing
function initDatabase() {
  const localDb = localStorage.getItem("lancerlink_db");
  if (localDb) {
    try {
      db = JSON.parse(localDb);
    } catch (e) {
      console.error("Database corruption detected. Re-initializing database...", e);
      resetDatabaseToSeed();
    }
  } else {
    resetDatabaseToSeed();
  }
}

function resetDatabaseToSeed() {
  db = JSON.parse(JSON.stringify(SEED_DATA));
  saveDatabase();
}

function saveDatabase() {
  localStorage.setItem("lancerlink_db", JSON.stringify(db));
}

// Session Check on Application Startup
function checkExistingSession() {
  if (db.activeSession) {
    const user = db.users.find(u => u.id === db.activeSession.id);
    if (user) {
      // Re-login current user
      loginUser(user, db.activeSession.role);
    } else {
      logout();
    }
  } else {
    showView("welcome-section");
  }
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

  // Apply colors dynamically
  toast.classList.add(...border.split(" "));
  container.appendChild(toast);
  lucide.createIcons();

  // Self destruction timeout
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
  // Hide all tab contents for this role
  const contents = document.querySelectorAll(`#${role}-dashboard-section .tab-content`);
  contents.forEach(c => {
    c.classList.remove("active");
  });

  // Deactivate all sidebar tab buttons
  const buttons = document.querySelectorAll(`#${role}-dashboard-section nav button`);
  buttons.forEach(b => {
    b.className = "w-full px-4 py-3 rounded-2xl text-left font-semibold text-sm flex items-center gap-3 transition-all duration-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800";
  });

  // Activate selected tab content
  const targetContent = document.getElementById(`${role}-tab-${tabName}`);
  if (targetContent) {
    targetContent.classList.add("active");
  }

  // Activate selected sidebar button
  const targetBtn = document.getElementById(`${role}-tab-${tabName}-btn`);
  if (targetBtn) {
    targetBtn.className = "w-full px-4 py-3 rounded-2xl text-left font-semibold text-sm flex items-center gap-3 transition-all duration-200 bg-brand-50 text-brand-700 shadow-sm border border-brand-100/40";
  }

  lucide.createIcons();
  
  // Specific Renders depending on tab activation
  if (role === "client" && tabName === "my-projects") {
    renderClientProjects();
  } else if (role === "freelancer" && tabName === "find-work") {
    renderLiveProjectFeed();
  } else if (role === "freelancer" && tabName === "workspace") {
    renderFreelancerWorkspace();
  }
}

// ========================================================
// AUTHENTICATION CONTROLLERS
// ========================================================
function openAuthModal(role) {
  currentAuthRole = role;
  currentAuthTab = "signup";
  
  const modal = document.getElementById("auth-modal");
  const modalTitle = document.getElementById("auth-modal-title");
  const roleBadge = document.getElementById("auth-role-badge");
  
  // Set badge and header
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
  
  // Clear forms
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

function handleAuthSubmit(event) {
  event.preventDefault();
  
  const emailInput = document.getElementById("auth-email").value.trim().toLowerCase();
  const passwordInput = document.getElementById("auth-password").value;
  const nameInput = document.getElementById("auth-name").value.trim();
  
  if (currentAuthTab === "signup") {
    // Signup Simulation
    // Verify user doesn't already exist
    const userExists = db.users.some(u => u.email === emailInput && u.role === currentAuthRole);
    if (userExists) {
      showToast("An account with this email already exists for this role.", "error");
      return;
    }

    const newUser = {
      id: "usr_" + Date.now(),
      email: emailInput,
      password: passwordInput,
      name: nameInput || "Un-named Ledger Entity",
      role: currentAuthRole,
      wallet: 0.00 // Default virtual balance of $0
    };

    db.users.push(newUser);
    saveDatabase();
    
    showToast(`Account registered successfully as ${newUser.name}!`, "success");
    loginUser(newUser, currentAuthRole);
  } else {
    // Login Simulation
    const matchedUser = db.users.find(u => u.email === emailInput && u.password === passwordInput && u.role === currentAuthRole);
    if (!matchedUser) {
      showToast("Invalid credentials or matching role not found.", "error");
      return;
    }

    showToast(`Welcome back, ${matchedUser.name}!`, "success");
    loginUser(matchedUser, currentAuthRole);
  }

  closeAuthModal();
}

function loginUser(user, role) {
  db.activeSession = {
    id: user.id,
    role: role
  };
  saveDatabase();

  if (role === "client") {
    // Setup Client Displays
    document.getElementById("client-username-display").textContent = user.name;
    updateClientWalletDisplay(user);
    showView("client-dashboard-section");
    switchTab("client", "my-projects");
  } else {
    // Setup Freelancer Displays
    document.getElementById("freelancer-username-display").textContent = user.name;
    updateFreelancerWalletDisplay(user);
    showView("freelancer-dashboard-section");
    switchTab("freelancer", "find-work");
  }
}

function logout() {
  db.activeSession = null;
  saveDatabase();
  showView("welcome-section");
  showToast("Logged out successfully.", "info");
}

// ========================================================
// CLIENT SIDE INTERACTION LOGIC
// ========================================================
function updateClientWalletDisplay(user) {
  const activeUser = user || db.users.find(u => u.id === db.activeSession.id);
  const display = document.getElementById("client-wallet-display");
  const portalDisplay = document.getElementById("wallet-portal-client-balance");
  
  if (display && activeUser) display.textContent = `$${activeUser.wallet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (portalDisplay && activeUser) portalDisplay.textContent = `$${activeUser.wallet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Update locked escrow funds quick stats
  updateClientEscrowStats(activeUser);
}

function updateClientEscrowStats(user) {
  const clientProjects = db.projects.filter(p => p.clientId === user.id);
  
  // Locked funds = Projects Hired/Submitted but not Completed yet
  let lockedFunds = 0;
  clientProjects.forEach(p => {
    if (p.status === "hired" || p.status === "submitted") {
      // Find matching bid that was hired
      const matchingBid = db.bids.find(b => b.id === p.hiredBidId);
      if (matchingBid) {
        lockedFunds += matchingBid.amount;
      }
    }
  });

  const lockedDisplay = document.getElementById("client-locked-funds-display");
  const lockedBar = document.getElementById("client-locked-funds-bar");

  if (lockedDisplay) {
    lockedDisplay.textContent = `$${lockedFunds.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  if (lockedBar) {
    // Display proportion of locked funds relative to client's liquid balance
    const totalFundsVal = user.wallet + lockedFunds;
    const pct = totalFundsVal > 0 ? (lockedFunds / totalFundsVal) * 100 : 0;
    lockedBar.style.width = `${pct}%`;
  }
}

// Deposit dummy funds into client wallet
function handleDeposit(event) {
  event.preventDefault();
  const amtInput = document.getElementById("deposit-amount");
  const depositVal = parseFloat(amtInput.value);

  if (isNaN(depositVal) || depositVal <= 0) {
    showToast("Please enter a valid deposit amount.", "error");
    return;
  }

  const user = db.users.find(u => u.id === db.activeSession.id);
  if (user) {
    user.wallet += depositVal;
    saveDatabase();
    updateClientWalletDisplay(user);
    showToast(`Instantly deposited $${depositVal.toLocaleString()} into your virtual wallet!`, "success");
    amtInput.value = "";
  }
}

function setQuickDeposit(amount) {
  document.getElementById("deposit-amount").value = amount;
}

function openDepositModal() {
  switchTab("client", "wallet-portal");
}

// Client Project Creation Flow
function handlePostProject(event) {
  event.preventDefault();

  const title = document.getElementById("post-title").value.trim();
  const category = document.getElementById("post-category").value;
  const budget = parseFloat(document.getElementById("post-budget").value);
  const description = document.getElementById("post-description").value.trim();

  if (!title || !category || isNaN(budget) || budget <= 0 || !description) {
    showToast("Please fill out all contract fields properly.", "error");
    return;
  }

  const clientUser = db.users.find(u => u.id === db.activeSession.id);

  const newProject = {
    id: "proj_" + Date.now(),
    title: title,
    description: description,
    category: category,
    budget: budget,
    clientId: clientUser.id,
    clientName: clientUser.name,
    createdAt: new Date().toISOString(),
    status: "open",
    hiredFreelancerId: null,
    hiredBidId: null,
    submittedFile: null,
    submittedComment: null,
    submittedAt: null
  };

  db.projects.push(newProject);
  saveDatabase();

  showToast("New marketplace contract created successfully!", "success");
  document.getElementById("post-project-form").reset();
  
  // Toggle tab and redraw
  switchTab("client", "my-projects");
}

// Dynamic Client Projects Rendering
function renderClientProjects() {
  const container = document.getElementById("client-projects-container");
  if (!container) return;

  const myProjects = db.projects.filter(p => p.clientId === db.activeSession.id);

  // Compute tab stats count
  document.getElementById("stat-client-open").textContent = myProjects.filter(p => p.status === "open").length;
  document.getElementById("stat-client-hired").textContent = myProjects.filter(p => p.status === "hired").length;
  document.getElementById("stat-client-review").textContent = myProjects.filter(p => p.status === "submitted").length;
  document.getElementById("stat-client-completed").textContent = myProjects.filter(p => p.status === "completed").length;

  if (myProjects.length === 0) {
    container.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-3xl p-12 text-center custom-shadow animate-fade-in-up">
        <div class="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4">
          <i data-lucide="folder-open" class="w-8 h-8"></i>
        </div>
        <h3 class="text-lg font-bold text-slate-900 mb-1">No Projects Found</h3>
        <p class="text-sm text-slate-400 max-w-sm mx-auto mb-6">Create a contract proposal and submit it to our worldwide network of high-caliber freelancers.</p>
        <button onclick="switchTab('client', 'post-project')" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-all shadow-sm">
          Create First Contract
        </button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Sort: open, submitted, hired, completed
  const statusWeight = { "submitted": 1, "open": 2, "hired": 3, "completed": 4 };
  myProjects.sort((a, b) => {
    if (statusWeight[a.status] !== statusWeight[b.status]) {
      return statusWeight[a.status] - statusWeight[b.status];
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  let html = "";

  myProjects.forEach(p => {
    // Badges & styling by status
    let statusBadge = "";
    let borderStyle = "border-slate-200";
    let footerHtml = "";

    if (p.status === "open") {
      statusBadge = `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 border border-blue-200 text-blue-600"><i data-lucide="search" class="w-3.5 h-3.5"></i> Open Bidding</span>`;
      
      // Check bids
      const projBids = db.bids.filter(b => b.projectId === p.id);
      if (projBids.length === 0) {
        footerHtml = `
          <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-semibold rounded-b-3xl">
            <span>No proposals submitted yet</span>
            <span class="flex items-center gap-1"><i data-lucide="users" class="w-4 h-4"></i> Freelancers are viewing</span>
          </div>
        `;
      } else {
        let bidsListHtml = "";
        projBids.forEach(b => {
          bidsListHtml += `
            <div class="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-3">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h5 class="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <div class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 font-extrabold uppercase">${b.freelancerName[0]}</div>
                    ${b.freelancerName}
                  </h5>
                  <p class="text-xs text-slate-400 font-semibold mt-1">Delivery Estimate: <span class="text-slate-700">${b.timeline}</span></p>
                </div>
                <div class="text-right">
                  <span class="text-base font-extrabold text-brand-600">$${b.amount.toLocaleString()}</span>
                  <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Proposed Rate</p>
                </div>
              </div>
              <p class="text-xs text-slate-600 leading-relaxed font-medium bg-white p-3.5 rounded-xl border border-slate-200/50 italic">"${b.pitch}"</p>
              
              <div class="flex items-center justify-end">
                <button onclick="handleHireClient('${p.id}', '${b.id}', ${b.amount})" class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition-all shadow-sm shadow-brand-600/10 hover:shadow-brand-500/20 flex items-center gap-1">
                  <i data-lucide="lock" class="w-3.5 h-3.5"></i>
                  Hire & Lock Escrow
                </button>
              </div>
            </div>
          `;
        });

        footerHtml = `
          <div class="px-6 py-5 bg-slate-50 border-t border-slate-100 rounded-b-3xl space-y-4">
            <h4 class="text-xs uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1">
              <i data-lucide="message-square" class="w-3.5 h-3.5 text-slate-400"></i>
              Active Bids (${projBids.length})
            </h4>
            <div class="space-y-3 max-h-96 overflow-y-auto pr-1">
              ${bidsListHtml}
            </div>
          </div>
        `;
      }

    } else if (p.status === "hired") {
      statusBadge = `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-600"><i data-lucide="clock" class="w-3.5 h-3.5"></i> In Progress (Escrow Locked)</span>`;
      borderStyle = "border-amber-200/80 bg-white";

      const matchedBid = db.bids.find(b => b.id === p.hiredBidId);
      const hiredName = matchedBid ? matchedBid.freelancerName : "Specialist";
      const hiredPrice = matchedBid ? matchedBid.amount : p.budget;

      footerHtml = `
        <div class="px-6 py-4 bg-amber-50/20 border-t border-amber-100/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs rounded-b-3xl">
          <span class="font-medium text-slate-500 flex items-center gap-1.5">
            <i data-lucide="user-check" class="w-4 h-4 text-amber-600"></i>
            Contractor: <strong class="text-slate-800">${hiredName}</strong>
          </span>
          <span class="font-bold text-amber-700 flex items-center gap-1.5">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 escrow-pulse shrink-0"></span>
            $${hiredPrice.toLocaleString()} locked in Escrow
          </span>
        </div>
      `;

    } else if (p.status === "submitted") {
      statusBadge = `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 border border-purple-200 text-purple-600"><i data-lucide="eye" class="w-3.5 h-3.5"></i> Deliverable Under Review</span>`;
      borderStyle = "border-purple-200 bg-white shadow-purple-50/20";

      const matchedBid = db.bids.find(b => b.id === p.hiredBidId);
      const hiredName = matchedBid ? matchedBid.freelancerName : "Specialist";
      const payoutVal = matchedBid ? matchedBid.amount : p.budget;

      footerHtml = `
        <div class="px-6 py-5 bg-purple-50/20 border-t border-purple-100 rounded-b-3xl space-y-4">
          <div class="bg-white border border-purple-200/80 p-4 rounded-2xl flex items-start gap-3">
            <div class="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <i data-lucide="file-archive" class="w-5 h-5"></i>
            </div>
            <div class="flex-grow">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold text-slate-900 font-mono">${p.submittedFile}</span>
                <span class="text-[10px] text-slate-400 font-semibold">${new Date(p.submittedAt).toLocaleDateString()}</span>
              </div>
              <p class="text-xs text-slate-500 mt-1 italic font-medium leading-relaxed">"${p.submittedComment}"</p>
            </div>
          </div>
          
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <span class="text-xs text-slate-400 font-semibold">Approved work releases <strong class="text-emerald-600">$${payoutVal.toLocaleString()}</strong> instantly.</span>
            <button onclick="handleAcceptPayment('${p.id}', ${payoutVal})" class="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition-all shadow-md shadow-brand-600/10 hover:shadow-brand-500/20 flex items-center gap-1.5">
              <i data-lucide="unlock" class="w-4 h-4"></i>
              Accept & Release Funds
            </button>
          </div>
        </div>
      `;

    } else if (p.status === "completed") {
      statusBadge = `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-brand-50 border border-brand-200 text-brand-600"><i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Completed & Released</span>`;
      
      const matchedBid = db.bids.find(b => b.id === p.hiredBidId);
      const hiredName = matchedBid ? matchedBid.freelancerName : "Specialist";
      const releasedAmt = matchedBid ? matchedBid.amount : p.budget;

      footerHtml = `
        <div class="px-6 py-5 bg-brand-50/20 border-t border-brand-100 rounded-b-3xl space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p class="text-xs font-bold text-slate-800">Contract finalized by ${hiredName}</p>
              <p class="text-[10px] text-slate-400 font-semibold">Ledger receipt: $${releasedAmt.toLocaleString()} credited successfully.</p>
            </div>
            <button onclick="simulateDeliverableDownload('${p.title}', '${p.submittedFile || 'deliverable.zip'}')" class="deliverable-link px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-brand-500 hover:bg-brand-50 text-slate-700 hover:text-brand-600 font-semibold text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-sm">
              <i data-lucide="download" class="w-4 h-4"></i>
              Download Deliverable
            </button>
          </div>
        </div>
      `;
    }

    html += `
      <div class="bg-white border ${borderStyle} rounded-3xl custom-shadow animate-fade-in-up">
        <div class="p-6 md:p-8 space-y-4">
          <div class="flex items-start justify-between gap-4">
            <span class="text-xs uppercase font-extrabold tracking-wider text-slate-400">${p.category}</span>
            ${statusBadge}
          </div>
          
          <h3 class="text-xl font-bold text-slate-950">${p.title}</h3>
          <p class="text-sm text-slate-500 font-medium leading-relaxed font-sans">${p.description}</p>
          
          <div class="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100/60">
            <span class="text-xs text-slate-400 font-semibold">Contract Budget</span>
            <span class="text-lg font-black text-slate-900">$${p.budget.toLocaleString()}</span>
          </div>
        </div>
        ${footerHtml}
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons();
}

// Client Hires Freelancer -> Locks Escrow
function handleHireClient(projectId, bidId, amount) {
  const clientUser = db.users.find(u => u.id === db.activeSession.id);
  
  if (clientUser.wallet < amount) {
    showToast(`Insufficient balance to cover bid budget ($${amount.toLocaleString()}). Please Deposit Funds!`, "error");
    switchTab("client", "wallet-portal");
    return;
  }

  // Deduct Client Wallet
  clientUser.wallet -= amount;

  // Update Project Status
  const project = db.projects.find(p => p.id === projectId);
  if (project) {
    project.status = "hired";
    project.hiredFreelancerId = db.bids.find(b => b.id === bidId).freelancerId;
    project.hiredBidId = bidId;
  }

  saveDatabase();
  updateClientWalletDisplay(clientUser);
  renderClientProjects();

  showToast(`Contract awarded! $${amount.toLocaleString()} securely locked in LancerLink Escrow.`, "success");
}

// Client releases payment upon review
function handleAcceptPayment(projectId, amount) {
  const project = db.projects.find(p => p.id === projectId);
  if (!project) return;

  const freelancer = db.users.find(u => u.id === project.hiredFreelancerId);
  if (freelancer) {
    // Release locked escrow budget to freelancer
    freelancer.wallet += amount;
  }

  project.status = "completed";
  saveDatabase();

  updateClientWalletDisplay();
  renderClientProjects();

  showToast(`Payment released successfully! $${amount.toLocaleString()} transferred directly to ${freelancer ? freelancer.name : 'freelancer'}.`, "success");
}

// Simulated deliverables downloader (Creates a real browser download anchor dynamically)
function simulateDeliverableDownload(projectTitle, fileName) {
  const dataContent = `LANCERLINK CONTRACT DELIVERABLE RECEIPT
===================================================
Project: ${projectTitle}
Deliverable File Name: ${fileName}
Ledger Transaction Hash: ll_hash_${Date.now().toString(36)}
Status: PAYMENT RELEASED & VERIFIED BY SANDBOX LEDGER
Date of Delivery: ${new Date().toLocaleDateString()}

Thank you for utilizing the LancerLink decentralized marketplace protocol!`;

  const blob = new Blob([dataContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lancerlink_deliverable_${fileName.replace(/\.[^/.]+$/, "")}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  showToast("Deliverable simulation downloaded successfully!", "info");
}

// ========================================================
// FREELANCER SIDE INTERACTION LOGIC
// ========================================================
function updateFreelancerWalletDisplay(user) {
  const activeUser = user || db.users.find(u => u.id === db.activeSession.id);
  const display = document.getElementById("freelancer-wallet-display");
  const portalDisplay = document.getElementById("wallet-portal-freelancer-balance");
  
  if (display && activeUser) display.textContent = `$${activeUser.wallet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (portalDisplay && activeUser) portalDisplay.textContent = `$${activeUser.wallet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Update pending escrow quick display
  updateFreelancerEscrowStats(activeUser);
}

function updateFreelancerEscrowStats(user) {
  const myContracts = db.projects.filter(p => p.hiredFreelancerId === user.id);
  
  // Locked pending escrow funds
  let pendingEscrow = 0;
  myContracts.forEach(p => {
    if (p.status === "hired" || p.status === "submitted") {
      const matchBid = db.bids.find(b => b.id === p.hiredBidId);
      if (matchBid) {
        pendingEscrow += matchBid.amount;
      }
    }
  });

  const display = document.getElementById("freelancer-locked-funds-display");
  const bar = document.getElementById("freelancer-locked-funds-bar");

  if (display) {
    display.textContent = `$${pendingEscrow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (bar) {
    const totalVal = user.wallet + pendingEscrow;
    const pct = totalVal > 0 ? (pendingEscrow / totalVal) * 100 : 0;
    bar.style.width = `${pct}%`;
  }
}

// Freelancer Earnings Withdrawal simulation
function handleWithdraw(event) {
  event.preventDefault();
  
  const amtInput = document.getElementById("withdraw-amount");
  const routeSelect = document.getElementById("withdraw-bank");
  const amountVal = parseFloat(amtInput.value);

  if (isNaN(amountVal) || amountVal <= 0) {
    showToast("Please enter a valid payout amount.", "error");
    return;
  }

  const user = db.users.find(u => u.id === db.activeSession.id);
  if (user) {
    if (user.wallet < amountVal) {
      showToast("Insufficient sandbox balance to fulfill payout.", "error");
      return;
    }

    user.wallet -= amountVal;
    saveDatabase();
    
    updateFreelancerWalletDisplay(user);
    amtInput.value = "";

    showToast(`Withdrawal of $${amountVal.toLocaleString()} initiated to ${routeSelect.value}! Funds clearing instantly.`, "success");
  }
}

// Live Project Feed Rendering
function renderLiveProjectFeed() {
  const container = document.getElementById("freelancer-feed-container");
  if (!container) return;

  const searchVal = document.getElementById("work-search").value.trim().toLowerCase();
  const categoryFilter = document.getElementById("work-filter-category").value;

  const currentFreelancerId = db.activeSession.id;

  // Filter open projects
  let openProjects = db.projects.filter(p => p.status === "open");

  if (categoryFilter) {
    openProjects = openProjects.filter(p => p.category === categoryFilter);
  }

  if (searchVal) {
    openProjects = openProjects.filter(p => 
      p.title.toLowerCase().includes(searchVal) || 
      p.description.toLowerCase().includes(searchVal) ||
      p.clientName.toLowerCase().includes(searchVal)
    );
  }

  if (openProjects.length === 0) {
    container.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-3xl p-12 text-center custom-shadow animate-fade-in-up">
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

  // Sort by date newest
  openProjects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  let html = "";

  openProjects.forEach(p => {
    // Check if freelancer already has an active bid on this project
    const myBid = db.bids.find(b => b.projectId === p.id && b.freelancerId === currentFreelancerId);
    let bidActionHtml = "";

    if (myBid) {
      bidActionHtml = `
        <div class="flex items-center gap-3">
          <span class="text-xs text-brand-600 font-bold bg-brand-50 border border-brand-200/50 px-3.5 py-2 rounded-xl">
            You Bid: $${myBid.amount.toLocaleString()} (${myBid.timeline})
          </span>
          <button onclick="openBidModal('${p.id}')" class="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-brand-500 text-slate-600 hover:text-brand-600 font-bold text-xs transition-all">
            Revise Proposal
          </button>
        </div>
      `;
    } else {
      bidActionHtml = `
        <button onclick="openBidModal('${p.id}')" class="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition-all shadow-sm shadow-brand-600/10 hover:shadow-brand-500/20">
          Submit Contract Proposal
        </button>
      `;
    }

    // Date formatting
    const timeString = new Date(p.createdAt).toLocaleDateString();

    html += `
      <div class="bg-white border border-slate-200 rounded-3xl custom-shadow hover:border-brand-500/30 transition-all duration-300 p-6 md:p-8 space-y-4 animate-fade-in-up">
        <div class="flex items-start justify-between gap-4">
          <div>
            <span class="text-xs uppercase font-extrabold tracking-wider text-slate-400">${p.category}</span>
            <h4 class="text-[10px] text-slate-400 font-semibold mt-1">Contract by: <strong class="text-slate-600 font-bold">${p.clientName}</strong> &bull; Posted ${timeString}</h4>
          </div>
          <span class="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-200/30">Escrow Validated</span>
        </div>
        
        <h3 class="text-xl font-bold text-slate-950">${p.title}</h3>
        <p class="text-sm text-slate-500 leading-relaxed font-medium font-sans">${p.description}</p>
        
        <div class="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div class="flex items-baseline gap-1">
            <span class="text-2xl font-black text-slate-900">$${p.budget.toLocaleString()}</span>
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client Budget Cap</span>
          </div>
          
          ${bidActionHtml}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons();
}

// Bidding modal logic
function openBidModal(projectId) {
  const project = db.projects.find(p => p.id === projectId);
  if (!project) return;

  const currentFreelancerId = db.activeSession.id;

  document.getElementById("bid-project-id").value = project.id;
  document.getElementById("bid-modal-project-title").textContent = project.title;
  document.getElementById("bid-modal-client-name").textContent = project.clientName;
  document.getElementById("bid-modal-project-budget").textContent = `$${project.budget.toLocaleString()}`;

  // Check if revising
  const existingBid = db.bids.find(b => b.projectId === project.id && b.freelancerId === currentFreelancerId);
  const amountInput = document.getElementById("bid-amount");
  const timelineSelect = document.getElementById("bid-timeline");
  const pitchText = document.getElementById("bid-pitch");

  if (existingBid) {
    amountInput.value = existingBid.amount;
    timelineSelect.value = existingBid.timeline;
    pitchText.value = existingBid.pitch;
  } else {
    // Fill defaults
    amountInput.value = project.budget;
    timelineSelect.value = "5 Days";
    pitchText.value = "";
  }

  const modal = document.getElementById("bid-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeBidModal() {
  const modal = document.getElementById("bid-modal");
  modal.classList.remove("flex");
  modal.classList.add("hidden");
  document.getElementById("bid-form").reset();
}

function handleBidSubmit(event) {
  event.preventDefault();

  const projectId = document.getElementById("bid-project-id").value;
  const bidAmt = parseFloat(document.getElementById("bid-amount").value);
  const timeline = document.getElementById("bid-timeline").value;
  const pitch = document.getElementById("bid-pitch").value.trim();

  if (isNaN(bidAmt) || bidAmt <= 0 || !timeline || !pitch) {
    showToast("Please complete the bidding parameters properly.", "error");
    return;
  }

  const activeFreelancer = db.users.find(u => u.id === db.activeSession.id);

  // Check if bid exists to revise it
  const existingBidIndex = db.bids.findIndex(b => b.projectId === projectId && b.freelancerId === activeFreelancer.id);

  if (existingBidIndex > -1) {
    // Revise existing bid
    db.bids[existingBidIndex].amount = bidAmt;
    db.bids[existingBidIndex].timeline = timeline;
    db.bids[existingBidIndex].pitch = pitch;
    db.bids[existingBidIndex].createdAt = new Date().toISOString();
    showToast("Proposal specifications revised successfully!", "success");
  } else {
    // Create new bid
    const newBid = {
      id: "bid_" + Date.now(),
      projectId: projectId,
      freelancerId: activeFreelancer.id,
      freelancerName: activeFreelancer.name,
      amount: bidAmt,
      timeline: timeline,
      pitch: pitch,
      createdAt: new Date().toISOString()
    };
    db.bids.push(newBid);
    showToast("Proposal transmitted! Securing communications.", "success");
  }

  saveDatabase();
  closeBidModal();
  renderLiveProjectFeed();
}

// Freelancer Workspace Render
function renderFreelancerWorkspace() {
  const container = document.getElementById("freelancer-workspace-container");
  if (!container) return;

  const currentFreelancerId = db.activeSession.id;

  // Filter projects where hired
  const hiredProjects = db.projects.filter(p => p.hiredFreelancerId === currentFreelancerId);

  if (hiredProjects.length === 0) {
    container.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-3xl p-12 text-center custom-shadow animate-fade-in-up">
        <div class="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4">
          <i data-lucide="laptop" class="w-8 h-8"></i>
        </div>
        <h3 class="text-lg font-bold text-slate-900 mb-1">Workspace Currently Empty</h3>
        <p class="text-sm text-slate-400 max-w-sm mx-auto mb-6">Bid on available marketplace contracts to secure active workspace assignments.</p>
        <button onclick="switchTab('freelancer', 'find-work')" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-all shadow-sm">
          Browse Contracts
        </button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Sort workspace tasks
  const statusWeight = { "hired": 1, "submitted": 2, "completed": 3 };
  hiredProjects.sort((a, b) => statusWeight[a.status] - statusWeight[b.status]);

  let html = "";

  hiredProjects.forEach(p => {
    let cardBorder = "border-slate-200";
    let badgeHtml = "";
    let actionAreaHtml = "";

    const matchedBid = db.bids.find(b => b.id === p.hiredBidId);
    const lockedEscrowVal = matchedBid ? matchedBid.amount : p.budget;

    if (p.status === "hired") {
      cardBorder = "border-amber-200/80 bg-white";
      badgeHtml = `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-600"><i data-lucide="clock" class="w-3.5 h-3.5"></i> Contract Active</span>`;
      
      actionAreaHtml = `
        <div class="px-6 py-5 bg-amber-50/20 border-t border-amber-100/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-b-3xl">
          <span class="text-xs text-amber-800 font-bold flex items-center gap-1">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 escrow-pulse shrink-0"></span>
            $${lockedEscrowVal.toLocaleString()} secured in LancerLink Escrow
          </span>
          <button onclick="openSubmitWorkModal('${p.id}')" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 flex items-center gap-1.5">
            <i data-lucide="check" class="w-4 h-4"></i>
            Deliver Finished Deliverable
          </button>
        </div>
      `;
    } else if (p.status === "submitted") {
      cardBorder = "border-purple-200/80 bg-white shadow-purple-50/20";
      badgeHtml = `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 border border-purple-200 text-purple-600"><i data-lucide="refresh-cw" class="w-3.5 h-3.5 animate-spin"></i> Delivered & Awaiting Client Review</span>`;

      actionAreaHtml = `
        <div class="px-6 py-5 bg-purple-50/20 border-t border-purple-100 rounded-b-3xl space-y-3">
          <div class="bg-white border border-purple-200 p-4 rounded-2xl flex items-start gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <i data-lucide="file-archive" class="w-4.5 h-4.5"></i>
            </div>
            <div>
              <p class="text-xs font-bold text-slate-800 font-mono">${p.submittedFile}</p>
              <p class="text-xs text-slate-500 mt-1 leading-relaxed font-medium italic">"${p.submittedComment}"</p>
            </div>
          </div>
          <p class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider text-right">Awaiting instant payment unlock</p>
        </div>
      `;
    } else if (p.status === "completed") {
      badgeHtml = `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-brand-50 border border-brand-200 text-brand-600"><i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Paid & Finalized</span>`;
      
      actionAreaHtml = `
        <div class="px-6 py-4 bg-brand-50/20 border-t border-brand-100 rounded-b-3xl flex items-center justify-between text-xs text-brand-800 font-bold">
          <span>Funds successfully credited to your wallet</span>
          <span class="flex items-center gap-1 text-emerald-600">
            <i data-lucide="badge-check" class="w-4 h-4"></i>
            +$${lockedEscrowVal.toLocaleString()} Earnings Cleared
          </span>
        </div>
      `;
    }

    html += `
      <div class="bg-white border ${cardBorder} rounded-3xl custom-shadow animate-fade-in-up">
        <div class="p-6 md:p-8 space-y-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <span class="text-xs uppercase font-extrabold tracking-wider text-slate-400">${p.category}</span>
              <p class="text-[10px] text-slate-400 font-semibold mt-1">Client Contract: <strong class="font-bold text-slate-600">${p.clientName}</strong></p>
            </div>
            ${badgeHtml}
          </div>

          <h3 class="text-xl font-bold text-slate-950">${p.title}</h3>
          <p class="text-sm text-slate-500 font-medium leading-relaxed font-sans">${p.description}</p>
          
          <div class="flex items-center justify-between border-t border-slate-100 pt-3">
            <span class="text-xs text-slate-400 font-semibold">Contract Budget</span>
            <span class="text-lg font-black text-slate-900">$${lockedEscrowVal.toLocaleString()}</span>
          </div>
        </div>
        ${actionAreaHtml}
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons();
}

// Open Deliver work modal
function openSubmitWorkModal(projectId) {
  const project = db.projects.find(p => p.id === projectId);
  if (!project) return;

  const matchedBid = db.bids.find(b => b.id === project.hiredBidId);
  const rate = matchedBid ? matchedBid.amount : project.budget;

  document.getElementById("submit-work-project-id").value = project.id;
  document.getElementById("submit-work-project-title").textContent = project.title;
  document.getElementById("submit-work-project-budget").textContent = `$${rate.toLocaleString()}`;
  document.getElementById("submit-filename").value = project.category.toLowerCase().replace(/\s+/g, '_') + "_deliverables.zip";

  const modal = document.getElementById("submit-work-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeSubmitWorkModal() {
  const modal = document.getElementById("submit-work-modal");
  modal.classList.remove("flex");
  modal.classList.add("hidden");
  document.getElementById("submit-work-form").reset();
}

function handleSubmitWork(event) {
  event.preventDefault();

  const projectId = document.getElementById("submit-work-project-id").value;
  const fileType = document.getElementById("submit-file-type").value;
  const filename = document.getElementById("submit-filename").value.trim() || fileType;
  const comment = document.getElementById("submit-comment").value.trim();

  if (!projectId || !filename || !comment) {
    showToast("Please fill out all delivery fields properly.", "error");
    return;
  }

  const project = db.projects.find(p => p.id === projectId);
  if (project) {
    project.status = "submitted";
    project.submittedFile = filename;
    project.submittedComment = comment;
    project.submittedAt = new Date().toISOString();
  }

  saveDatabase();
  closeSubmitWorkModal();
  updateFreelancerWalletDisplay();
  renderFreelancerWorkspace();

  showToast("Deliverable successfully submitted! Awaiting client payment release trigger.", "success");
}
