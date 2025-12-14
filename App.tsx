import React, { useState, useEffect, useRef } from 'react';
import ConfigurationPanel from './components/ConfigurationPanel';
import PreviewFrame from './components/PreviewFrame';
import CodeEditor from './components/CodeEditor';
import Dashboard from './components/Dashboard';
import { AppState, ImageToGenerate, UserPreferences, Project } from './types';
import { analyzeLayoutAndGenerateCode, fileToGenerativePart, generateAssetImage, refineHtmlWithAI } from './services/geminiService';
import { saveProject, getProjects, deleteProject } from './services/storageService';

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({ theme: '', colorPalette: '' });
  
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [imagesToGenerate, setImagesToGenerate] = useState<ImageToGenerate[]>([]);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  
  // Interactive Editing State
  const [isEditable, setIsEditable] = useState(false);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  // Viewer State
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const generatedHtml = historyIndex >= 0 ? history[historyIndex] : '';

  // --- Initial Load ---
  useEffect(() => {
    setProjects(getProjects());
  }, [view]);

  // --- Helpers ---
  const addLog = (msg: string) => setProgressLog(prev => [...prev, msg]);

  const saveCurrentWork = (html: string, imgData?: string) => {
    if (!activeProjectId) return;
    
    const existing = projects.find(p => p.id === activeProjectId);
    const name = existing?.name || `Theme ${new Date().toLocaleTimeString()}`;
    const thumbnail = imgData || existing?.thumbnail;

    const project: Project = {
      id: activeProjectId,
      name,
      html,
      thumbnail,
      createdAt: existing?.createdAt || Date.now(),
      lastModified: Date.now()
    };

    saveProject(project);
    setProjects(getProjects());
  };

  const pushToHistory = (html: string) => {
    if (historyIndex >= 0 && history[historyIndex] === html) return;

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(html);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    saveCurrentWork(html);
  };

  // --- Interactive Editing Message Listener ---
  useEffect(() => {
     const handleMessage = (event: MessageEvent) => {
        if (!event.data) return;

        if (event.data.type === 'PIN2SITE_HTML_UPDATE') {
            const newHtml = event.data.html;
            if (history[historyIndex]?.trim() !== newHtml?.trim()) {
                 pushToHistory(newHtml);
            }
        }

        if (event.data.type === 'PIN2SITE_IMG_CLICK') {
            setEditingImageId(event.data.id);
            if (imageInputRef.current) imageInputRef.current.click();
        }

        if (event.data.type === 'PIN2SITE_IMG_DROP') {
             const { id, data } = event.data;
             updateImageInDom(id, data);
        }
     };

     window.addEventListener('message', handleMessage);
     return () => window.removeEventListener('message', handleMessage);
  }, [history, historyIndex, activeProjectId]);

  const updateImageInDom = (imgId: string, base64Url: string) => {
     if (!generatedHtml) return;

     const parser = new DOMParser();
     const doc = parser.parseFromString(generatedHtml, 'text/html');
     const img = doc.getElementById(imgId);
     
     if (img) {
        img.setAttribute('src', base64Url);
        img.setAttribute('srcset', '');
        const newHtml = doc.body.innerHTML;
        pushToHistory(newHtml);
        addLog("Image updated.");
     } else {
        addLog("Error: Image ID not found in document structure.");
     }
  };

  const handleManualImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && editingImageId) {
       const file = e.target.files[0];
       try {
         const base64 = await fileToGenerativePart(file);
         const imageUrl = `data:${file.type};base64,${base64}`;
         updateImageInDom(editingImageId, imageUrl);
       } catch (err) {
         console.error(err);
         addLog("Failed to upload image.");
       }
       e.target.value = '';
       setEditingImageId(null);
    }
  };

  const handleCodeUpdate = (newHtml: string) => {
     pushToHistory(newHtml);
  };


  // --- Actions ---

  const handleCreateNew = async (file: File) => {
    const newId = crypto.randomUUID();
    setActiveProjectId(newId);
    setAppState(AppState.ANALYZING);
    setHistory([]);
    setHistoryIndex(-1);
    setImagesToGenerate([]);
    setProgressLog([]);
    setPreferences({ theme: '', colorPalette: '' });
    setView('editor');
    setIsEditable(false);
    setViewMode('preview'); // Default to preview
    setDeviceMode('desktop');

    try {
      const base64Data = await fileToGenerativePart(file);
      const mimeType = file.type;
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      setUploadedImage(dataUrl);

      saveProject({
        id: newId,
        name: file.name.split('.')[0] || "New Theme",
        thumbnail: dataUrl,
        html: '',
        createdAt: Date.now(),
        lastModified: Date.now()
      });

      addLog("Analyzing layout with Pro Vision...");

      const result = await analyzeLayoutAndGenerateCode(base64Data, { theme: '', colorPalette: '' });
      pushToHistory(result.html);
      setImagesToGenerate(result.images);
      
      addLog(`Layout ready. Generating ${result.images.length} assets...`);
      setAppState(AppState.GENERATING_IMAGES);

    } catch (error) {
      console.error(error);
      addLog("Error analyzing image.");
      setAppState(AppState.ERROR);
    }
  };

  const handleOpenProject = (project: Project) => {
    setActiveProjectId(project.id);
    setUploadedImage(project.thumbnail || null);
    setHistory([project.html]);
    setHistoryIndex(0);
    setImagesToGenerate([]); 
    setProgressLog(["Project loaded."]);
    setAppState(AppState.COMPLETE);
    setView('editor');
    setIsEditable(false);
    setViewMode('preview');
    setDeviceMode('desktop');
  };

  const handleDeleteProject = (id: string) => {
    if (window.confirm("Delete this theme?")) {
      deleteProject(id);
      setProjects(getProjects());
    }
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
    setActiveProjectId(null);
    setIsEditable(false);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
    }
  };

  const handleRefine = async (instruction: string, sectionId?: string) => {
    if (!generatedHtml) return;
    
    const base64Ref = uploadedImage ? uploadedImage.split(',')[1] : undefined;

    if (sectionId) {
       addLog(`Refining section #${sectionId}...`);
       const parser = new DOMParser();
       const doc = parser.parseFromString(generatedHtml, 'text/html');
       const sectionEl = doc.getElementById(sectionId);
       if (!sectionEl) {
         addLog(`Error: Section #${sectionId} not found.`);
         return;
       }
       const sectionHtml = sectionEl.outerHTML;
       try {
         const refinedSectionHtml = await refineHtmlWithAI(sectionHtml, instruction, true, base64Ref);
         sectionEl.outerHTML = refinedSectionHtml;
         const newFullHtml = doc.body.innerHTML;
         pushToHistory(newFullHtml);
         addLog("Section updated.");
       } catch (e) {
         addLog("Refinement failed.");
       }
    } else {
       addLog(`Refining whole page...`);
       try {
         const newHtml = await refineHtmlWithAI(generatedHtml, instruction, false, base64Ref);
         pushToHistory(newHtml);
         addLog("Refinement complete.");
       } catch (e) {
         addLog("Refinement failed.");
       }
    }
  };

  const handleDownload = () => {
    if (!generatedHtml) return;
    const fullHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Exported Theme</title><script src="https://cdn.tailwindcss.com"></script><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet" /></head><body>${generatedHtml}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'theme-export.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Image Generation Queue Logic
  useEffect(() => {
    if (appState !== AppState.GENERATING_IMAGES) return;
    let isMounted = true;
    const processImages = async () => {
      const pendingImages = imagesToGenerate.filter(img => img.status === 'pending');
      if (pendingImages.length === 0) {
        if (imagesToGenerate.length > 0 && imagesToGenerate.every(img => img.status !== 'pending' && img.status !== 'generating')) {
            setAppState(AppState.COMPLETE);
            addLog("All assets generated.");
        }
        return;
      }
      const currentImage = pendingImages[0];
      setImagesToGenerate(prev => prev.map(img => img.id === currentImage.id ? { ...img, status: 'generating' } : img));
      addLog(`Generating asset: ${currentImage.id}...`);

      try {
        const imageUrl = await generateAssetImage(currentImage.description, currentImage.aspectRatio);
        if (isMounted) {
            setImagesToGenerate(prev => prev.map(img => img.id === currentImage.id ? { ...img, status: 'done', url: imageUrl } : img));
            setHistory(prevHistory => {
                const currentHtml = prevHistory[prevHistory.length - 1];
                const parser = new DOMParser();
                const doc = parser.parseFromString(currentHtml, 'text/html');
                const imgElement = doc.getElementById(currentImage.id);
                if (imgElement) {
                    imgElement.setAttribute('src', imageUrl);
                    imgElement.setAttribute('srcset', '');
                    const updatedHtml = doc.body.innerHTML;
                    const newHist = [...prevHistory];
                    newHist[newHist.length - 1] = updatedHtml;
                    saveCurrentWork(updatedHtml, uploadedImage || undefined);
                    return newHist;
                }
                return prevHistory;
            });
        }
      } catch (err) {
        console.error(err);
        if (isMounted) setImagesToGenerate(prev => prev.map(img => img.id === currentImage.id ? { ...img, status: 'failed' } : img));
      }
    };
    processImages();
    return () => { isMounted = false; };
  }, [imagesToGenerate, appState]);

  if (view === 'dashboard') {
    return (
      <Dashboard 
        projects={projects}
        onNewProject={handleCreateNew}
        onOpenProject={handleOpenProject}
        onDeleteProject={handleDeleteProject}
      />
    );
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden font-sans">
      <ConfigurationPanel
        appState={appState}
        preferences={preferences}
        setPreferences={setPreferences}
        onFileSelect={() => {}} 
        uploadedImage={uploadedImage}
        imagesToGenerate={imagesToGenerate}
        progressLog={progressLog}
        onRefine={handleRefine}
        onDownload={handleDownload}
        onNewProject={() => {}}
        onUndo={handleUndo}
        canUndo={historyIndex > 0}
        onBackToDashboard={handleBackToDashboard}
        currentHtml={generatedHtml}
        isEditable={isEditable}
        setIsEditable={setIsEditable}
      />

      <main className="flex-1 relative bg-black/50 flex flex-col">
        {/* View Controls Toolbar */}
        <div className="h-14 bg-[#1a1a1a] border-b border-gray-800 flex items-center justify-between px-6 shrink-0 z-20">
           
           {/* Device Toggle */}
           <div className="flex bg-black rounded-lg p-1 border border-gray-800">
              <button 
                onClick={() => setDeviceMode('desktop')}
                className={`w-10 h-8 flex items-center justify-center rounded transition-colors ${deviceMode === 'desktop' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                title="Desktop View"
              >
                <i className="fa-solid fa-desktop"></i>
              </button>
              <button 
                onClick={() => setDeviceMode('tablet')}
                className={`w-10 h-8 flex items-center justify-center rounded transition-colors ${deviceMode === 'tablet' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                title="Tablet View"
              >
                <i className="fa-solid fa-tablet-screen-button"></i>
              </button>
              <button 
                onClick={() => setDeviceMode('mobile')}
                className={`w-10 h-8 flex items-center justify-center rounded transition-colors ${deviceMode === 'mobile' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                title="Mobile View"
              >
                <i className="fa-solid fa-mobile-screen"></i>
              </button>
           </div>

           {/* View Mode Switcher */}
           <div className="flex space-x-4">
              <button 
                onClick={() => setViewMode('preview')}
                className={`flex items-center text-sm font-medium transition-colors ${viewMode === 'preview' ? 'text-indigo-400' : 'text-gray-400 hover:text-white'}`}
              >
                 <i className="fa-solid fa-eye mr-2"></i> Preview
              </button>
              <button 
                onClick={() => setViewMode('code')}
                className={`flex items-center text-sm font-medium transition-colors ${viewMode === 'code' ? 'text-indigo-400' : 'text-gray-400 hover:text-white'}`}
              >
                 <i className="fa-solid fa-code mr-2"></i> Code
              </button>
           </div>
        </div>

        <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-gray-900/50 p-4 lg:p-8">
           <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
             <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[100px]"></div>
           </div>

           {generatedHtml ? (
              <div className="w-full h-full flex justify-center">
                {viewMode === 'preview' ? (
                   <PreviewFrame 
                      html={generatedHtml} 
                      isEditable={isEditable} 
                      deviceMode={deviceMode}
                   />
                ) : (
                   <div className="w-full max-w-5xl h-full animate-fade-in-up">
                      <CodeEditor html={generatedHtml} onUpdate={handleCodeUpdate} />
                   </div>
                )}
              </div>
           ) : (
              <div className="text-center text-gray-500 max-w-md">
                 <div className="mb-6 mx-auto w-12 h-12 border-2 border-t-indigo-500 border-r-indigo-500 border-gray-800 rounded-full animate-spin"></div>
                 <p>Processing with Pro Vision...</p>
              </div>
           )}
        </div>
      </main>

      {/* Hidden Input for Image Uploads */}
      <input 
        type="file" 
        ref={imageInputRef} 
        onChange={handleManualImageUpload} 
        className="hidden" 
        accept="image/*"
      />
    </div>
  );
};

export default App;