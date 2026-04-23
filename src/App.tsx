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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'wallet' | 'my-projects'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // --- Data Persistence ---
  useEffect(() => {
    const data: AppState = JSON.parse(localStorage.getItem('lancerlink_v2') || '{"users":[],"projects":[],"bids":[],"transactions":[]}');
    setUsers(data.users);
    setProjects(data.projects);
    setBids(data.bids);
    setTransactions(data.transactions);

    const savedUser = localStorage.getItem('lancerlink_user_v2');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      setPortal(parsed.role);
    }
  }, []);

  useEffect(() => {
    const data: AppState = { users, projects, bids, transactions };
    localStorage.setItem('lancerlink_v2', JSON.stringify(data));
    if (user) {
      // Keep local user in sync with users list (e.g. balance changes)
      const syncedUser = users.find(u => u.id === user.id);
      if (syncedUser) localStorage.setItem('lancerlink_user_v2', JSON.stringify(syncedUser));
    } else {
      localStorage.removeItem('lancerlink_user_v2');
    }
  }, [users, projects, bids, transactions, user]);

  // --- Handlers ---
  const handleLogout = () => {
    setUser(null);
    setPortal(null);
    setActiveTab('dashboard');
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

    // The Client (Bidder) is the one paying in this reversed model based on the balance deduction requirement
    const payer = users.find(u => u.id === bid.bidderId);
    if (!payer || payer.balance < bid.amount) {
      alert("Client insufficient funds!");
      return;
    }

    // Update Project
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, status: 'Completed' } : p));

    // Update Balances
    const updatedUsers = users.map(u => {
      if (u.id === payer.id) return { ...u, balance: u.balance - bid.amount };
      if (u.id === project.ownerId) return { ...u, balance: u.balance + bid.amount };
      return u;
    });
    setUsers(updatedUsers);

    // Record Transactions
    const tDebit: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      userId: payer.id,
      amount: bid.amount,
      type: 'debit',
      description: `Payment for ${project.title}`,
      date: new Date().toISOString()
    };
    const tCredit: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      userId: project.ownerId,
      amount: bid.amount,
      type: 'credit',
      description: `Received payment for ${project.title}`,
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
    <div className="min-h-screen flex flex-col">
      <nav className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-6">
              <span className="text-xl font-bold tracking-tight">Lancer<span className="text-blue-500">Link</span></span>
              <div className="hidden md:flex gap-4">
                <button onClick={() => setActiveTab('dashboard')} className={`text-sm font-medium ${activeTab === 'dashboard' ? 'text-blue-500' : 'text-gray-400 hover:text-white'}`}>Feed</button>
                <button onClick={() => setActiveTab('my-projects')} className={`text-sm font-medium ${activeTab === 'my-projects' ? 'text-blue-500' : 'text-gray-400 hover:text-white'}`}>My Activity</button>
                <button onClick={() => setActiveTab('wallet')} className={`text-sm font-medium ${activeTab === 'wallet' ? 'text-blue-500' : 'text-gray-400 hover:text-white'}`}>Wallet</button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{currentUser.name}</p>
                <span className="text-[10px] font-bold uppercase text-blue-500 tracking-widest">{currentUser.role} portal</span>
              </div>
              <button onClick={handleLogout} className="p-2 hover:bg-white/5 rounded-full text-gray-400"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="feed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Project Feed</h2>
                {currentUser.role === 'freelancer' && (
                  <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2"><PlusCircle className="w-5 h-5" />Post Project</button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-6">
                {projects.filter(p => p.status === 'Open' || (p.status === 'Hired' && (p.ownerId === currentUser.id || p.hiredUserId === currentUser.id))).map(p => (
                  <ProjectCard 
                    key={p.id} 
                    project={p} 
                    user={currentUser} 
                    bids={bids} 
                    onAction={setSelectedProject}
                    onUpload={handleFileUpload}
                    onAccept={handleAcceptSubmission}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'wallet' && (
            <motion.div key="wallet" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Wallet user={currentUser} transactions={transactions} />
            </motion.div>
          )}

          {activeTab === 'my-projects' && (
            <motion.div key="my" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <h2 className="text-2xl font-bold">My Activity</h2>
              <div className="grid grid-cols-1 gap-4">
                {projects.filter(p => p.ownerId === currentUser.id || p.hiredUserId === currentUser.id).map(p => (
                  <ProjectCard 
                    key={p.id} 
                    project={p} 
                    user={currentUser} 
                    bids={bids} 
                    onAction={setSelectedProject}
                    onUpload={handleFileUpload}
                    onAccept={handleAcceptSubmission}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* --- Modals --- */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-lg glass-card p-8">
              <h2 className="text-2xl font-bold mb-6">Post Listing</h2>
              <form onSubmit={postProject} className="space-y-4">
                <input name="title" required placeholder="Project Title" className="input-field w-full" />
                <select name="category" className="input-field w-full"><option>Web Development</option><option>Design</option><option>Writing</option></select>
                <input name="budget" required type="number" placeholder="Budget ($)" className="input-field w-full" />
                <textarea name="description" required rows={4} placeholder="Description..." className="input-field w-full" />
                <button type="submit" className="btn-primary w-full">Post as Freelancer</button>
              </form>
            </motion.div>
          </div>
        )}

        {selectedProject && currentUser.role === 'client' && selectedProject.status === 'Open' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedProject(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md glass-card p-8">
              <h3 className="text-xl font-bold mb-4">Submit Bid</h3>
              <form onSubmit={submitBid} className="space-y-4">
                <input name="amount" required type="number" placeholder="Bid Amount ($)" className="input-field w-full" />
                <input name="days" required type="number" placeholder="Delivery Days" className="input-field w-full" />
                <button type="submit" className="btn-primary w-full">Apply to Project</button>
              </form>
            </motion.div>
          </div>
        )}

        {selectedProject && currentUser.role === 'freelancer' && selectedProject.status === 'Open' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedProject(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-2xl glass-card p-8 max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4">Review Bids</h3>
              <div className="space-y-4">
                {bids.filter(b => b.projectId === selectedProject.id).length === 0 ? <p className="text-gray-500 text-center">No bids yet.</p> :
                 bids.filter(b => b.projectId === selectedProject.id).map(bid => (
                   <div key={bid.id} className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                     <div>
                       <p className="font-bold">{bid.bidderName}</p>
                       <p className="text-xs text-gray-500">${bid.amount} • {bid.deliveryDays} days</p>
                     </div>
                     <button onClick={() => handleHire(bid)} className="btn-primary py-1 px-4 text-xs">Hire</button>
                   </div>
                 ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="py-8 text-center text-gray-600 text-xs border-t border-white/5">
        © 2026 LancerLink • Optimized Persistence Layer
      </footer>
    </div>
  );
}

