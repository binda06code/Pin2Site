import React from 'react';
import { Project } from '../types';
import DropZone from './DropZone';

interface DashboardProps {
  projects: Project[];
  onNewProject: (file: File) => void;
  onOpenProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ projects, onNewProject, onOpenProject, onDeleteProject }) => {
  
  const formatDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-gray-950 p-8 text-white overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <i className="fa-solid fa-wand-magic-sparkles text-xl"></i>
             </div>
             <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
               Pin2Site Dashboard
             </h1>
          </div>
          <div className="text-sm text-gray-400">
             {projects.length} Saved Themes
          </div>
        </header>

        {/* Hero / Create New Section */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold mb-6 flex items-center">
            <i className="fa-solid fa-plus-circle text-indigo-400 mr-2"></i> 
            Create New Theme
          </h2>
          <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-1">
             <DropZone onFileSelect={onNewProject} />
          </div>
          <p className="text-center text-gray-500 text-sm mt-4">
            Upload a screenshot from Pinterest, Dribbble, or any website.
          </p>
        </div>

        {/* Projects Grid */}
        <div>
          <h2 className="text-xl font-semibold mb-6 flex items-center">
             <i className="fa-solid fa-folder-open text-indigo-400 mr-2"></i>
             Your Library
          </h2>
          
          {projects.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-2xl">
               <div className="text-gray-600 mb-2"><i className="fa-regular fa-folder-open text-4xl"></i></div>
               <p className="text-gray-500">No themes saved yet. Start by uploading an image above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div 
                  key={project.id} 
                  className="group bg-gray-900 border border-gray-800 hover:border-indigo-500/50 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-900/20 hover:-translate-y-1 flex flex-col"
                >
                  {/* Thumbnail */}
                  <div 
                    onClick={() => onOpenProject(project)}
                    className="relative aspect-video bg-gray-800 cursor-pointer overflow-hidden"
                  >
                    {project.thumbnail ? (
                      <img src={project.thumbnail} alt={project.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-700">
                        <i className="fa-solid fa-image text-3xl"></i>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent opacity-60"></div>
                  </div>

                  {/* Details */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-gray-200 group-hover:text-indigo-400 transition-colors truncate mb-1">
                        {project.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        Edited {formatDate(project.lastModified)}
                      </p>
                    </div>

                    <div className="flex justify-between items-center mt-6">
                      <button 
                         onClick={() => onOpenProject(project)}
                         className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                        className="p-2 text-gray-600 hover:text-red-400 transition-colors"
                        title="Delete Theme"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;