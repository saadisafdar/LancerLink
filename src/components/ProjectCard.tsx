import React from 'react';
import { Clock, DollarSign, MessageSquare, Paperclip, Download, Upload } from 'lucide-react';
import { Project, Bid, User } from '../types';

interface ProjectCardProps {
  project: Project;
  user: User;
  bids: Bid[];
  onAction: (project: Project) => void;
  onUpload?: (project: Project, files: FileList) => void;
  onAccept?: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ 
  project, 
  user, 
  bids, 
  onAction, 
  onUpload,
  onAccept 
}) => {
  const isOwner = project.ownerId === user.id;
  const projectBids = bids.filter(b => b.projectId === project.id);
  const userBid = bids.find(b => b.projectId === project.id && b.bidderId === user.id);

  const hasAttachments = project.attachments.length > 0;

  return (
    <div className={`glass-card p-6 space-y-4 hover:border-gray-300 transition-all ${project.status === 'Hired' ? 'border-l-4 border-l-green-500' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider rounded border border-gray-200">
              {project.category}
            </span>
            <span className="text-xs text-gray-500 font-medium">By {project.ownerName}</span>
          </div>
          <h4 className="text-xl font-bold text-gray-900">{project.title}</h4>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold font-mono text-green-600">${project.budget}</p>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
            project.status === 'Completed' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
            project.status === 'Hired' ? 'bg-green-50 text-green-600 border border-green-200' : 
            'bg-yellow-50 text-yellow-600 border border-yellow-200'
          }`}>
            {project.status}
          </span>
        </div>
      </div>
      
      <p className="text-gray-600 text-sm">{project.description}</p>

      {/* Attachments Section */}
      {project.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {project.attachments.map((att, i) => (
            <a 
              key={i} 
              href={att.data} 
              download={att.name}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 hover:text-green-600 transition-colors"
            >
              <Paperclip className="w-3.5 h-3.5" />
              {att.name}
              {isOwner && project.status !== 'Open' && <Download className="w-3 h-3 text-gray-400" />}
            </a>
          ))}
        </div>
      )}

      {/* Footer / Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Deadline: {new Date(project.deadline).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            {projectBids.length} Bids
          </span>
        </div>

        <div className="flex gap-2">
          {/* CLIENT VIEW */}
          {isOwner && project.status === 'Open' && (
            <button onClick={() => onAction(project)} className="btn-secondary py-1.5 text-xs">View Bids</button>
          )}
          
          {isOwner && project.status === 'Hired' && (
            hasAttachments ? (
              <button onClick={() => onAccept?.(project)} className="btn-primary py-1.5 text-xs bg-green-600 hover:bg-green-700">Approve & Pay</button>
            ) : (
              <span className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">Awaiting Submission</span>
            )
          )}

          {isOwner && project.status === 'Completed' && (
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">Deal Completed</span>
          )}

          {/* FREELANCER VIEW */}
          {!isOwner && project.status === 'Open' && !userBid && (
            <button onClick={() => onAction(project)} className="btn-primary py-1.5 text-xs">Submit Bid</button>
          )}

          {!isOwner && project.status === 'Hired' && project.hiredUserId === user.id && (
            <div className="flex gap-2">
              <label className="btn-secondary py-1.5 text-xs cursor-pointer flex items-center gap-2 hover:border-green-500 hover:text-green-600">
                <Upload className="w-3.5 h-3.5" />
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

          {!isOwner && project.status === 'Completed' && project.hiredUserId === user.id && (
            <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">Payment Received</span>
          )}
        </div>
      </div>
    </div>
  );
};
