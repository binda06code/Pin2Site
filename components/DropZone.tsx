import React, { useState, useRef } from 'react';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

const DropZone: React.FC<DropZoneProps> = ({ onFileSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndPass(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndPass(e.target.files[0]);
    }
  };

  const validateAndPass = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert("Please upload an image file.");
      return;
    }
    onFileSelect(file);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
      className={`
        relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300
        flex flex-col items-center justify-center p-8 h-64
        ${disabled ? 'opacity-50 cursor-not-allowed border-gray-700' : ''}
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]' 
          : 'border-gray-700 hover:border-indigo-400 hover:bg-gray-800/50'
        }
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
        disabled={disabled}
      />
      
      <div className="bg-gray-800 p-4 rounded-full mb-4 group-hover:bg-indigo-600 transition-colors">
        <i className="fa-solid fa-cloud-arrow-up text-2xl text-white"></i>
      </div>
      
      <p className="text-lg font-medium text-gray-200">
        {isDragging ? "Drop to magic!" : "Drop layout image here"}
      </p>
      <p className="text-sm text-gray-400 mt-2">
        or click to browse
      </p>
    </div>
  );
};

export default DropZone;