import React from 'react';
import { motion } from 'motion/react';
import { Briefcase, User as UserIcon, ChevronRight } from 'lucide-react';
import { Role } from '../types';

interface PortalSelectionProps {
  onSelect: (role: Role) => void;
}

export const PortalSelection: React.FC<PortalSelectionProps> = ({ onSelect }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass-card p-8 text-center"
      >
        <h1 className="text-3xl font-bold mb-2">Welcome to LancerLink</h1>
        <p className="text-gray-400 mb-8">Select your portal to continue.</p>
        
        <div className="grid grid-cols-1 gap-4">
          <button 
            onClick={() => onSelect('client')}
            className="flex items-center justify-between p-4 glass-card hover:bg-white/10 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500">
                <Briefcase className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="font-bold">Client Portal</p>
                <p className="text-xs text-gray-500">Post bids and manage your projects</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
          </button>

          <button 
            onClick={() => onSelect('freelancer')}
            className="flex items-center justify-between p-4 glass-card hover:bg-white/10 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-500">
                <UserIcon className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="font-bold">Freelancer Portal</p>
                <p className="text-xs text-gray-500">Post projects and hire talent</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
