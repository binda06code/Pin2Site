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
              }
              
              /* --- Editor UI Overlay Styles --- */
              #pin2site-ui-layer {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 0; /* Let it not block layout */
                z-index: 10000;
                pointer-events: none;
              }

              .p2s-hover-box {
                position: absolute;
                border: 2px solid #6366f1;
                pointer-events: none;
                z-index: 10001;
                transition: all 0.1s ease-out;
                display: none;
                box-shadow: 0 0 0 1px rgba(255,255,255,0.2);
              }

              .p2s-toolbar {
                position: absolute;
                top: -36px;
                right: -2px;
                display: flex;
                gap: 6px;
                background: #1e1b4b; /* Indigo-950 */
                padding: 6px 10px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                pointer-events: auto;
                opacity: 0;
                transform: translateY(5px);
                transition: opacity 0.2s, transform 0.2s;
              }
              
              .p2s-toolbar.visible {
                opacity: 1;
                transform: translateY(0);
              }

              .p2s-btn {
                background: #4338ca; /* Indigo-700 */
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 10px;
                font-size: 11px;
                font-family: sans-serif;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                white-space: nowrap;
                transition: background 0.2s;
              }

              .p2s-btn:hover {
                background: #6366f1;
              }
              
              .p2s-tag-label {
                background: #312e81;
                color: #a5b4fc;
                font-size: 10px;
                padding: 4px 8px;
                border-radius: 4px;
                text-transform: uppercase;
                font-weight: bold;
                margin-right: 4px;
              }

              /* Hide scrollbar */
              ::-webkit-scrollbar { width: 0px; background: transparent; }

              /* Editing Active State */
              .editing-active {
                outline: none !important; /* Hide browser default focus */
                background-color: rgba(99, 102, 241, 0.05);
              }
            </style>
          </head>
          <body>
            ${html}
            
            <!-- Editor UI Container -->
            <div id="pin2site-ui-layer">
              <div id="p2s-hover-box" class="p2s-hover-box">
                <div id="p2s-toolbar" class="p2s-toolbar">
                   <!-- Buttons injected by JS -->
                </div>
              </div>
            </div>

            <script>
              const isEditable = ${isEditable};
              
              if (isEditable) {
                const hoverBox = document.getElementById('p2s-hover-box');
                const toolbar = document.getElementById('p2s-toolbar');
                let currentTarget = null;
                let isEditingText = false;

                // --- Helper: Update Toolbar Position ---
                const updateOverlay = () => {
                  if (!currentTarget || isEditingText) {
                    hoverBox.style.display = 'none';
                    return;
                  }
                  
                  const rect = currentTarget.getBoundingClientRect();
                  const scrollTop = window.scrollY || document.documentElement.scrollTop;
                  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

                  hoverBox.style.width = rect.width + 'px';
                  hoverBox.style.height = rect.height + 'px';
                  hoverBox.style.top = (rect.top + scrollTop) + 'px';
                  hoverBox.style.left = (rect.left + scrollLeft) + 'px';
                  hoverBox.style.display = 'block';
                  
                  // Ensure toolbar doesn't go off-screen top
                  if (rect.top < 40) {
                     toolbar.style.top = '100%';
                     toolbar.style.bottom = 'auto';
                     toolbar.style.marginTop = '4px';
                  } else {
                     toolbar.style.top = '-36px';
                     toolbar.style.bottom = 'auto';
                     toolbar.style.marginTop = '0';
                  }
                  
                  toolbar.classList.add('visible');
                };

                // --- Helper: Build Toolbar Content ---
                const showToolbar = (el) => {
                  currentTarget = el;
                  toolbar.innerHTML = ''; // Clear previous

                  // Label
                  const label = document.createElement('span');
                  label.className = 'p2s-tag-label';
                  label.innerText = el.tagName.toLowerCase();
                  toolbar.appendChild(label);

                  // Actions based on type
                  if (el.tagName === 'IMG') {
                     const btn = createBtn('fa-solid fa-image', 'Change Image', () => {
                        window.parent.postMessage({ type: 'PIN2SITE_IMG_CLICK', id: el.id }, '*');
                     });
                     toolbar.appendChild(btn);
                  } 
                  else if (el.tagName === 'A') {
                     const btnLink = createBtn('fa-solid fa-link', 'Edit Link', () => {
                        const newHref = prompt("Edit Link URL:", el.getAttribute('href'));
                        if (newHref !== null) {
                           el.setAttribute('href', newHref);
                           sendUpdate();
                        }
                     });
                     toolbar.appendChild(btnLink);
                     
                     const btnText = createBtn('fa-solid fa-pen', 'Edit Text', () => {
                        enterTextEditMode(el);
                     });
                     toolbar.appendChild(btnText);
                  }
                  else if (el.tagName === 'I' || el.tagName === 'SVG' || el.classList.contains('fa') || el.classList.contains('fa-solid')) {
                     const btn = createBtn('fa-solid fa-icons', 'Swap Icon', () => {
                        const currentClass = el.className;
                        const newClass = prompt("Enter FontAwesome classes (e.g. 'fa-solid fa-house'):", currentClass);
                        if (newClass) {
                           el.className = newClass;
                           sendUpdate();
                        }
                     });
                     toolbar.appendChild(btn);
                  }
                  else {
                     // Default text handling
                     const btn = createBtn('fa-solid fa-pen', 'Edit Text', () => {
                        enterTextEditMode(el);
                     });
                     toolbar.appendChild(btn);
                  }
                  
                  updateOverlay();
                };

                const createBtn = (iconClass, text, onClick) => {
                  const btn = document.createElement('button');
                  btn.className = 'p2s-btn';
                  btn.innerHTML = \`<i class="\${iconClass}"></i> \${text}\`;
                  btn.onclick = (e) => {
                    e.stopPropagation();
                    onClick();
                  };
                  return btn;
                };

                const enterTextEditMode = (el) => {
                   isEditingText = true;
                   hoverBox.style.display = 'none'; // Hide overlay while typing
                   el.contentEditable = "true";
                   el.focus();
                   el.classList.add('editing-active');
                   
                   // Select all text for easy replacement (optional)
                   // const range = document.createRange();
                   // range.selectNodeContents(el);
                   // const sel = window.getSelection();
                   // sel.removeAllRanges();
                   // sel.addRange(range);
                };

                // --- Event Listeners ---

                document.body.addEventListener('mouseover', (e) => {
                   if (isEditingText) return;
                   
                   // Identify valid targets
                   const el = e.target;
                   if (el === document.body || el.id === 'pin2site-ui-layer' || el.closest('#pin2site-ui-layer')) return;
                   
                   // Filter strictly for meaningful elements
                   const validTags = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','IMG','LI', 'I'];
                   
                   // Logic: Is it a valid tag? OR does it have direct text content?
                   const hasText = el.childNodes.length > 0 && el.childNodes[0].nodeType === 3 && el.innerText.trim().length > 0;
                   const isValidTag = validTags.includes(el.tagName);
                   const isIcon = el.classList.contains('fa') || el.classList.contains('fa-solid') || el.tagName === 'SVG';

                   if (isValidTag || hasText || isIcon) {
                      e.stopPropagation();
                      showToolbar(el);
                   }
                });

                // Clear overlay when leaving the body or hovering invalid areas
                document.body.addEventListener('mouseout', (e) => {
                   if (e.relatedTarget === null || e.relatedTarget.tagName === 'HTML') {
                      // Left the iframe
                      hoverBox.style.display = 'none';
                   }
                });
                
                // Update position on scroll
                window.addEventListener('scroll', updateOverlay);
                window.addEventListener('resize', updateOverlay);

                // --- Global Interactions ---

                // Prevent links from navigating
                document.addEventListener('click', (e) => {
                  const link = e.target.closest('a');
                  if (link) e.preventDefault();
                });
                
                // Exit edit mode
                document.addEventListener('blur', (e) => {
                   if (e.target.isContentEditable) {
                      e.target.contentEditable = "false";
                      e.target.classList.remove('editing-active');
                      isEditingText = false;
                      sendUpdate();
                   }
                }, true);
                
                // Double click shortcuts
                document.addEventListener('dblclick', (e) => {
                   const el = e.target;
                   if (el.tagName === 'IMG') {
                      window.parent.postMessage({ type: 'PIN2SITE_IMG_CLICK', id: el.id }, '*');
                   } else {
                      // Try to edit text
                       if (!el.closest('#pin2site-ui-layer')) {
                          enterTextEditMode(el);
                       }
                   }
                });

                // --- Sync Logic ---
                let timeout;
                const sendUpdate = () => {
                   // Remove our UI layer before sending HTML
                   const uiLayer = document.getElementById('pin2site-ui-layer');
                   const parent = uiLayer.parentNode;
                   parent.removeChild(uiLayer);
                   
                   const cleanHtml = document.body.innerHTML;
                   
                   // Put it back
                   parent.appendChild(uiLayer);

                   window.parent.postMessage({ type: 'PIN2SITE_HTML_UPDATE', html: cleanHtml }, '*');
                }

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
              }
            </script>
          </body>
        </html>
      `);
      doc.close();
    };

    const doc = iframe.contentDocument;
    if (doc && doc.body) {
       if (isUserTypingRef.current) return;
       // Basic check to avoid redraws
       // We can't strictly compare HTML anymore because we inject the UI layer.
       // So we check if the cleaned content matches.
       const currentBody = doc.body.cloneNode(true);
       const ui = currentBody.querySelector('#pin2site-ui-layer');
       if (ui) ui.remove();
       
       if (currentBody.innerHTML === html) return;
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