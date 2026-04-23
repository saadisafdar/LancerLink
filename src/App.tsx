import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  Search, 
  Wallet as WalletIcon,
  Briefcase,
  User as UserIcon,
  LogOut,
  Bell,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Role, User, Project, Bid, Transaction, AppState } from './types';
import { Splash } from './components/Splash';
import { PortalSelection } from './components/PortalSelection';
import { Auth } from './components/Auth';
import { Wallet } from './components/Wallet';
import { ProjectCard } from './components/ProjectCard';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [portal, setPortal] = useState<Role | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'wallet' | 'my-projects' | 'hired'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // --- Data Persistence ---
  useEffect(() => {
    const data: AppState = JSON.parse(localStorage.getItem('lancerlink_v3') || '{"users":[],"projects":[],"bids":[],"transactions":[]}');
    setUsers(data.users);
    setProjects(data.projects);
    setBids(data.bids);
    setTransactions(data.transactions);

    const savedUser = localStorage.getItem('lancerlink_user_v3');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      setPortal(parsed.role);
    }
  }, []);

  useEffect(() => {
    const data: AppState = { users, projects, bids, transactions };
    localStorage.setItem('lancerlink_v3', JSON.stringify(data));
    if (user) {
      const syncedUser = users.find(u => u.id === user.id);
      if (syncedUser) localStorage.setItem('lancerlink_user_v3', JSON.stringify(syncedUser));
    } else {
      localStorage.removeItem('lancerlink_user_v3');
    }
  }, [users, projects, bids, transactions, user]);

  // --- Handlers ---
  const handleLogout = () => {
    setUser(null);
    setPortal(null);
    setActiveTab('dashboard');
  };

  const handleWalletAction = (type: 'add' | 'withdraw', amount: number) => {
    if (!user) return;
    
    // Update Balances
    const updatedUsers = users.map(u => {
      if (u.id === user.id) {
        return { ...u, balance: type === 'add' ? u.balance + amount : u.balance - amount };
      }
      return u;
    });
    setUsers(updatedUsers);

    // Record Transaction
    const t: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      userId: user.id,
      amount,
      type: type === 'add' ? 'credit' : 'debit',
      description: type === 'add' ? 'Added funds to wallet' : 'Withdrew earnings',
      date: new Date().toISOString()
    };
    setTransactions([t, ...transactions]);
  };

  const postProject = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const newProject: Project = {
      id: Math.random().toString(36).substr(2, 9),
      ownerId: user.id,
      ownerName: user.name,
      ownerRole: user.role,
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      budget: Number(formData.get('budget')),
      category: formData.get('category') as string,
      deadline: formData.get('deadline') as string,
      createdAt: new Date().toISOString(),
      status: 'Open',
      attachments: []
    };
    setProjects([newProject, ...projects]);
    setIsModalOpen(false);
  };

  const submitBid = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !selectedProject) return;
    const formData = new FormData(e.currentTarget);
    const newBid: Bid = {
      id: Math.random().toString(36).substr(2, 9),
      projectId: selectedProject.id,
      bidderId: user.id,
      bidderName: user.name,
      bidderRole: user.role,
      amount: Number(formData.get('amount')),
      deliveryDays: Number(formData.get('days')),
      notes: formData.get('notes') as string,
      createdAt: new Date().toISOString()
    };
    setBids([...bids, newBid]);
    setSelectedProject(null);
  };

  const handleHire = (bid: Bid) => {
    setProjects(prev => prev.map(p => 
      p.id === bid.projectId ? { ...p, status: 'Hired', hiredUserId: bid.bidderId } : p
    ));
    setSelectedProject(null);
  };

  const handleFileUpload = (project: Project, files: FileList) => {
    const readers = Array.from(files).map(file => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const attachment = {
            name: file.name,
            data: e.target?.result as string,
            type: file.type
          };
          setProjects(prev => prev.map(p => 
            p.id === project.id ? { ...p, attachments: [...p.attachments, attachment] } : p
          ));
          resolve();
        };
        reader.readAsDataURL(file);
      });
    });
    Promise.all(readers);
  };

  const handleAcceptSubmission = (project: Project) => {
    const bid = bids.find(b => b.projectId === project.id && b.bidderId === project.hiredUserId);
    if (!bid) return;

    // Standard flow: Client (Owner) pays Freelancer (Hired)
    const payer = users.find(u => u.id === project.ownerId);
    if (!payer || payer.balance < bid.amount) {
      alert("Insufficient funds in your wallet to approve this payment. Please add funds.");
      return;
    }

    // Update Project status
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, status: 'Completed' } : p));

    // Update Balances
    const updatedUsers = users.map(u => {
      if (u.id === payer.id) return { ...u, balance: u.balance - bid.amount };
      if (u.id === project.hiredUserId) return { ...u, balance: u.balance + bid.amount };
      return u;
    });
    setUsers(updatedUsers);

    // Record Transactions
    const tDebit: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      userId: payer.id,
      amount: bid.amount,
      type: 'debit',
      description: `Payment for approving ${project.title}`,
      date: new Date().toISOString()
    };
    const tCredit: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      userId: project.hiredUserId!,
      amount: bid.amount,
      type: 'credit',
      description: `Earnings for ${project.title}`,
      date: new Date().toISOString()
    };
    setTransactions([tDebit, tCredit, ...transactions]);
  };

  // --- Views ---
  if (showSplash) return <Splash onComplete={() => setShowSplash(false)} />;
  if (!portal && !user) return <PortalSelection onSelect={setPortal} />;
  if (portal && !user) return (
    <Auth 
      role={portal} 
      users={users} 
      onSetUsers={setUsers} 
      onAuth={setUser} 
      onBack={() => setPortal(null)} 
    />
  );

  const currentUser = users.find(u => u.id === user?.id) || user!;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <nav className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <span className="text-xl font-bold tracking-tight text-gray-900">Lancer<span className="text-green-600">Link</span></span>
              
              {/* Navigation Tabs based on Role */}
              <div className="hidden md:flex gap-6">
                {currentUser.role === 'client' ? (
                  <>
                    <button onClick={() => setActiveTab('dashboard')} className={`text-sm font-semibold transition-colors ${activeTab === 'dashboard' ? 'text-green-600' : 'text-gray-500 hover:text-gray-900'}`}>Projects</button>
                    <button onClick={() => setActiveTab('my-projects')} className={`text-sm font-semibold transition-colors ${activeTab === 'my-projects' ? 'text-green-600' : 'text-gray-500 hover:text-gray-900'}`}>Project Management</button>
                    <button onClick={() => setActiveTab('wallet')} className={`text-sm font-semibold transition-colors ${activeTab === 'wallet' ? 'text-green-600' : 'text-gray-500 hover:text-gray-900'}`}>Wallet</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setActiveTab('dashboard')} className={`text-sm font-semibold transition-colors ${activeTab === 'dashboard' ? 'text-green-600' : 'text-gray-500 hover:text-gray-900'}`}>Feed</button>
                    <button onClick={() => setActiveTab('my-projects')} className={`text-sm font-semibold transition-colors ${activeTab === 'my-projects' ? 'text-green-600' : 'text-gray-500 hover:text-gray-900'}`}>My Bids</button>
                    <button onClick={() => setActiveTab('hired')} className={`text-sm font-semibold transition-colors ${activeTab === 'hired' ? 'text-green-600' : 'text-gray-500 hover:text-gray-900'}`}>Hired Projects</button>
                    <button onClick={() => setActiveTab('wallet')} className={`text-sm font-semibold transition-colors ${activeTab === 'wallet' ? 'text-green-600' : 'text-gray-500 hover:text-gray-900'}`}>Wallet</button>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-900">{currentUser.name}</p>
                <span className="text-[10px] font-bold uppercase text-green-600 tracking-widest leading-none">{currentUser.role} portal</span>
              </div>
              <div className="w-px h-8 bg-gray-200 mx-2 hidden sm:block" />
              <button onClick={handleLogout} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {currentUser.role === 'client' ? 'All Posted Projects' : 'Available Projects'}
                </h2>
                {currentUser.role === 'client' && (
                  <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2"><PlusCircle className="w-5 h-5" />New Project</button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4">
                {(currentUser.role === 'client' 
                  ? projects.filter(p => p.ownerId === currentUser.id && p.status === 'Open')
                  : projects.filter(p => p.status === 'Open')
                ).length === 0 ? (
                  <div className="glass-card p-12 text-center text-gray-500">No projects to display.</div>
                ) : (
                  (currentUser.role === 'client' 
                    ? projects.filter(p => p.ownerId === currentUser.id && p.status === 'Open')
                    : projects.filter(p => p.status === 'Open')
                  ).map(p => (
                    <ProjectCard key={p.id} project={p} user={currentUser} bids={bids} onAction={setSelectedProject} onUpload={handleFileUpload} onAccept={handleAcceptSubmission} />
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'my-projects' && (
            <motion.div key="mgmt" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {currentUser.role === 'client' ? 'Project Management' : 'My Active Bids'}
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {(currentUser.role === 'client' 
                  ? projects.filter(p => p.ownerId === currentUser.id && p.status !== 'Open')
                  : projects.filter(p => bids.some(b => b.bidderId === currentUser.id && b.projectId === p.id) && p.status === 'Open')
                ).length === 0 ? (
                  <div className="glass-card p-12 text-center text-gray-500">No activity yet.</div>
                ) : (
                  (currentUser.role === 'client' 
                    ? projects.filter(p => p.ownerId === currentUser.id && p.status !== 'Open')
                    : projects.filter(p => bids.some(b => b.bidderId === currentUser.id && b.projectId === p.id) && p.status === 'Open')
                  ).map(p => (
                    <ProjectCard key={p.id} project={p} user={currentUser} bids={bids} onAction={setSelectedProject} onUpload={handleFileUpload} onAccept={handleAcceptSubmission} />
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'hired' && currentUser.role === 'freelancer' && (
            <motion.div key="hired" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Hired Projects</h2>
              <div className="grid grid-cols-1 gap-4">
                {projects.filter(p => p.hiredUserId === currentUser.id).length === 0 ? (
                  <div className="glass-card p-12 text-center text-gray-500">You haven't been hired yet. Keep bidding!</div>
                ) : (
                  projects.filter(p => p.hiredUserId === currentUser.id).map(p => (
                    <ProjectCard key={p.id} project={p} user={currentUser} bids={bids} onAction={setSelectedProject} onUpload={handleFileUpload} onAccept={handleAcceptSubmission} />
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'wallet' && (
            <motion.div key="wallet" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Wallet user={currentUser} transactions={transactions} onAction={handleWalletAction} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* --- Modals --- */}
      <AnimatePresence>
        {isModalOpen && currentUser.role === 'client' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg glass-card p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Post New Project</h2>
              <form onSubmit={postProject} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Title</label>
                  <input name="title" required placeholder="e.g. Build an E-commerce Site" className="input-field w-full mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Category</label>
                    <select name="category" className="input-field w-full mt-1"><option>Web Development</option><option>Design</option><option>Writing</option></select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Budget ($)</label>
                    <input name="budget" required type="number" placeholder="500" className="input-field w-full mt-1" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Deadline</label>
                  <input name="deadline" required type="date" className="input-field w-full mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
                  <textarea name="description" required rows={4} placeholder="Description..." className="input-field w-full mt-1 resize-none" />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">Post Project</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {selectedProject && currentUser.role === 'freelancer' && selectedProject.status === 'Open' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedProject(null)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md glass-card p-8">
              <h3 className="text-xl font-bold mb-4 text-gray-900">Submit Bid</h3>
              <p className="text-sm text-gray-500 mb-4 truncate">For: <span className="font-semibold text-gray-900">{selectedProject.title}</span></p>
              <form onSubmit={submitBid} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Bid Amount ($)</label>
                    <input name="amount" required type="number" placeholder="400" className="input-field w-full mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Delivery Time (Days)</label>
                    <input name="days" required type="number" placeholder="7" className="input-field w-full mt-1" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Proposal Notes</label>
                  <textarea name="notes" rows={3} placeholder="Why should they hire you?" className="input-field w-full mt-1 resize-none" />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setSelectedProject(null)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">Submit Proposal</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {selectedProject && currentUser.role === 'client' && selectedProject.status === 'Open' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedProject(null)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl glass-card p-8 max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-2 text-gray-900">Review Bids</h3>
              <p className="text-sm text-gray-500 mb-6 font-medium">{selectedProject.title}</p>
              
              <div className="space-y-4">
                {bids.filter(b => b.projectId === selectedProject.id).length === 0 ? <p className="text-gray-500 text-center py-8">No bids received yet.</p> :
                 bids.filter(b => b.projectId === selectedProject.id).map(bid => (
                   <div key={bid.id} className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                     <div className="flex items-start justify-between gap-4">
                       <div>
                         <p className="font-bold text-gray-900">{bid.bidderName}</p>
                         <p className="text-xs text-gray-500 mt-1">${bid.amount} • {bid.deliveryDays} days delivery</p>
                         {bid.notes && <p className="text-sm text-gray-700 mt-3 p-3 bg-white border border-gray-100 rounded-lg">{bid.notes}</p>}
                       </div>
                       <div className="text-right whitespace-nowrap">
                         <button onClick={() => handleHire(bid)} className="btn-primary py-1.5 px-6 text-sm">Hire</button>
                       </div>
                     </div>
                   </div>
                 ))}
              </div>
              <div className="mt-6 text-right">
                <button onClick={() => setSelectedProject(null)} className="btn-secondary">Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="py-8 text-center text-gray-500 text-sm border-t border-gray-200 mt-auto bg-white">
        © 2026 LancerLink • Web Platform
      </footer>
    </div>
  );
}
