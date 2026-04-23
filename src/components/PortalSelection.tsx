import React from 'react';
import { motion } from 'motion/react';
import { Briefcase, User as UserIcon, ChevronRight } from 'lucide-react';
import { Role } from '../types';

interface PortalSelectionProps {
  onSelect: (role: Role) => void;
}

export const PortalSelection: React.FC<PortalSelectionProps> = ({ onSelect }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass-card p-8 text-center"
      >
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Welcome to LancerLink</h1>
        <p className="text-gray-500 mb-8">Select your portal to continue.</p>
        
        <div className="grid grid-cols-1 gap-4">
          <button 
            onClick={() => onSelect('client')}
            className="flex items-center justify-between p-4 glass-card hover:border-green-500 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                <Briefcase className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900 text-lg">Client Portal</p>
                <p className="text-sm text-gray-500">Post projects & hire talent</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors" />
          </button>

          <button 
            onClick={() => onSelect('freelancer')}
            className="flex items-center justify-between p-4 glass-card hover:border-green-500 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700">
                <UserIcon className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900 text-lg">Freelancer Portal</p>
                <p className="text-sm text-gray-500">Browse jobs & submit bids</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
