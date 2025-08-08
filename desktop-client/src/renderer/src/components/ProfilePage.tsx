import React, { useState } from 'react';
import { ArrowLeft, User, Mail, Save, Camera } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

interface ProfilePageProps {
  onBack: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onBack }) => {
  const { user, signIn } = useUser();

  if (!user) {
    // Not signed in: show sign in page
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 shadow">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">Sign In</h2>
          <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-6 h-6"><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.23l6.85-6.85C35.64 2.39 30.18 0 24 0 14.82 0 6.71 5.82 2.69 14.09l7.98 6.2C12.13 13.09 17.57 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.6C43.98 37.13 46.1 31.3 46.1 24.55z"/><path fill="#FBBC05" d="M10.67 28.29c-1.13-3.36-1.13-6.97 0-10.33l-7.98-6.2C.7 15.13 0 19.45 0 24c0 4.55.7 8.87 2.69 12.24l7.98-6.2z"/><path fill="#EA4335" d="M24 48c6.18 0 11.64-2.05 15.54-5.57l-7.19-5.6c-2.01 1.35-4.59 2.15-8.35 2.15-6.43 0-11.87-3.59-14.33-8.79l-7.98 6.2C6.71 42.18 14.82 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></g></svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
        </div>

        {/* Avatar Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-6">
            <div className="relative">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-2 border-blue-600"
                />
              ) : (
                <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center">
                  <User size={32} className="text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                {user.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
