import { fetchWithAuth } from "@/utils/fetchWithAuth";

export const fetchBatches = async (page = "1") => {
  const res = await fetchWithAuth(`/api/AllBatches?page=${page}`);
  if (!res.ok) throw new Error("Failed to fetch batches");
  return res.json();
};

export const searchBatch = async (query: string, page = 1) => {
  const res = await fetchWithAuth(
    `/api/searchBatch?name=${query}&page=${page}`
  );
  if (!res.ok) throw new Error("Failed to search batches");
  return res.json();
};

export const BatchInfo = async (
  BatchId: string,
  type: string,
  page?: number
) => {
  let url = `/api/BatchInfo?BatchId=${BatchId}&Type=${type}`;

  if (type === "announcement" && page !== undefined) {
    url += `&page=${page ?? 1}`;
  }

  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error("Failed to search batches");
  return res.json();
};

export const SubjectInfo = async (
  BatchId: string,
  SubjectId: string,
  page?: number,
  batchTagType?: string
) => {
  let url = `/api/SubjectInfo?BatchId=${BatchId}&SubjectId=${SubjectId}&page=${
    page ?? 1
  }`;
  if (batchTagType) {
    url += `&batchTagType=${encodeURIComponent(batchTagType)}`;
  }

  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error("Failed to search batches");
  return res.json();
};
export const TopicInfo = async (
  BatchId: string,
  SubjectId: string,
  TopicId: string,
  ContentType: string,
  page?: number,
  isKhazana?: boolean,
  programId?: string,
  chapterId?: string
) => {
  let url = `/api/TopicInfo?BatchId=${BatchId}&SubjectId=${SubjectId}&TopicId=${TopicId}&ContentType=${ContentType}&page=${
    page ?? 1
  }`;
  if (isKhazana) {
    url += `&isKhazana=true&programId=${programId}&chapterId=${chapterId}`;
  }

  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error("Failed to fetch topics");
  return res.json();
};

export const getKhazanaInfo = async (ProgramId: string, Type: "filters" | "teachers") => {
  const url = `/api/KhazanaInfo?ProgramId=${ProgramId}&Type=${Type}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error("Failed to fetch Khazana info");
  return res.json();
};

export const getKhazanaChapters = async (ProgramId: string, SubjectId: string, page?: number, limit?: number) => {
  const url = `/api/KhazanaInfo?ProgramId=${ProgramId}&Type=chapters&SubjectId=${SubjectId}&page=${page ?? 1}&limit=${limit ?? 20}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error("Failed to fetch Khazana chapters");
  return res.json();
};

export const getKhazanaTopics = async (ProgramId: string, SubjectId: string, ChapterId: string, page?: number, limit?: number) => {
  const url = `/api/KhazanaInfo?ProgramId=${ProgramId}&Type=topics&SubjectId=${SubjectId}&ChapterId=${ChapterId}&page=${page ?? 1}&limit=${limit ?? 20}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error("Failed to fetch Khazana topics");
  return res.json();
};

// Assuming fetchWithAuth handles Authorization headers globally

export const enrollBatch = async (batchId: string, name: string) => {
  const url = "/api/enrollBatch";

  const res = await fetchWithAuth(url, {
    method: "POST",
    body: JSON.stringify({ batchId, name }),
  });

  if (!res.ok) throw new Error("Failed to enroll batch");
  return res.json();
};
export const UnenrollBatch = async (batchId: string, name: string) => {
  const url = "/api/UnenrollBatch";

  const res = await fetchWithAuth(url, {
    method: "POST",
    body: JSON.stringify({ batchId, name }),
  });

  if (!res.ok) throw new Error("Failed to enroll batch");
  return res.json();
};

export const getEnrolledBatches = async () => {
  const url = "/api/AboutMe";

  const res = await fetchWithAuth(url, {
    method: "GET",
  });

  if (!res.ok) throw new Error("Failed to fetch enrolled batches");
  
  const data = await res.json();
  
  // Validate the response structure
  if (!data || typeof data !== 'object') {
    throw new Error("Invalid response format from server");
  }
  
  if (!Array.isArray(data.enrolledBatches)) {
    console.warn("enrolledBatches is not an array, setting to empty array");
    data.enrolledBatches = [];
  }
  
  return data; // should return { enrolledBatches: [...] }
};
export const GetPdf = async (
  BatchId: string,
  SubjectId: string,
  pdfId: string,
) => {
  let url = `/api/GetPdf?BatchId=${BatchId}&SubjectId=${SubjectId}&PdfId=${pdfId}`;

  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error("Failed to fetch topics");
  return res.json();
};

export const getTodaysSchedule = async (batchId: string) => {
  const res = await fetchWithAuth("/api/todays-schedule", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ batchId }),
  });

  if (!res.ok) throw new Error("Failed to get today's classes");

  return res.json(); // Returns { data: [...] }
};

export const getUserDetailsList = async (userIds: string[]) => {
  const idsParam = userIds.join(","); // <-- This was missing

  const res = await fetchWithAuth("/api/get-user-details-list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ idsParam }), // Now idsParam is defined
  });

  if (!res.ok) throw new Error("Failed to get teacher details");

  return res.json(); // Expected shape: { success: true, data: [...] }
};
export const CheckTGStatus = async () => {
  const res = await fetchWithAuth("/api/CheckTgStatus", {
    method: "GET",
  });

  if (!res.ok) throw new Error("Failed to verify Telegram status");

  return res.json(); // Expected shape: { success: true, data: [...] }
};

export const getDppList = async (
  batchId: string,
  batchSubjectId: string,
  chapterId: string,
  page = 1
) => {
  const res = await fetchWithAuth(
    `/api/DppList?batchId=${batchId}&batchSubjectId=${batchSubjectId}&chapterId=${chapterId}&page=${page}`
  );
  if (!res.ok) throw new Error("Failed to fetch DPP list");
  return res.json();
};

export const getTests = async (batchId: string, isSubjective = false) => {
  const res = await fetchWithAuth(
    `/api/tests?batchId=${batchId}&isSubjective=${isSubjective}`
  );
  if (!res.ok) throw new Error("Failed to fetch tests list");
  return res.json();
};

export const getTestSyllabus = async (testId: string) => {
  const res = await fetchWithAuth(`/api/testSyllabus?testId=${testId}`);
  if (!res.ok) throw new Error("Failed to fetch test syllabus");
  return res.json();
};

export const getCommunityChannels = async (batchId: string) => {
  const res = await fetchWithAuth(`/api/community-channels?batchId=${encodeURIComponent(batchId)}`);
  if (!res.ok) throw new Error("Failed to fetch community channels");
  return res.json();
};

export const getCommunityPosts = async (channelId: string, page: number, batchId?: string) => {
  let url = `/api/community?channelId=${encodeURIComponent(channelId)}&page=${page}`;
  if (batchId) {
    url += `&batchId=${encodeURIComponent(batchId)}`;
  }
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error("Failed to fetch community posts");
  return res.json();
};

export const getUserGamificationProfiles = async (userIds: string[], batchId: string) => {
  const res = await fetchWithAuth("/api/gamification-profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_ids: userIds, batchId }),
  });
  if (!res.ok) throw new Error("Failed to fetch gamification profiles");
  return res.json();
};




export const SourceBatchInfo = async (batchId: string) => {
  const res = await fetchWithAuth(`/api/public-batch-info?batchId=${encodeURIComponent(batchId)}`);
  if (!res.ok) throw new Error("Batch not found in source");
  return res.json();
};
