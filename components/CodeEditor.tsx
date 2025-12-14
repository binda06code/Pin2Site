import React, { useState, useEffect } from 'react';

interface CodeEditorProps {
  html: string;
  onUpdate: (newHtml: string) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ html, onUpdate }) => {
  const [value, setValue] = useState(html);

  // Sync with external updates (e.g. undo/redo)
  useEffect(() => {
    setValue(html);
  }, [html]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  };

  const handleBlur = () => {
    if (value !== html) {
      onUpdate(value);
    }
  };

  return (
    <div className="w-full h-full bg-[#1e1e1e] rounded-lg shadow-2xl overflow-hidden flex flex-col border border-gray-800">
      <div className="h-8 bg-[#252526] border-b border-[#333] flex items-center px-4 justify-between shrink-0">
        <span className="text-xs text-gray-400 font-mono">index.html</span>
        <span className="text-xs text-yellow-500"><i className="fa-solid fa-triangle-exclamation mr-1"></i> Edit with caution</span>
      </div>
      <div className="flex-1 relative">
        <textarea
          className="w-full h-full bg-[#1e1e1e] text-blue-300 font-mono text-sm p-4 outline-none resize-none leading-relaxed"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default CodeEditor;