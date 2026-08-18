const BASE_URL = "http://localhost:8000/api/v1";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token") || localStorage.getItem("token");
}

function getHeaders(token?: string | null): HeadersInit {
  const headers: HeadersInit = {};
  const activeToken = token || getAuthToken();
  if (activeToken) {
    headers["Authorization"] = `Bearer ${activeToken}`;
  }
  return headers;
}

export async function apiRequest<T = any>(
  path: string,
  method: string = "GET",
  body?: any,
  token?: string | null,
  isMultipart: boolean = false
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers = getHeaders(token);

  let reqBody: any;
  if (body) {
    if (isMultipart) {
      reqBody = body;
      // Do NOT set Content-Type header; browser sets boundary automatically
    } else {
      (headers as any)["Content-Type"] = "application/json";
      reqBody = JSON.stringify(body);
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body: reqBody,
  });

  if (!response.ok) {
    let errorDetail = "API Request failed";
    try {
      const errRes = await response.json();
      errorDetail = errRes.detail || JSON.stringify(errRes);
    } catch (_) {
      errorDetail = await response.text();
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

// Authentication
export const authApi = {
  login: async (username: string, password: string) => {
    // login expects OAuth2 form data
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      let errorDetail = "Login failed";
      try {
        const errRes = await response.json();
        errorDetail = errRes.detail || JSON.stringify(errRes);
      } catch (_) {}
      throw new Error(errorDetail);
    }

    return response.json(); // returns { access_token: "...", token_type: "bearer" }
  },

  signup: (userData: any) => {
    return apiRequest("/auth/signup", "POST", userData);
  },

  getMe: (token?: string | null) => {
    return apiRequest("/auth/me", "GET", null, token);
  },
};

// Meetings
export const meetingsApi = {
  list: (token?: string | null, status?: string) => {
    const query = status ? `?status=${status}` : "";
    return apiRequest(`/meetings${query}`, "GET", null, token);
  },

  get: (id: number, token?: string | null) => {
    return apiRequest(`/meetings/${id}`, "GET", null, token);
  },

  getById: (id: number, token?: string | null) => {
    return apiRequest(`/meetings/${id}`, "GET", null, token);
  },

  create: (meetingData: any, token?: string | null) => {
    return apiRequest("/meetings", "POST", meetingData, token);
  },

  updateStatus: (id: number, statusStr: string, token?: string | null) => {
    return apiRequest(`/meetings/${id}/status?status_str=${statusStr}`, "PUT", null, token);
  },
};

// Audio & Speech-to-Text
export const audioApi = {
  upload: (meetingId: number, fileOrBlob: File | Blob, token?: string | null) => {
    const formData = new FormData();
    // Use proper name depending on if it's a file
    const filename = (fileOrBlob as File).name || "recording.webm";
    formData.append("file", fileOrBlob, filename);

    return apiRequest(`/audio/upload/${meetingId}`, "POST", formData, token, true);
  },

  getTranscript: (meetingId: number, token?: string | null) => {
    return apiRequest(`/audio/transcript/${meetingId}`, "GET", null, token);
  },

  updateTranscript: (meetingId: number, transcriptData: { raw_text?: string; diarized_json?: any[] }, token?: string | null) => {
    return apiRequest(`/audio/transcript/${meetingId}`, "PUT", transcriptData, token);
  },

  regenerateMinutes: (meetingId: number, token?: string | null) => {
    return apiRequest(`/audio/transcript/${meetingId}/regenerate-minutes`, "POST", null, token);
  },
};


// Minutes & finalization
export const minutesApi = {
  get: (meetingId: number, token?: string | null) => {
    return apiRequest(`/minutes/${meetingId}`, "GET", null, token);
  },

  update: (meetingId: number, minutesData: any, token?: string | null) => {
    return apiRequest(`/minutes/${meetingId}`, "PUT", minutesData, token);
  },

  finalize: (meetingId: number, token?: string | null) => {
    return apiRequest(`/minutes/${meetingId}/finalize`, "POST", null, token);
  },

  exportUrl: (meetingId: number, format: "text" | "json" = "text", lang: string = "original") => {
    return `${BASE_URL}/minutes/${meetingId}/export?format=${format}&lang=${lang}`;
  },
};

// Chatbot (RAG)
export const chatApi = {
  ask: (messages: any[], meetingId?: number | null, token?: string | null) => {
    return apiRequest("/chat", "POST", { messages, meeting_id: meetingId }, token);
  },
};

// Search (Global Semantic)
export const searchApi = {
  search: (query: string, token?: string | null) => {
    return apiRequest(`/search?query=${encodeURIComponent(query)}`, "GET", null, token);
  },
};

// Audit Logs
export const auditApi = {
  getLogs: (meetingId: number, token?: string | null) => {
    return apiRequest(`/audit/${meetingId}`, "GET", null, token);
  },
};

// Analytics Metrics
export const analyticsApi = {
  getDashboard: (token?: string | null) => {
    return apiRequest("/analytics/dashboard", "GET", null, token);
  },
};

// Translation Services
export const translationApi = {
  get: (meetingId: number, langCode: string, token?: string | null) => {
    return apiRequest(`/translation/${meetingId}/${langCode}`, "GET", null, token);
  },
  generate: (meetingId: number, langCode: string, token?: string | null) => {
    return apiRequest(`/translation/${meetingId}/${langCode}`, "POST", null, token);
  },
};

// Attendance
export const attendanceApi = {
  checkin: (meetingId: number, data: { user_id: number; method: string; gps_lat?: number; gps_lng?: number }, token?: string | null) => {
    return apiRequest(`/attendance/${meetingId}`, "POST", data, token);
  },
  getStats: (meetingId: number, token?: string | null) => {
    return apiRequest(`/attendance/${meetingId}/stats`, "GET", null, token);
  },
  list: (meetingId: number, token?: string | null) => {
    return apiRequest(`/meetings/${meetingId}`, "GET", null, token)
      .then((d: any) => d.attendance || []);
  },
  listUsers: (token?: string | null) => {
    return apiRequest(`/auth/users`, "GET", null, token);
  },
};

// Live Meeting Recording & Transport API
export const recordingApi = {
  start: (meetingId: number, authorizationConfirmed: boolean = true, token?: string | null) => {
    return apiRequest(`/audio/recording/${meetingId}/start`, "POST", { authorization_confirmed: authorizationConfirmed }, token);
  },
  pause: (meetingId: number, token?: string | null) => {
    return apiRequest(`/audio/recording/${meetingId}/pause`, "POST", null, token);
  },
  resume: (meetingId: number, token?: string | null) => {
    return apiRequest(`/audio/recording/${meetingId}/resume`, "POST", null, token);
  },
  uploadChunk: (meetingId: number, sequenceNumber: number, chunkBlob: Blob, checksum?: string, token?: string | null) => {
    const formData = new FormData();
    formData.append("sequence_number", sequenceNumber.toString());
    if (checksum) formData.append("checksum", checksum);
    formData.append("chunk_file", chunkBlob, `chunk_${sequenceNumber}.webm`);
    return apiRequest(`/audio/recording/${meetingId}/stream`, "POST", formData, token, true);
  },
  stop: (meetingId: number, token?: string | null) => {
    return apiRequest(`/audio/recording/${meetingId}/stop`, "POST", null, token);
  },
  getStatus: (meetingId: number, token?: string | null) => {
    return apiRequest(`/audio/recording/${meetingId}/status`, "GET", null, token);
  },
  getProcessingStatus: (meetingId: number, token?: string | null) => {
    return apiRequest(`/audio/processing/${meetingId}/status`, "GET", null, token);
  },
  retryProcessing: (meetingId: number, token?: string | null) => {
    return apiRequest(`/audio/processing/${meetingId}/retry`, "POST", null, token);
  },
  createMarker: (meetingId: number, label: string, timestampSeconds: number, note?: string, token?: string | null) => {
    return apiRequest(`/audio/markers/${meetingId}`, "POST", { label, timestamp_seconds: timestampSeconds, note }, token);
  },
  getMarkers: (meetingId: number, token?: string | null) => {
    return apiRequest(`/audio/markers/${meetingId}`, "GET", null, token);
  },
};

// Action Items Execution Dashboard API
export const actionItemsApi = {
  list: (status?: string, priority?: string, meetingId?: number, token?: string | null) => {
    let query = [];
    if (status) query.push(`status=${encodeURIComponent(status)}`);
    if (priority) query.push(`priority=${encodeURIComponent(priority)}`);
    if (meetingId) query.push(`meeting_id=${meetingId}`);
    const qStr = query.length > 0 ? `?${query.join("&")}` : "";
    return apiRequest(`/action-items${qStr}`, "GET", null, token);
  },
  create: (data: any, token?: string | null) => {
    return apiRequest(`/action-items`, "POST", data, token);
  },
  update: (id: number, data: any, token?: string | null) => {
    return apiRequest(`/action-items/${id}`, "PUT", data, token);
  },
  delete: (id: number, token?: string | null) => {
    return apiRequest(`/action-items/${id}`, "DELETE", null, token);
  },
};

// Decision Register API
export const decisionsApi = {
  list: (category?: string, impactLevel?: string, meetingId?: number, token?: string | null) => {
    let query = [];
    if (category) query.push(`category=${encodeURIComponent(category)}`);
    if (impactLevel) query.push(`impact_level=${encodeURIComponent(impactLevel)}`);
    if (meetingId) query.push(`meeting_id=${meetingId}`);
    const qStr = query.length > 0 ? `?${query.join("&")}` : "";
    return apiRequest(`/decisions${qStr}`, "GET", null, token);
  },
  create: (data: any, token?: string | null) => {
    return apiRequest(`/decisions`, "POST", data, token);
  },
  update: (id: number, data: any, token?: string | null) => {
    return apiRequest(`/decisions/${id}`, "PUT", data, token);
  },
  delete: (id: number, token?: string | null) => {
    return apiRequest(`/decisions/${id}`, "DELETE", null, token);
  },
};


