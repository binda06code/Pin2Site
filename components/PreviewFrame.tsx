import React, { useEffect, useRef } from 'react';

interface PreviewFrameProps {
  html: string;
  isEditable: boolean;
  deviceMode: 'desktop' | 'tablet' | 'mobile';
}

const PreviewFrame: React.FC<PreviewFrameProps> = ({ html, isEditable, deviceMode }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isUserTypingRef = useRef(false);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const writeContent = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet" />
            <style>
              body { 
                background-color: transparent; 
                min-height: 100vh;
                padding-bottom: 50px;
                overflow-x: hidden;
                transition: background-color 0.5s ease;
              }
              
              /* Update Flash Animation */
              @keyframes flashIn {
                0% { opacity: 0; transform: scale(0.98); }
                100% { opacity: 1; transform: scale(1); }
              }
              body {
                animation: flashIn 0.3s ease-out;
              }

              /* Editable Mode Styles */
              body.editable-mode {
                cursor: default;
              }
              
              /* Hover Effects */
              body.editable-mode *:hover:not(body):not(html) {
                outline: 2px dashed rgba(99, 102, 241, 0.4);
                cursor: pointer;
              }
              
              /* Active Editing State */
              .editing-active {
                outline: 3px solid #6366f1 !important;
                outline-offset: 2px;
                box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2);
                border-radius: 2px;
                cursor: text !important;
                position: relative;
                z-index: 50;
                background-color: rgba(255, 255, 255, 0.1);
              }

              /* Images */
              body.editable-mode img {
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              }
              body.editable-mode img:hover {
                filter: brightness(0.9);
                outline: 3px solid #3b82f6;
                transform: scale(1.01);
              }
              body.editable-mode img.drag-over {
                outline: 4px dashed #10b981;
                filter: brightness(1.1);
                transform: scale(1.02);
              }

              /* Links */
              body.editable-mode a {
                border-bottom: 1px dotted transparent;
              }
              body.editable-mode a:hover {
                border-bottom-color: #6366f1;
              }

              ::-webkit-scrollbar { width: 0px; background: transparent; }
            </style>
          </head>
          <body class="${isEditable ? 'editable-mode' : ''}">
            ${html}
            <script>
              const isEditable = ${isEditable};
              
              if (isEditable) {
                // We do NOT set body.contentEditable = true globally anymore.
                // We use double-click to enter edit mode for specific elements.
                document.body.spellcheck = false;

                // --- Link Handling (Right Click to Edit URL) ---
                document.addEventListener('click', (e) => {
                  const link = e.target.closest('a');
                  if (link) e.preventDefault();
                });

                document.addEventListener('contextmenu', (e) => {
                  const link = e.target.closest('a');
                  if (!link) return;
                  
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const currentHref = link.getAttribute('href') || '#';
                  const newHref = prompt("🔗 Edit Link URL:", currentHref);
                  
                  if (newHref !== null) {
                    link.setAttribute('href', newHref);
                    sendUpdate();
                  }
                });

                // --- Double Click to Edit (Text & Images) ---
                document.addEventListener('dblclick', (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  
                  const target = e.target;

                  // 1. Image Handling
                  if (target.tagName === 'IMG') {
                    // Visual feedback click
                    target.style.transform = 'scale(0.95)';
                    setTimeout(() => target.style.transform = '', 100);
                    
                    window.parent.postMessage({ type: 'PIN2SITE_IMG_CLICK', id: target.id }, '*');
                    return;
                  }

                  // 2. Text Handling
                  // Find the closest block-level element or span that makes sense to edit
                  // Use the target directly if it contains text, or go up if needed.
                  // For simplicity in this "Wix-like" feel, we edit the target directly.
                  
                  // Make editable
                  target.contentEditable = "true";
                  target.focus();
                  target.classList.add('editing-active');
                  
                  // Highlight visual cue
                  // We don't select all text to allow appending, but focusing is key.
                });

                // --- Save & Exit Edit Mode on Blur ---
                document.addEventListener('blur', (e) => {
                  const target = e.target;
                  if (target.isContentEditable) {
                    target.contentEditable = "false";
                    target.classList.remove('editing-active');
                    sendUpdate();
                  }
                }, true); // Capture phase is important for blur

                // --- Drag & Drop for Images ---
                document.querySelectorAll('img').forEach(img => {
                   img.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'copy';
                    img.classList.add('drag-over');
                  });
                  
                  img.addEventListener('dragleave', (e) => {
                     e.preventDefault();
                     e.stopPropagation();
                     img.classList.remove('drag-over');
                  });
                  
                  img.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    img.classList.remove('drag-over');
                    
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      const file = e.dataTransfer.files[0];
                      if (file.type.startsWith('image/')) {
                          const reader = new FileReader();
                          reader.onload = () => {
                              img.src = reader.result;
                              // Flash effect
                              img.style.transition = 'filter 0.5s';
                              img.style.filter = 'brightness(1.5)';
                              setTimeout(() => img.style.filter = '', 500);

                              window.parent.postMessage({ 
                                  type: 'PIN2SITE_IMG_DROP', 
                                  id: e.target.id || 'img-' + Date.now(),
                                  data: reader.result 
                              }, '*');
                          };
                          reader.readAsDataURL(file);
                      }
                    }
                  });
                });
              }

              // --- Sync Logic ---
              let timeout;
              const sendUpdate = () => {
                 window.parent.postMessage({ type: 'PIN2SITE_HTML_UPDATE', html: document.body.innerHTML }, '*');
              }

              // Only listen to input on currently editable elements
              document.addEventListener('input', (e) => {
                 if (!isEditable) return;
                 
                 const target = e.target;
                 if (!target.isContentEditable) return;

                 window.parent.postMessage({ type: 'PIN2SITE_USER_TYPING', isTyping: true }, '*');
                 
                 clearTimeout(timeout);
                 timeout = setTimeout(() => {
                   sendUpdate();
                   window.parent.postMessage({ type: 'PIN2SITE_USER_TYPING', isTyping: false }, '*');
                 }, 800);
              });
              
            </script>
          </body>
        </html>
      `);
      doc.close();
    };

    const doc = iframe.contentDocument;
    if (doc && doc.body) {
       if (isUserTypingRef.current) return;
       // We skip check for identical HTML to allow re-applying scripts if needed, 
       // but strictly mostly rely on React re-renders. 
       // To prevent flashing on every keystroke from parent history updates, 
       // we check content match if it's not a structure change.
       if (doc.body.innerHTML === html) return;
    }

    writeContent();

  }, [html, isEditable]);

  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data.type === 'PIN2SITE_USER_TYPING') {
        isUserTypingRef.current = e.data.isTyping;
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  const getContainerStyles = () => {
    switch (deviceMode) {
      case 'mobile':
        return 'w-[375px] my-4 border-x-8 border-y-[40px] border-gray-800 rounded-[30px] shadow-xl';
      case 'tablet':
        return 'w-[768px] my-4 border-x-8 border-y-[40px] border-gray-800 rounded-[30px] shadow-xl';
      default:
        return 'w-full h-full rounded-lg shadow-2xl';
    }
  };

  return (
    <div className={`transition-all duration-500 ease-in-out mx-auto flex flex-col bg-white overflow-hidden relative ${getContainerStyles()}`} style={{ height: deviceMode === 'desktop' ? '100%' : '800px' }}>
      
      {deviceMode !== 'desktop' && (
        <div className="absolute top-0 left-0 w-full h-[40px] flex justify-center items-center pointer-events-none z-10">
          <div className="w-20 h-4 bg-gray-700 rounded-full"></div>
        </div>
      )}

      {deviceMode === 'desktop' && (
        <div className="h-8 bg-gray-100 border-b border-gray-200 flex items-center px-4 justify-between shrink-0">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
          </div>
          <div className="flex-1 text-center">
              {isEditable ? (
                  <span className="text-xs font-bold text-indigo-600 flex items-center justify-center gap-2">
                     <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                     </span>
                     Interactive Editor Active
                  </span>
              ) : (
                  <span className="text-xs text-gray-400">Preview Mode</span>
              )}
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        title="Live Preview"
        className="w-full flex-1 border-none bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
      />
      
      {deviceMode !== 'desktop' && (
         <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gray-700 rounded-full pointer-events-none z-10"></div>
      )}
    </div>
  );
};

export default PreviewFrame;