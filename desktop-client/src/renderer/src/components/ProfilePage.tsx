import React, { useState } from 'react';
import { ArrowLeft, User, Mail, Save, Camera } from 'lucide-react';
import { UserProfile } from '../types';

interface ProfilePageProps {
  onBack: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onBack }) => {
  const [profile, setProfile] = useState<UserProfile>({
    id: '1',
    name: 'John Doe',
    email: 'john.doe@example.com',
    preferences: {
      defaultModel: 'gpt-4-turbo',
      temperature: 0.7,
      maxTokens: 2048
    }
  });

  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    // Save profile logic here
    setIsEditing(false);
    // Show success message
  };

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
              <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center">
                <User size={32} className="text-white" />
              </div>
              {isEditing && (
                <button className="absolute -bottom-2 -right-2 p-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors">
                  <Camera size={16} className="text-white" />
                </button>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                {profile.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{profile.email}</p>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>
          </div>
        </div>

        {/* Profile Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Personal Information
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <User size={16} className="text-gray-400" />
                  <span className="text-gray-900 dark:text-gray-100">{profile.name}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              {isEditing ? (
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <Mail size={16} className="text-gray-400" />
                  <span className="text-gray-900 dark:text-gray-100">{profile.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Model Preferences */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Model Preferences
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Temperature: {profile.preferences.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={profile.preferences.temperature}
                onChange={(e) => setProfile({
                  ...profile,
                  preferences: {
                    ...profile.preferences,
                    temperature: parseFloat(e.target.value)
                  }
                })}
                className="w-full"
                disabled={!isEditing}
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>Focused</span>
                <span>Balanced</span>
                <span>Creative</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Tokens
              </label>
              <input
                type="number"
                value={profile.preferences.maxTokens}
                onChange={(e) => setProfile({
                  ...profile,
                  preferences: {
                    ...profile.preferences,
                    maxTokens: parseInt(e.target.value)
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                disabled={!isEditing}
              />
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Save size={16} />
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};