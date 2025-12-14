import React, { useEffect, useRef } from 'react';

interface PreviewFrameProps {
  html: string;
  isEditable: boolean;
  deviceMode: 'desktop' | 'tablet' | 'mobile';
}

const PreviewFrame: React.FC<PreviewFrameProps> = ({ html, isEditable, deviceMode }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // We track the last HTML we *intentionally* rendered from props
  // AND what the user has typed to avoid overwriting it.
  const isUserTypingRef = useRef(false);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Helper to write content
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
              }
              /* Visual cues for editing */
              body.editable {
                cursor: text;
              }
              body.editable *:hover {
                outline: 1px dashed #6366f1;
              }
              body.editable img {
                cursor: pointer;
                transition: all 0.2s;
              }
              body.editable img:hover {
                outline: 3px solid #3b82f6;
                opacity: 0.9;
              }
              body.editable img.drag-over {
                outline: 3px dashed #10b981;
                opacity: 0.7;
              }
              body.editable a {
                cursor: alias; /* Indicate link editing */
                position: relative;
              }
              body.editable a:hover::after {
                content: "Double-click to edit link";
                position: absolute;
                bottom: 100%;
                left: 0;
                background: #333;
                color: #fff;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 10px;
                white-space: nowrap;
                z-index: 50;
                pointer-events: none;
              }
              ::-webkit-scrollbar { width: 0px; background: transparent; }
            </style>
          </head>
          <body class="${isEditable ? 'editable' : ''}">
            ${html}
            <script>
              const isEditable = ${isEditable};
              
              if (isEditable) {
                document.body.contentEditable = "true";
                document.body.spellcheck = false;

                // --- Link Editing ---
                document.querySelectorAll('a').forEach(a => {
                  a.addEventListener('click', (e) => {
                    e.preventDefault(); // Stop navigation
                  });
                  
                  a.addEventListener('dblclick', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const currentHref = a.getAttribute('href') || '#';
                    const newHref = prompt("Enter new link URL:", currentHref);
                    if (newHref !== null) {
                      a.setAttribute('href', newHref);
                      // Send update immediately
                      window.parent.postMessage({ type: 'PIN2SITE_HTML_UPDATE', html: document.body.innerHTML }, '*');
                    }
                  });
                });

                // --- Image Interaction ---
                document.querySelectorAll('img').forEach(img => {
                  img.contentEditable = "false"; 
                  
                  // Click to upload
                  img.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.parent.postMessage({ type: 'PIN2SITE_IMG_CLICK', id: e.target.id }, '*');
                  });

                  // Drag & Drop
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
                              // Optimistic update for instant feedback
                              img.src = reader.result;
                              
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

              // --- Text Editing Sync ---
              let timeout;
              
              const sendUpdate = () => {
                 window.parent.postMessage({ type: 'PIN2SITE_HTML_UPDATE', html: document.body.innerHTML }, '*');
              }

              document.body.addEventListener('input', function(e) {
                if (!isEditable) return;
                
                // Signal parent that user is typing to prevent clobbering focus
                window.parent.postMessage({ type: 'PIN2SITE_USER_TYPING', isTyping: true }, '*');

                clearTimeout(timeout);
                timeout = setTimeout(() => {
                  sendUpdate();
                  window.parent.postMessage({ type: 'PIN2SITE_USER_TYPING', isTyping: false }, '*');
                }, 800);
              });

              // Save on blur
              document.body.addEventListener('blur', function(e) {
                 if (isEditable) sendUpdate();
              }, true);
              
            </script>
          </body>
        </html>
      `);
      doc.close();
    };

    // Check if we actually need to update
    const doc = iframe.contentDocument;
    if (doc && doc.body) {
       // If the user is actively typing (according to our ref), SKIP the write.
       if (isUserTypingRef.current) {
         return;
       }
       // Compare roughly
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

  // Calculate width styles based on device mode
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
    <div className={`transition-all duration-300 mx-auto flex flex-col bg-white overflow-hidden relative ${getContainerStyles()}`} style={{ height: deviceMode === 'desktop' ? '100%' : '800px' }}>
      
      {/* Fake Device UI elements for mobile/tablet */}
      {deviceMode !== 'desktop' && (
        <div className="absolute top-0 left-0 w-full h-[40px] flex justify-center items-center pointer-events-none">
          <div className="w-20 h-4 bg-gray-700 rounded-full"></div>
        </div>
      )}

      {/* Header only for desktop mode as mobile/tablet have "device bezels" */}
      {deviceMode === 'desktop' && (
        <div className="h-8 bg-gray-100 border-b border-gray-200 flex items-center px-4 justify-between shrink-0">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
          </div>
          <div className="flex-1 text-center">
              {isEditable ? (
                  <span className="text-xs font-bold text-indigo-600 animate-pulse">
                      <i className="fa-solid fa-pen mr-1"></i> Visual Editor Active
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
         <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gray-700 rounded-full pointer-events-none"></div>
      )}
    </div>
  );
};

export default PreviewFrame;