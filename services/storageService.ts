import { Project } from "../types";

const STORAGE_KEY = "pin2site_projects";

export const getProjects = (): Project[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load projects", e);
    return [];
  }
};

export const saveProject = (project: Project) => {
  try {
    const projects = getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    
    // Update existing or add new
    if (index >= 0) {
      projects[index] = { ...projects[index], ...project, lastModified: Date.now() };
    } else {
      projects.unshift(project); // Add to top
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error("Failed to save project", e);
    // Handle quota exceeded if necessary
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      alert("Storage full! Please delete some old projects.");
    }
  }
};

export const deleteProject = (id: string) => {
  const projects = getProjects().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

export const getProject = (id: string): Project | undefined => {
  return getProjects().find(p => p.id === id);
};