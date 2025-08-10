// Shared IPC types for generateToken

export interface GenerateTokenReq {
  modelName: string;
}

export interface GenerateTokenResp {
  token?: string;
  signedToken?: string;
  error?: any;
}

