import axios from 'axios';

const API_BASE_URL = 'http://localhost:8081/api/decision';

export const droolsApi = {
  evaluateDecision: async (payload) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/evaluate`, payload);
      return response.data;
    } catch (error) {
      console.error('Error calling Drools backend:', error);
      throw error;
    }
  },
  listModels: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/models`);
      return response.data;
    } catch (error) {
      console.error('Error fetching DMN models:', error);
      throw error;
    }
  }
};

// Helper: if frontend passes composite ids like 'name::namespace', the backend currently
// matches by name only. Normalize by taking the left-hand name part so requests succeed.
function normalizeModelId(modelId) {
  if (!modelId) return modelId;
  if (typeof modelId !== 'string') return modelId;
  if (modelId.includes('::')) return modelId.split('::')[0];
  return modelId;
}

// Added helper to fetch expanded schema for a model
droolsApi.getModelSchema = async (modelName) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/models/${encodeURIComponent(modelName)}/schema`);
    return response.data;
  } catch (error) {
    console.error('Error fetching model schema:', error);
    throw error;
  }
};

droolsApi.listDecisionTables = async (modelName) => {
  try {
    const normalized = normalizeModelId(modelName);
    const response = await axios.get(`${API_BASE_URL}/models/${encodeURIComponent(normalized)}/tables`);
    return response.data;
  } catch (error) {
    console.error('Error fetching decision tables:', error.toString(), error.response ? error.response.data : 'no response');
    throw error;
  }
};

droolsApi.getDecisionTable = async (modelName, decisionName) => {
  try {
    const normalized = normalizeModelId(modelName);
    const response = await axios.get(`${API_BASE_URL}/models/${encodeURIComponent(normalized)}/tables/${encodeURIComponent(decisionName)}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching decision table:', error.toString(), error.response ? error.response.data : 'no response');
    throw error;
  }
};

droolsApi.updateDecisionTable = async (modelName, decisionName, decisionTableXml, testCases) => {
  try {
    const normalized = normalizeModelId(modelName);
    const payload = { decisionTableXml };
    if (typeof testCases !== 'undefined') payload.testCases = testCases;
    const response = await axios.put(`${API_BASE_URL}/models/${encodeURIComponent(normalized)}/tables/${encodeURIComponent(decisionName)}`, payload);
    return response.data;
  } catch (error) {
    console.error('Error updating decision table:', error.toString(), error.response ? error.response.data : 'no response');
    throw error;
  }
};
