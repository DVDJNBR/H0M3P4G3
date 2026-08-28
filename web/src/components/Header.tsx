import React, { useState } from 'react';
import { useLayout } from '../context/LayoutContext';
import { AddBlockModal } from './AddBlockModal';

// No banner: the user is the only visitor, so the page opens straight on
// content. The edit control lives as a small floating pill in the corner
// of the content itself instead of a separate title bar.
export const Header: React.FC = () => {
  const { isEditorMode, toggleEditorMode, addBlock } = useLayout();
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);

  return (
    <>
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        {isEditorMode && (
          <button
            onClick={() => setShowAddBlockModal(true)}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-full glass-panel glass-panel-hover text-zinc-300 hover:text-white text-xs font-medium shadow-lg"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Bloc</span>
          </button>
        )}

        <button
          onClick={toggleEditorMode}
          title={isEditorMode ? 'Terminer' : 'Éditer'}
          className={`flex items-center justify-center w-9 h-9 rounded-full shadow-lg transition-all ${
            isEditorMode
              ? 'bg-indigo-600 text-white hover:bg-indigo-500'
              : 'glass-panel glass-panel-hover text-zinc-300 hover:text-white'
          }`}
        >
          {isEditorMode ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          )}
        </button>
      </div>

      <AddBlockModal
        isOpen={showAddBlockModal}
        onSave={(config) => {
          setShowAddBlockModal(false);
          addBlock(config);
        }}
        onCancel={() => setShowAddBlockModal(false)}
      />
    </>
  );
};
