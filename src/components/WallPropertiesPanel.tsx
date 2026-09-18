import { useRef, useState } from 'react';
import { useWallStore } from '../store/useWallStore';
import { downloadProjectZip, parseProjectZip } from '../utils/projectZip';

export function WallPropertiesPanel() {
  const wall = useWallStore((s) => s.wall);
  const grid = useWallStore((s) => s.grid);
  const frames = useWallStore((s) => s.frames);
  const setWall = useWallStore((s) => s.setWall);
  const setGrid = useWallStore((s) => s.setGrid);
  const addFrame = useWallStore((s) => s.addFrame);
  const loadProject = useWallStore((s) => s.loadProject);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    downloadProjectZip({ wall, grid, frames });
  }

  function handleImportClick() {
    setImportError(null);
    fileInputRef.current?.click();
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = parseProjectZip(reader.result as ArrayBuffer);
        loadProject(data);
        setImportError(null);
      } catch {
        setImportError('Não foi possível ler este arquivo de projeto.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div className="panel-body">
      <label className="field">
        Largura (cm)
        <input
          type="number"
          value={wall.widthCm}
          min={50}
          onChange={(e) => setWall({ widthCm: Number(e.target.value) })}
        />
      </label>

      <label className="field">
        Altura (cm)
        <input
          type="number"
          value={wall.heightCm}
          min={50}
          onChange={(e) => setWall({ heightCm: Number(e.target.value) })}
        />
      </label>

      <label className="field">
        Cor da parede
        <input
          type="color"
          value={wall.colorHex}
          onChange={(e) => setWall({ colorHex: e.target.value })}
        />
      </label>

      <hr />

      <h3>Encaixe</h3>

      <label className="field">
        Tamanho do passo (cm)
        <input
          type="number"
          value={grid.cellSizeCm}
          min={1}
          onChange={(e) => setGrid({ cellSizeCm: Number(e.target.value) })}
        />
      </label>

      <label className="field field-row">
        <input
          type="checkbox"
          checked={grid.snapEnabled}
          onChange={(e) => setGrid({ snapEnabled: e.target.checked })}
        />
        Encaixar ao arrastar (snap)
      </label>

      <button className="btn btn-primary btn-block" onClick={addFrame}>
        + Adicionar quadro
      </button>

      <hr />

      <h3>Projeto</h3>

      <button className="btn btn-block" onClick={handleExport}>
        Exportar projeto (.zip)
      </button>
      <button className="btn btn-block" onClick={handleImportClick}>
        Importar projeto
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={handleImportFile}
        style={{ display: 'none' }}
      />
      {importError && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{importError}</span>}
    </div>
  );
}
