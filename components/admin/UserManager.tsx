
import React, { useState } from 'react';
import { User, UserRole, Organization } from '../../types';
import { Users, Plus, Shield, User as UserIcon, Edit2, Trash2, Search, Briefcase } from 'lucide-react';
import { UserProfileModal } from '../UserProfileModal';

interface UserManagerProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  orgs: Organization[];
  currentUser?: User; // Passed to check permissions/context if needed
  onGenerateAiAvatar?: (context: string) => Promise<string | null>;
}

export const UserManager: React.FC<UserManagerProps> = ({ users, setUsers, orgs, currentUser, onGenerateAiAvatar }) => {
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(u => 
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (u.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = (userData: Partial<User>, password?: string) => {
      if (userData.username && userData.name) {
          const updatedUser = { ...userData } as User;
          
          // Save password if provided
          if (password) {
              updatedUser.password = password;
          }
          
          if (userData.id) {
              setUsers(users.map(u => u.id === userData.id ? updatedUser : u));
          } else {
              setUsers([...users, { 
                  ...updatedUser, 
                  id: `user-${Date.now()}` 
                }]);
          }
          
          setEditingUser(null);
      }
  };

  const handleDelete = (id: string) => {
      if (window.confirm("Are you sure you want to delete this user?")) {
          setUsers(users.filter(u => u.id !== id));
      }
  };

  // Fallback current user if not provided (should be provided by parent)
  const adminContext: User = currentUser || { 
      id: 'admin-context', 
      role: 'admin', 
      name: 'Admin', 
      username: 'admin', 
      organizationId: 'org-1', 
      allowedOrganizationIds: ['org-1'] 
  };

  return (
    <div className="space-y-6">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                    User Management
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage system access, roles, and user profiles.</p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
                 <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search users..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                 </div>
                <button 
                    onClick={() => setEditingUser({ role: 'user', organizationId: orgs[0]?.id, allowedOrganizationIds: [orgs[0]?.id], themePreference: 'system' })}
                    className="flex-none flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-600/20 transition-all"
                >
                    <Plus className="w-4 h-4" /> Add User
                </button>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                        <th className="px-6 py-3 font-bold text-slate-500 uppercase text-xs">User Identity</th>
                        <th className="px-6 py-3 font-bold text-slate-500 uppercase text-xs">Role</th>
                        <th className="px-6 py-3 font-bold text-slate-500 uppercase text-xs">Organizations</th>
                        <th className="px-6 py-3 font-bold text-slate-500 uppercase text-xs text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredUsers.map(user => (
                        <tr 
                            key={user.id} 
                            onDoubleClick={() => setEditingUser(user)}
                            className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                        >
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600 flex-none">
                                        {user.avatarUrl ? (
                                            <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                                        ) : (
                                            <UserIcon className="w-5 h-5 text-slate-400" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 dark:text-white">{user.name}</div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <span>@{user.username}</span>
                                            {user.jobTitle && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {user.jobTitle}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800' : 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'}`}>
                                    {user.role === 'admin' ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                                    {user.role === 'admin' ? 'Administrator' : 'Standard User'}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-2">
                                    {/* Active Org First */}
                                    {(() => {
                                        const activeOrg = orgs.find(o => o.id === user.organizationId);
                                        const count = user.allowedOrganizationIds?.length || 0;
                                        const othersCount = activeOrg && user.allowedOrganizationIds?.includes(activeOrg.id) 
                                            ? count - 1 
                                            : count;

                                        return (
                                            <>
                                                {activeOrg ? (
                                                     <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-xs font-medium text-slate-700 dark:text-slate-300">
                                                        {activeOrg.logoUrl && <img src={activeOrg.logoUrl} className="w-3.5 h-3.5 object-contain" />}
                                                        {activeOrg.name}
                                                     </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">No active org</span>
                                                )}
                                                
                                                {othersCount > 0 && (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500">
                                                        +{othersCount}
                                                    </span>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setEditingUser(user); }} 
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                        title="Edit User Profile"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(user.id); }} 
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Delete User"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                     {filteredUsers.length === 0 && (
                        <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic bg-slate-50/30">
                                No users found matching your search.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

         {/* Full User Profile Modal */}
         {editingUser && (
             <UserProfileModal 
                user={editingUser}
                currentUser={adminContext}
                orgs={orgs}
                onClose={() => setEditingUser(null)}
                onSave={handleSave}
                onGenerateAiAvatar={onGenerateAiAvatar && editingUser.jobTitle ? () => onGenerateAiAvatar(`${editingUser.jobTitle} ${editingUser.name}`) : undefined}
             />
        )}
    </div>
  );
};