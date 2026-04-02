const { generateKeyPairSync, privateDecrypt, createPublicKey, constants } = require("crypto");

let privateKey, publicKey;

if (process.env.RSA_PRIVATE_KEY) {
  // Use fixed key from environment (production)
  privateKey = process.env.RSA_PRIVATE_KEY.replace(/\\n/g, "\n");
  publicKey = createPublicKey(privateKey).export({ type: "spki", format: "pem" });
} else {
  // Generate fresh key pair for local dev (keys last until server restarts)
  const keyPair = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding:  { type: "spki",  format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  privateKey = keyPair.privateKey;
  publicKey  = keyPair.publicKey;
}

const decrypt = (encryptedBase64) => {
  const buffer = Buffer.from(encryptedBase64, "base64");
  return privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    buffer
  ).toString("utf8");
};

module.exports = { publicKey, decrypt };
