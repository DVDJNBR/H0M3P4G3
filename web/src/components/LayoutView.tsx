import React from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import type { Block, Link, LinksBlock } from '../types';
import { useLayout } from '../context/LayoutContext';
import { BlockView } from './BlockView';
import { Header } from './Header';

export const LayoutView: React.FC = () => {
  const { layout, blocks, isLoading, error, loadLayout, setBlocks } = useLayout();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    // 1. Active item is a Block -- reorder the flat mosaic.
    const activeBlockIndex = blocks.findIndex((b) => b.id === activeId);
    if (activeBlockIndex !== -1) {
      const overBlockIndex = blocks.findIndex((b) => b.id === overId);
      if (overBlockIndex === -1) return;
      setBlocks(arrayMove(blocks, activeBlockIndex, overBlockIndex));
      return;
    }

    // 2. Active item is a Link -- reorder within a block or move across blocks.
    let sourceBlockIdx = -1;
    let activeLinkIdx = -1;

    blocks.forEach((block, bIdx) => {
      if (block.kind === 'links') {
        const lIdx = block.links.findIndex((l) => l.id === activeId);
        if (lIdx !== -1) {
          sourceBlockIdx = bIdx;
          activeLinkIdx = lIdx;
        }
      }
    });

    if (sourceBlockIdx === -1) return;

    let targetBlockIdx = blocks.findIndex((b) => b.id === overId && b.kind === 'links');
    let targetLinkIdx = targetBlockIdx !== -1 ? (blocks[targetBlockIdx] as LinksBlock).links.length : -1;

    if (targetBlockIdx === -1) {
      blocks.forEach((block, bIdx) => {
        if (block.kind === 'links') {
          const lIdx = block.links.findIndex((l) => l.id === overId);
          if (lIdx !== -1) {
            targetBlockIdx = bIdx;
            targetLinkIdx = lIdx;
          }
        }
      });
    }

    if (targetBlockIdx === -1) return;

    const newBlocks: Block[] = blocks.map((b) => (b.kind === 'links' ? { ...b, links: [...b.links] } : b));
    const sourceBlock = newBlocks[sourceBlockIdx] as LinksBlock;
    const targetBlock = newBlocks[targetBlockIdx] as LinksBlock;

    if (sourceBlockIdx === targetBlockIdx) {
      if (activeLinkIdx !== targetLinkIdx && targetLinkIdx !== -1) {
        sourceBlock.links = arrayMove(sourceBlock.links, activeLinkIdx, targetLinkIdx);
      }
    } else {
      const [movedLink] = sourceBlock.links.splice(activeLinkIdx, 1);
      if (movedLink) {
        const clampedIdx = Math.min(targetLinkIdx, targetBlock.links.length);
        targetBlock.links.splice(clampedIdx, 0, movedLink as Link);
      }
    }

    setBlocks(newBlocks);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Chargement du layout...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="glass-panel rounded-2xl p-6 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-zinc-100">Erreur de chargement</h2>
          <p className="text-xs text-zinc-400">{error}</p>
          <button
            onClick={() => loadLayout()}
            className="py-2 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-all"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!layout) return null;

  const blockIds = blocks.map((b) => b.id);

  return (
    <div className="min-h-screen bg-zinc-950 pb-16">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-16">
        {blocks.length === 0 ? (
          <div className="h-24 rounded-xl border border-dashed border-zinc-800/60 flex items-center justify-center text-xs text-zinc-600">
            Aucun bloc -- utilisez le bouton en haut à droite pour en ajouter un.
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={blockIds} strategy={rectSortingStrategy}>
              <div
                className="grid gap-4 items-start"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gridAutoFlow: 'dense' }}
              >
                {blocks.map((block: Block) => (
                  <BlockView key={block.id} block={block} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  );
};
