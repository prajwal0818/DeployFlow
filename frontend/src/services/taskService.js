import api from "./api";

export const taskService = {
  list: (projectId) =>
    api.get("/tasks", { params: projectId ? { projectId } : {} }),
  getById: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post("/tasks", data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  remove: (id) => api.delete(`/tasks/${id}`),
};
