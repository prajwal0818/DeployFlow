import api from "./api";

export const projectService = {
  getProjects: () => api.get("/projects"),
  createProject: (data) => api.post("/projects", data),
  deleteProject: (id) => api.delete(`/projects/${id}`),
};
