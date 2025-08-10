// Shared IPC types for generateToken

export interface GenerateTokenReq {
  modelName: string;
}

export interface GenerateTokenResp {
  token?: string;
  signedToken?: string;
  error?: any;
}

export interface LLMProxyReq {
  token: string;
  signedToken: string;
  modelName: string;
}

export interface LLMProxyResp {
  data?: any;
  error?: any;
}
