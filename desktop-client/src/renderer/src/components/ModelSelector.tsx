import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { LLMModel } from '../types';
import { availableModels } from '../data/models';

interface ModelSelectorProps {
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelSelect
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedModelData = availableModels.find(model => model.id === selectedModel);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex flex-col items-start min-w-0">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {selectedModelData?.name || 'Select Model'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {selectedModelData?.provider}
          </span>
        </div>
        <ChevronDown 
          size={16} 
          className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {availableModels.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                onModelSelect(model.id);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between group"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {model.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {model.provider}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {model.description}
                </span>
              </div>
              {selectedModel === model.id && (
                <Check size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};