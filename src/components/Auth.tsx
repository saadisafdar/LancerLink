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
        balance: 0 // Default starting balance
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full glass-card p-8"
      >
        <button onClick={onBack} className="text-sm font-medium text-gray-500 hover:text-gray-900 mb-6 transition-colors">← Back to selection</button>
        <h2 className="text-3xl font-bold mb-2 capitalize text-gray-900">{role} Portal</h2>
        <p className="text-gray-500 mb-8">{isSignup ? 'Create your account' : 'Sign in to your portal'}</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignup && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Full Name</label>
              <input name="name" required type="text" placeholder="John Doe" className="input-field w-full" />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Username</label>
            <input name="username" required type="text" placeholder="username" className="input-field w-full" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Password</label>
            <input name="password" required type="password" placeholder="••••••••" className="input-field w-full" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">{error}</p>}
          <button type="submit" className="btn-primary w-full shadow-md shadow-green-600/20 py-3">
            {isSignup ? `Join as ${role}` : `Login as ${role}`}
          </button>
        </form>

        <div className="mt-8 text-center pt-8 border-t border-gray-100">
          <button 
            onClick={() => { setIsSignup(!isSignup); setError(''); }}
            className="text-sm font-medium text-gray-500 hover:text-green-600 transition-colors"
          >
            {isSignup ? 'Already have an account? Login' : "Don't have an account? Sign up"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
