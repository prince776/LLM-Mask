// Shared config for Electron main and renderer
export const SERVER_URL = "http://localhost:8080"; // Update as needed

const gemini25FlashPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuV3ok7/IehRqGQLMzWGc
7LIYJPYHZqsmbZY9DedauMwxSKWx9Z3n7fjVPoqbVQyRFusBGYfENiE9D8w4a8rA
7h9bLSDHJShcElw/aVyUTX9Zdeb7qdwhXrk5tHyD6Oe8aRS71b4Z9h4PeJCe00o9
+Z1Zeude/TW9SQo7NdHUsW5oDI229sjIK2lCBFDXWFNL4PT8XeI0Ac7SgQ81EKDt
mk/oA8O034J9BiqwfluLcuI8XYwW0yROruKCLsYeGWpsbB4OX3SB+/HIL6oHjTqF
MjbNaFDnKjRVUUGItFLq38Z5LCZzp7ege+e7eKAvMybdm8CAvkVIPDm9KFRyHtz5
ewIDAQAB
-----END PUBLIC KEY-----`


export const RSAKeys = {
  "gemini-2.5-flash": gemini25FlashPublicKey,
}
