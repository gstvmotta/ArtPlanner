import { useEffect, useState } from 'react';
import { Wall3D } from './components/Wall3D';
import { InstallGuide } from './components/InstallGuide';
import { WallPropertiesPanel } from './components/WallPropertiesPanel';
import { FramePropertiesPanel } from './components/FramePropertiesPanel';
import { useWallStore } from './store/useWallStore';
import './App.css';

function App() {
  const [guideOpen, setGuideOpen] = useState(false);
  const [wallPanelOpen, setWallPanelOpen] = useState(true);
  const selectedFrameId = useWallStore((s) => s.selectedFrameId);
  const frames = useWallStore((s) => s.frames);
  const addFrame = useWallStore((s) => s.addFrame);
  const moveFrame = useWallStore((s) => s.moveFrame);
  const beginHistoryEntry = useWallStore((s) => s.beginHistoryEntry);
  const undo = useWallStore((s) => s.undo);
  const redo = useWallStore((s) => s.redo);
  const canUndo = useWallStore((s) => s.undoStack.length > 0);
  const canRedo = useWallStore((s) => s.redoStack.length > 0);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      const isMod = e.ctrlKey || e.metaKey;
      if (isMod) {
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
          e.preventDefault();
          redo();
        }
        return;
      }

      if (!selectedFrameId) return;
      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else return;

      e.preventDefault();
      const frame = frames.find((f) => f.id === selectedFrameId);
      if (!frame) return;
      if (!e.repeat) beginHistoryEntry();
      moveFrame(selectedFrameId, frame.xCm + dx, frame.yCm + dy, true);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, selectedFrameId, frames, moveFrame, beginHistoryEntry]);

  return (
    <div className="app-layout">
      <div className="scene-fullscreen">
        <Wall3D />
      </div>

      <div className="topbar no-print">
        <div className="topbar-actions">
          <button className="icon-btn" title="Desfazer (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 8L4 12l5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 12h11a5 5 0 0 1 0 10h-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button className="icon-btn" title="Refazer (Ctrl+Y)" onClick={redo} disabled={!canRedo}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 8l5 4-5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 12H9a5 5 0 0 0 0 10h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button className="icon-btn" title="Adicionar quadro" onClick={() => addFrame()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button className="icon-btn" title="Gabarito de fixadores" onClick={() => setGuideOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="2.2" fill="currentColor" />
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {wallPanelOpen ? (
        <aside className="floating-panel floating-panel-left no-print">
          <div className="panel-header">
            <span>Parede</span>
            <button
              className="panel-close-btn"
              title="Ocultar menu"
              onClick={() => setWallPanelOpen(false)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <WallPropertiesPanel />
        </aside>
      ) : (
        <button
          className="icon-btn panel-reopen-btn no-print"
          title="Mostrar menu da parede"
          onClick={() => setWallPanelOpen(true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M3 9h18M9 9v12" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      )}

      {selectedFrameId && (
        <aside className="floating-panel floating-panel-right no-print">
          <FramePropertiesPanel />
        </aside>
      )}

      {guideOpen && <InstallGuide onClose={() => setGuideOpen(false)} />}
    </div>
  );
}

export default App;
