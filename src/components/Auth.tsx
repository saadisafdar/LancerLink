import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Role } from '../types';

interface AuthProps {
  role: Role;
  onAuth: (user: User) => void;
  onBack: () => void;
  users: User[];
  onSetUsers: (users: User[]) => void;
}

export const Auth: React.FC<AuthProps> = ({ role, onAuth, onBack, users, onSetUsers }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;

    if (isSignup) {
      if (users.find(u => u.username === username)) {
        setError('Username already exists');
        return;
      }
      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        name,
        username,
        password,
        role,
        balance: role === 'client' ? 5000 : 0 // Starting balance for clients
      };
      onSetUsers([...users, newUser]);
      onAuth(newUser);
    } else {
      const foundUser = users.find(u => u.username === username && u.password === password && u.role === role);
      if (foundUser) {
        onAuth(foundUser);
      } else {
        setError('Invalid credentials for this portal');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full glass-card p-8"
      >
        <button onClick={onBack} className="text-xs text-gray-500 hover:text-white mb-6">← Back to selection</button>
        <h2 className="text-2xl font-bold mb-2 capitalize">{role} Portal</h2>
        <p className="text-gray-400 mb-8">{isSignup ? 'Create your account' : 'Sign in to your portal'}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Full Name</label>
              <input name="name" required type="text" placeholder="John Doe" className="input-field w-full" />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Username</label>
            <input name="username" required type="text" placeholder="username" className="input-field w-full" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Password</label>
            <input name="password" required type="password" placeholder="••••••••" className="input-field w-full" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" className="btn-primary w-full shadow-lg shadow-blue-600/20">
            {isSignup ? `Join as ${role}` : `Login as ${role}`}
          </button>
        </form>

        <div className="mt-8 text-center pt-8 border-t border-white/5">
          <button 
            onClick={() => { setIsSignup(!isSignup); setError(''); }}
            className="text-sm text-gray-400 hover:text-white"
          >
            {isSignup ? 'Already have an account? Login' : "Don't have an account? Sign up"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
