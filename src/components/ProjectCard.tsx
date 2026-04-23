import React from 'react';
import { Clock, DollarSign, MessageSquare, Briefcase, Paperclip, Download, Upload } from 'lucide-react';
import { Project, Bid, User, Attachment } from '../types';

interface ProjectCardProps {
  project: Project;
  user: User;
  bids: Bid[];
  onAction: (project: Project) => void;
  onHire?: (bid: Bid) => void;
  onUpload?: (project: Project, files: FileList) => void;
  onAccept?: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ 
  project, 
  user, 
  bids, 
  onAction, 
  onHire, 
  onUpload,
  onAccept 
}) => {
  const isOwner = project.ownerId === user.id;
  const projectBids = bids.filter(b => b.projectId === project.id);
  const userBid = bids.find(b => b.projectId === project.id && b.bidderId === user.id);
  const hiredBid = bids.find(b => b.bidderId === project.hiredUserId && b.projectId === project.id);

  return (
    <div className={`glass-card p-6 space-y-4 hover:border-white/20 transition-all ${project.status === 'Hired' ? 'border-l-4 border-green-500' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider rounded border border-blue-500/20">
              {project.category}
            </span>
            <span className="text-xs text-gray-500">By {project.ownerName} ({project.ownerRole})</span>
          </div>
          <h4 className="text-xl font-bold">{project.title}</h4>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold font-mono text-green-500">${project.budget}</p>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
            project.status === 'Completed' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
            project.status === 'Hired' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 
            'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
          }`}>
            {project.status}
          </span>
        </div>
      </div>
      
      <p className="text-gray-400 text-sm line-clamp-2">{project.description}</p>

      {project.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {project.attachments.map((att, i) => (
            <a 
              key={i} 
              href={att.data} 
              download={att.name}
              className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg text-xs hover:bg-white/10 transition-colors"
            >
              <Paperclip className="w-3 h-3" />
              {att.name}
              <Download className="w-3 h-3 text-gray-500" />
            </a>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {new Date(project.createdAt).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            {projectBids.length} Bids
          </span>
        </div>

        <div className="flex gap-2">
          {isOwner && project.status === 'Open' && (
            <button onClick={() => onAction(project)} className="btn-secondary py-1.5 text-xs">View Bids</button>
          )}
          
          {isOwner && project.status === 'Hired' && (
            <button onClick={() => onAccept?.(project)} className="btn-primary py-1.5 text-xs bg-green-600 hover:bg-green-700">Accept Submission</button>
          )}

          {!isOwner && project.status === 'Open' && !userBid && (
            <button onClick={() => onAction(project)} className="btn-primary py-1.5 text-xs">Submit Bid</button>
          )}

          {!isOwner && project.status === 'Hired' && project.hiredUserId === user.id && (
            <div className="flex gap-2">
              <label className="btn-secondary py-1.5 text-xs cursor-pointer flex items-center gap-2">
                <Upload className="w-3 h-3" />
                Upload Assets
                <input 
                  type="file" 
                  multiple 
                  className="hidden" 
                  accept=".pdf,.docx,.jpg,.jpeg"
                  onChange={(e) => e.target.files && onUpload?.(project, e.target.files)}
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
