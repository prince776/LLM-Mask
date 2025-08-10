import { RSABSSA } from "@cloudflare/blindrsa-ts";
import { RSAKeys, SERVER_URL } from "../types/config";
import { getCookieHeader } from "./utils";
import log from "electron-log/main";
import { GenerateTokenReq, GenerateTokenResp } from "../types/ipc";

// TODOs:
// 1. Proper retry mechanism when requesting token/ Making LLM Proxy requests.
// 2. Save tokens in local store.
// 3. Store the chats in local store as well. This entire thing needs to
//    go to proxy server in every call.
// 4. Forward llm-proxy request via tor port.

export async function GenerateToken(req: GenerateTokenReq): Promise<GenerateTokenResp> {
  const modelName = req.modelName;
  const publicKeyPEMForModel = RSAKeys[modelName];
  if (!publicKeyPEMForModel) {
    throw `No public key found for model: ${modelName}`;
  }

  const publicKey = await getCryptoKey(publicKeyPEMForModel);

  // 1. Generate Blinded Token.
  const uniqueID = crypto.randomUUID();
  const token = new TextEncoder().encode(uniqueID);
  log.info("Initiating blind signing for token:", uniqueID);

  const suite = RSABSSA.SHA384.PSS.Randomized();
  const blindedToken = await suite.blind(publicKey, token);

  // 2. Get the signed blinded token from the server.
  const requestID = crypto.randomUUID();
  const resp = await fetch(`${SERVER_URL}/api/v1/auth-token/${modelName}`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...(await getCookieHeader()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      "RequestID": requestID,
      "BlindedToken": uint8ArrayToBase64(blindedToken.blindedMsg),
      "ModelName": modelName
    })
  }); // TODO: Add retries.
  if (!resp.ok) {
    const errorData = await resp.json();
    log.info("failed to get signed blinded token", errorData);
    throw errorData;
  }
  const data = await resp.json();
  log.info("Successfully got signed blinded token");
  const base64SignedBlinded = data.data.SignedBlindedToken;
  const signedBlindedToken = base64ToUint8Array(base64SignedBlinded);

  // 3. Unblind and finalize the signature.
  const finalSignature = await suite.finalize(
    publicKey,
    token,
    signedBlindedToken,
    blindedToken.inv,
  );

  // 5. Verify the final signature using the CryptoKey.
  const isValid = await suite.verify(publicKey, finalSignature, token);

  if (isValid) {
    log.info('Signature is valid! The anonymous token is ready to use. 🎉');
    return {
      token: uint8ArrayToBase64(token),
      signedToken: uint8ArrayToBase64(finalSignature)
    }
  } else {
    log.info('Signature verification failed.');
    throw new Error('Invalid signature.');
  }
}

async function getCryptoKey(pem: string): Promise<CryptoKey> {
  const pemHeader = '-----BEGIN PUBLIC KEY-----';
  const pemFooter = '-----END PUBLIC KEY-----';
  const pemText = pem.substring(pemHeader.length, pem.length - pemFooter.length).trim();
  const binaryDerString = atob(pemText);
  const binaryDer = Uint8Array.from(binaryDerString, (c) => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    'spki',
    binaryDer,
    {
      name: 'RSA-PSS',
      hash: 'SHA-384',
    },
    true, // extractable
    ['verify']
  );
}

export function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = '';
  const bytes = [].slice.call(new Uint8Array(buffer));
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary);
}

function base64ToUint8Array(base64String: string): Uint8Array {
  return Uint8Array.from(atob(base64String), c => c.charCodeAt(0));
}
