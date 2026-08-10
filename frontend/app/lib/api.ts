const BASE_URL = "http://localhost:8000/api/v1";

function getHeaders(token?: string | null): HeadersInit {
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
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

