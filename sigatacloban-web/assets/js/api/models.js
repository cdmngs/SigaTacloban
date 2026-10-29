import { ApiError, api, unwrapResponse } from "./client.js";
import { setSharedData } from "../core/store.js";

let mockActiveModel;
let mockDatasets;

function normalizeModel(model) {
  const rawMetrics = model.metrics || {};
  return {
    ...model,
    metrics: {
      ...rawMetrics,
      f1: rawMetrics.f1 ?? rawMetrics.f1Score ?? rawMetrics.f1_score,
      rocAuc: rawMetrics.rocAuc ?? rawMetrics.roc_auc ?? rawMetrics.rocAUC,
    },
    confusionMatrix: model.confusionMatrix || model.confusion_matrix || null,
  };
}

export async function fetchModelEvaluation(options = {}) {
  const response = await api.get("/models/evaluation", {
    ...options,
    mockSample: "models-evaluation",
    mockTransform: (sample) => ({
      data: mockActiveModel
        ? { ...sample, models: sample.models.map((model) => ({ ...model, active: model.id === mockActiveModel })) }
        : sample,
      meta: {},
    }),
  });
  const raw = unwrapResponse(response);
  const result = { ...raw, models: (raw.models || []).map(normalizeModel) };
  const active = result.models?.find((model) => model.active)?.id || null;
  setSharedData({ activeModel: active });
  return result;
}

export async function uploadDataset(file, options = {}) {
  const body = new FormData();
  body.append("file", file);
  const response = await api.post("/models/datasets", body, {
    ...options,
    mockSample: "models-upload",
    mockTransform: async (sample) => {
      options.onUploadProgress?.({ loaded: file.size, total: file.size, percent: 100 });
      const contents = await file.text();
      const lines = contents.split(/\r?\n/).filter((line) => line.trim());
      const columns = lines[0]?.split(",").map((column) => column.trim().replace(/^"|"$/g, "")) || [];
      const records = Math.max(0, lines.length - 1);
      const dataset = {
        ...sample,
        datasetId: `dataset-${crypto.randomUUID()}`,
        fileName: file.name,
        uploadedRecords: records,
        preparation: {
          rowsRead: records,
          rowsRejected: 0,
          columns,
          dateRange: null,
        },
        rejectedRows: [],
      };
      mockDatasets = [dataset, ...(mockDatasets || [])];
      return { data: dataset, meta: {} };
    },
  });
  return unwrapResponse(response);
}

export async function listDatasets(options = {}) {
  const response = await api.get("/models/datasets", {
    ...options,
    mockSample: "models-datasets",
    mockTransform: (sample, meta) => {
      if (!mockDatasets) mockDatasets = sample;
      return { data: mockDatasets, meta: { ...meta, total: mockDatasets.length, page: 1, pageSize: mockDatasets.length } };
    },
  });
  return unwrapResponse(response);
}

export async function retrainModel(payload, options = {}) {
  return unwrapResponse(await api.post("/models/retrain", payload, {
    ...options,
    mockSample: "models-retrain",
    mockTransform: (sample) => {
      const dataset = mockDatasets?.find((item) => (item.datasetId || item.id) === payload.datasetId);
      if (dataset && Number(dataset.uploadedRecords) < 20) {
        throw new ApiError({ code: "DATASET_TOO_SMALL", message: "A model cannot be trained yet.", status: 422 });
      }
      return { data: { ...sample, status: "completed", completedAt: new Date().toISOString() }, meta: {} };
    },
  }));
}

export async function selectActiveModel(modelId, options = {}) {
  const result = unwrapResponse(await api.put("/models/active", { modelId }, {
    ...options,
    mockSample: "models-active",
    mockTransform: (sample) => ({ data: { ...sample, id: modelId, active: true }, meta: {} }),
  }));
  mockActiveModel = result?.id || modelId;
  setSharedData({ activeModel: mockActiveModel });
  return result;
}

export async function getRetrainJob(jobId, options = {}) {
  return unwrapResponse(await api.get(`/models/jobs/${encodeURIComponent(jobId)}`, {
    ...options,
    mockSample: "models-job",
    mockTransform: (sample) => ({ data: { ...sample, jobId, status: "completed", completedAt: new Date().toISOString() }, meta: {} }),
  }));
}
