const { generateKeyPairSync, privateDecrypt, constants } = require("crypto");

// Generate RSA key pair once at server startup
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding:  { type: "spki",  format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const decrypt = (encryptedBase64) => {
  const buffer = Buffer.from(encryptedBase64, "base64");
  return privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    buffer
  ).toString("utf8");
};

module.exports = { publicKey, decrypt };
