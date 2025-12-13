import React, { useState, useEffect } from 'react';
import { AppState, ImageToGenerate, UserPreferences } from '../types';
import DropZone from './DropZone';

interface ConfigurationPanelProps {
  appState: AppState;
  preferences: UserPreferences;
  setPreferences: (prefs: UserPreferences) => void;
  onFileSelect: (file: File) => void;
  uploadedImage: string | null;
  imagesToGenerate: ImageToGenerate[];
  progressLog: string[];
  onRefine: (instruction: string, sectionId?: string) => void;
  onDownload: () => void;
  onNewProject: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onBackToDashboard: () => void;
  currentHtml: string;
  isEditable: boolean;
  setIsEditable: (val: boolean) => void;
}

const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  appState,
  preferences,
  setPreferences,
  onFileSelect,
  uploadedImage,
  imagesToGenerate,
  progressLog,
  onRefine,
  onDownload,
  onNewProject,
  onUndo,
  canUndo,
  onBackToDashboard,
  currentHtml,
  isEditable,
  setIsEditable
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'edit'>('create');
  const [refineInput, setRefineInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  
  const [sections, setSections] = useState<{id: string, tag: string}[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');

  const isProcessing = appState === AppState.ANALYZING || appState === AppState.GENERATING_IMAGES;
  const hasResult = appState === AppState.COMPLETE || (appState === AppState.GENERATING_IMAGES && imagesToGenerate.length > 0);

  useEffect(() => {
    if (currentHtml) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(currentHtml, 'text/html');
      
      const foundSections: {id: string, tag: string}[] = [];
      const tagsToScan = ['section', 'header', 'footer', 'nav', 'div'];
      
      tagsToScan.forEach(tag => {
        const elements = doc.getElementsByTagName(tag);
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          if (el.id) {
             foundSections.push({ id: el.id, tag });
          }
        }
      });
      setSections(foundSections);
    }
  }, [currentHtml]);

  useEffect(() => {
    if (hasResult && appState === AppState.COMPLETE) {
      setActiveTab('edit');
    }
  }, [hasResult, appState]);

  const handleRefineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refineInput.trim()) return;
    
    setIsRefining(true);
    const targetId = selectedSectionId === 'all' ? undefined : selectedSectionId;
    await onRefine(refineInput, targetId);
    setRefineInput('');
    setIsRefining(false);
  };

  return (
    <div className="w-full lg:w-96 bg-gray-900 border-r border-gray-800 flex flex-col h-full overflow-hidden shadow-xl z-10">
      <div className="p-4 border-b border-gray-800">
        <button 
            onClick={onBackToDashboard}
            className="text-gray-400 hover:text-white text-xs mb-3 flex items-center transition-colors"
        >
            <i className="fa-solid fa-arrow-left mr-2"></i> Back to Dashboard
        </button>
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-white flex items-center">
            <i className="fa-solid fa-paintbrush text-indigo-400 mr-2"></i>
            Editor
          </h1>
          {isProcessing && <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>}
        </div>
      </div>

      {hasResult && (
        <div className="flex border-b border-gray-800">
          <button 
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-3 text-sm font-medium ${activeTab === 'create' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-400 hover:text-white'}`}
          >
            Settings
          </button>
          <button 
             onClick={() => setActiveTab('edit')}
            className={`flex-1 py-3 text-sm font-medium ${activeTab === 'edit' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-400 hover:text-white'}`}
          >
            Design
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        <div className={activeTab === 'create' ? 'block' : 'hidden'}>
            <section>
               <h2 className="text-gray-400 text-xs font-semibold mb-2 uppercase">Reference Image</h2>
              {uploadedImage ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-700 aspect-video group mb-4">
                  <img src={uploadedImage} alt="Reference" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="text-xs text-gray-500">No reference image attached.</div>
              )}
            </section>

             <section>
              <h2 className="text-gray-400 text-xs font-semibold mb-2 uppercase">Theme Context</h2>
               <input
                  type="text"
                  value={preferences.theme}
                  onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
                  placeholder="e.g. Sushi Restaurant"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none mb-3"
                />
            </section>

            {progressLog.length > 0 && (
              <section className="mt-6">
                <h2 className="text-gray-400 text-xs font-semibold mb-2 uppercase">System Log</h2>
                <div className="bg-black/30 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto font-mono text-[10px] text-gray-400">
                  {progressLog.map((log, idx) => (
                    <div key={idx} className="border-l-2 border-gray-700 pl-2">{log}</div>
                  ))}
                </div>
              </section>
            )}
        </div>

        <div className={activeTab === 'edit' ? 'block' : 'hidden'}>
           {/* Visual Editing Toggle */}
           <div className={`p-4 rounded-xl border mb-6 transition-all ${isEditable ? 'bg-indigo-900/30 border-indigo-500' : 'bg-gray-800 border-gray-700'}`}>
              <div className="flex items-center justify-between mb-2">
                 <h3 className={`text-sm font-bold ${isEditable ? 'text-indigo-300' : 'text-gray-300'}`}>
                    <i className="fa-solid fa-mouse-pointer mr-2"></i> Visual Editor
                 </h3>
                 <button 
                   onClick={() => setIsEditable(!isEditable)}
                   className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isEditable ? 'bg-indigo-500' : 'bg-gray-600'}`}
                 >
                   <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEditable ? 'translate-x-6' : 'translate-x-1'}`} />
                 </button>
              </div>
              <p className="text-xs text-gray-400">
                 {isEditable ? "Click text to type. Drag & drop images to replace." : "Enable to edit text and images directly."}
              </p>
           </div>
            
           {/* Undo Row */}
           <div className="flex gap-2 mb-6">
              <button 
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="flex-1 flex items-center justify-center px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg disabled:opacity-50 border border-gray-700"
                >
                  <i className="fa-solid fa-rotate-left mr-2"></i> Undo Change
              </button>
           </div>

           <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
             <h3 className="text-sm font-bold text-gray-300 mb-1"><i className="fa-solid fa-robot mr-2"></i>AI Assistant</h3>
             <p className="text-xs text-gray-400 mb-3">Refine the design using AI.</p>
           
             <form onSubmit={handleRefineSubmit} className="space-y-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Target Section</label>
                  <select 
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
                  >
                    <option value="all">Whole Page</option>
                    {sections.map(sec => (
                      <option key={sec.id} value={sec.id}>
                        #{sec.id} ({sec.tag})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                   <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Instruction</label>
                   <textarea 
                    value={refineInput}
                    onChange={(e) => setRefineInput(e.target.value)}
                    placeholder={selectedSectionId === 'all' ? "e.g. Change font to serif..." : `e.g. Change text in #${selectedSectionId} to white...`}
                    className="w-full h-24 bg-gray-900 border border-gray-700 rounded p-2 text-xs text-white focus:border-indigo-500 outline-none resize-none"
                    disabled={isRefining}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isRefining || !refineInput.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded transition-colors flex items-center justify-center disabled:opacity-50 text-xs"
                >
                  {isRefining ? <i className="fa-solid fa-circle-notch fa-spin"></i> : "Apply AI Changes"}
                </button>
             </form>
           </div>

           <div className="mt-auto">
             <button 
               onClick={onDownload}
               className="w-full flex items-center justify-center px-4 py-3 bg-green-700 hover:bg-green-600 text-white text-sm rounded-lg shadow-lg"
             >
               <i className="fa-solid fa-download mr-2"></i> Export HTML
             </button>
           </div>
        </div>

      </div>
    </div>
  );
};

export default ConfigurationPanel;