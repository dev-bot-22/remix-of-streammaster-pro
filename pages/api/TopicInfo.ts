// pages/api/subjectInfo.ts
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { getHeaders } from "@/utils/auth";
import { authenticateUser, clearAuthCookies } from "@/utils/authenticateUser";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Verify user token before proceeding
    const user = await authenticateUser(req, res);
    let ActualToken = user.ActualToken;
    const PW_API = (process.env.PW_API || "https://api.penpencil.co");
    const { BatchId, SubjectId, TopicId, ContentType, page, isKhazana, programId, chapterId } = req.query;

    // Validate required params first
    const errors: string[] = [];

    if (!BatchId) errors.push("`BatchId`");
    if (!SubjectId) errors.push("`SubjectId`");
    if (!TopicId) errors.push("`TopicId`");
    if (!ContentType) errors.push("`ContentType`");

    if (errors.length > 0) {
      return res
        .status(400)
        .json({ message: `Missing or invalid: ${errors.join(", ")}` });
    }

    // Normalize all fields
    const batchIdStr = Array.isArray(BatchId) ? BatchId[0] : BatchId ?? "";
    const subjectIdStr = Array.isArray(SubjectId)
      ? SubjectId[0]
      : SubjectId ?? "";
    const topicIdStr = Array.isArray(TopicId) ? TopicId[0] : TopicId ?? "";
    const contentTypeStr = Array.isArray(ContentType)
      ? ContentType[0]
      : ContentType ?? "";

    const pageStr = Array.isArray(page) ? page[0] : page;
    const pageNumber = parseInt(pageStr ?? "1", 10);

    const isKhazanaStr = Array.isArray(isKhazana) ? isKhazana[0] : isKhazana ?? "";
    const programIdStr = Array.isArray(programId) ? programId[0] : programId ?? "";
    const chapterIdStr = Array.isArray(chapterId) ? chapterId[0] : chapterId ?? "";

    if (isKhazanaStr === "true") {
      const url = `${PW_API}/v1/programs/${programIdStr}/subjects/${subjectIdStr}/chapters/${chapterIdStr}/topics/${topicIdStr}/contents?contentType=videos&page=${pageNumber}`;
      
      const response = await axios.get(url, {
        headers: getHeaders(ActualToken ?? ""),
      });

      const rawItems = response.data?.data || [];
      const mappedItems = rawItems.map((item: any) => {
        const isLecture = item.type === "Lecture" || item.type === "LectureSeries" || item.isVideoLecture;
        const firstContent = item.content?.[0] || {};
        
        let videoDetails = null;
        if (firstContent.videoDetails) {
          videoDetails = {
            _id: firstContent.videoDetails._id || item._id,
            id: firstContent.videoDetails.id || item._id,
            name: firstContent.videoDetails.name || item.title || "",
            image: firstContent.videoDetails.image || "/assets/img/video-placeholder.svg",
            duration: firstContent.videoDetails.duration || "00:00:00",
            videoUrl: firstContent.videoDetails.videoUrl || "",
            embedCode: firstContent.videoDetails.embedCode || "",
            createdAt: item.createdAt,
            types: firstContent.videoDetails.types || ["DASH", "HLS"],
            drmProtected: firstContent.videoDetails.drmProtected || false,
          };
        }

        let attachmentUrl = "";
        if (firstContent.fileId) {
          attachmentUrl = `${firstContent.fileId.baseUrl}${firstContent.fileId.key}`;
        }

        const isDpp = item.title?.toLowerCase().includes("dpp") || false;

        return {
          _id: item._id,
          topic: item.title || item.topic || "",
          date: item.createdAt,
          urlType: firstContent.videoType || "penpencilvdo",
          isVideoLecture: isLecture && !!videoDetails,
          isLocked: item.restrictContent || false,
          videoDetails,
          isDpp,
          homeworkIds: firstContent.fileId ? [{
            _id: firstContent.fileId._id,
            name: firstContent.fileId.name || item.title,
            attachmentUrl,
          }] : [],
        };
      });

      // Filter by requested contentTypeStr
      let filteredItems = [];
      if (contentTypeStr === "videos") {
        filteredItems = mappedItems.filter((item: any) => item.isVideoLecture);
      } else if (contentTypeStr === "notes") {
        filteredItems = mappedItems.filter((item: any) => !item.isVideoLecture && !item.isDpp && item.homeworkIds.length > 0);
      } else if (contentTypeStr === "DppNotes") {
        filteredItems = mappedItems.filter((item: any) => !item.isVideoLecture && item.isDpp && item.homeworkIds.length > 0);
      } else if (contentTypeStr === "DppVideos" || contentTypeStr === "DppVideo" || contentTypeStr === "dppVideos" || contentTypeStr === "dppVideo") {
        filteredItems = mappedItems.filter((item: any) => item.isVideoLecture && item.isDpp);
      } else {
        filteredItems = mappedItems;
      }

      return res.status(200).json({
        data: filteredItems,
      });
    }

    let resolvedSubjectId = subjectIdStr;
    let resolvedTopicId = topicIdStr;

    const isObjectId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

    // Fetch batch details once to resolve subject slug and teacher images mapping
    const detailsUrl = `${PW_API}/v3/batches/${batchIdStr}/details`;
    const detailsRes = await axios.get(detailsUrl, {
      headers: getHeaders(ActualToken ?? ""),
      timeout: 10000,
    });

    const subjects = detailsRes.data?.data?.subjects || [];
    const batchTeachers = detailsRes.data?.data?.teachers || [];

    const teacherImageMap: Record<string, string> = {};
    batchTeachers.forEach((t: any) => {
      if (t._id) {
        let imgUrl = "";
        if (t.imageId?.baseUrl && t.imageId?.key) {
          imgUrl = `${t.imageId.baseUrl}${t.imageId.key}`;
        } else if (t.imageUrl) {
          imgUrl = t.imageUrl;
        }
        teacherImageMap[t._id] = imgUrl;
      }
    });

    // 1. Resolve subject slug if necessary
    if (!isObjectId(resolvedSubjectId)) {
      console.log(`TopicInfo API: Resolving subject slug: ${resolvedSubjectId}`);
      const matchedSubject = subjects.find(
        (sub: any) => sub.slug === resolvedSubjectId || sub._id === resolvedSubjectId
      );
      if (matchedSubject) {
        resolvedSubjectId = matchedSubject._id;
        console.log(`TopicInfo API: Resolved subject slug to ID: ${resolvedSubjectId}`);
      } else {
        return res.status(404).json({
          message: `Subject with slug "${resolvedSubjectId}" not found in batch.`,
        });
      }
    }

    // 2. Resolve topic slug if necessary
    if (!isObjectId(resolvedTopicId)) {
      console.log(`TopicInfo API: Resolving topic slug: ${resolvedTopicId}`);
      let matchedTopic: any = null;
      for (let p = 1; p <= 3; p++) {
        const topicsUrl = `${PW_API}/v2/batches/${batchIdStr}/subject/${resolvedSubjectId}/topics?page=${p}`;
        const topicsRes = await axios.get(topicsUrl, {
          headers: getHeaders(ActualToken ?? ""),
          timeout: 10000,
        });
        const topics = topicsRes.data?.data || [];
        matchedTopic = topics.find((t: any) => t.slug === resolvedTopicId || t._id === resolvedTopicId);
        if (matchedTopic) break;
        if (topics.length === 0) break;
      }

      if (matchedTopic) {
        resolvedTopicId = matchedTopic._id;
        console.log(`TopicInfo API: Resolved topic slug to ID: ${resolvedTopicId}`);
      } else {
        return res.status(404).json({
          message: `Topic with slug "${resolvedTopicId}" not found under subject.`,
        });
      }
    }

    // Route DPP Videos specifically to Penpencil's v2 contents API
    if (
      contentTypeStr === "DppVideos" ||
      contentTypeStr === "dppVideos" ||
      contentTypeStr === "dpp-videos" ||
      contentTypeStr === "DPP_VIDEO"
    ) {
      const v2Url = `${PW_API}/v2/batches/${batchIdStr}/subject/${subjectIdStr}/contents?tag=${topicIdStr}&contentType=DppVideos&page=${pageNumber}`;
      console.log(`TopicInfo API: Routing DPP Videos request to v2 content API: ${v2Url}`);
      const v2Res = await axios.get(v2Url, {
        headers: getHeaders(ActualToken ?? ""),
      });
      const rawItems = v2Res.data?.data || [];
      const mappedItems = rawItems.map((item: any) => {
        const innerData = item.data || item;
        const teacherId = innerData.teachers?.[0];
        const teacherImage = teacherId ? teacherImageMap[teacherId] : "";
        return {
          ...innerData,
          _id: innerData._id || item._id,
          contentType: "DPP_VIDEO",
          teacherImage: teacherImage || innerData.teacherImage || "",
        };
      });
      return res.status(200).json({
        data: mappedItems,
      });
    }

    let v3ContentType = "ALL";
    if (contentTypeStr === "videos" || contentTypeStr === "lectures") v3ContentType = "LECTURES";
    else if (contentTypeStr === "notes") v3ContentType = "NOTES";
    else if (contentTypeStr === "DppNotes" || contentTypeStr === "dppPdfs") v3ContentType = "DPP_PDF";
    else if (contentTypeStr === "DppVideos" || contentTypeStr === "dppVideos") v3ContentType = "DPP_VIDEO";
    else if (contentTypeStr === "dpps") v3ContentType = "DPP_PDF";
    else if (contentTypeStr === "ALL" || contentTypeStr === "all") v3ContentType = "ALL";

    const skip = (pageNumber - 1) * 20;
    const url = `https://api.penpencil.co/batch-service/v3/batch-subject-schedules/${batchIdStr}/subject/${resolvedSubjectId}/contents?skip=${skip}&limit=20&contentType=${v3ContentType}&contentFilter=ALL&tagId=${resolvedTopicId}`;

    const response = await axios.get(url, {
      headers: getHeaders(ActualToken ?? ""),
    });

    const rawItems = response.data?.data || [];
    const mappedItems = rawItems.map((item: any) => {
      const innerData = item.data || item;
      const teacherId = innerData.teachers?.[0];
      const teacherImage = teacherId ? teacherImageMap[teacherId] : "";

      return {
        ...innerData,
        _id: innerData._id || item._id,
        contentType: item.type || innerData.contentType || "LECTURE",
        teacherImage: teacherImage || innerData.teacherImage || "",
      };
    });

    return res.status(200).json({
      data: mappedItems,
    });
  } catch (error: any) {
       
    const status = error.response?.status || 500;

    // 🚨 Handle 401 from downstream API
    if (status === 401) {
      clearAuthCookies(res);
    }

    return res.status(status).json({
      message: error.response?.data?.message || "Error fetching Topics",
    });
  }
}
