export type Role = 'client' | 'freelancer';

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: Role;
  balance: number;
}

export interface Attachment {
  name: string;
  data: string; // Base64
  type: string;
}

export interface Project {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerRole: Role;
  title: string;
  description: string;
  budget: number;
  category: string;
  createdAt: string;
  deadline: string; // Updated requirement
  status: 'Open' | 'Hired' | 'Completed';
  hiredUserId?: string;
  attachments: Attachment[];
}

export interface Bid {
  id: string;
  projectId: string;
  bidderId: string;
  bidderName: string;
  bidderRole: Role;
  amount: number;
  deliveryDays: number;
  notes?: string;   // Updated requirement
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  date: string;
}

export interface AppState {
  users: User[];
  projects: Project[];
  bids: Bid[];
  transactions: Transaction[];
}
