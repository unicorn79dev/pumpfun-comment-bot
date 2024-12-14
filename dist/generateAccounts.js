"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const nacl = __importStar(require("tweetnacl"));
const naclUtil = __importStar(require("tweetnacl-util"));
const bs58_1 = __importDefault(require("bs58")); // For Base58 encoding
const fs_1 = __importDefault(require("fs"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const NUMBER_OF_ACCOUNT = parseInt(process.env.NUMBER_OF_ACCOUNT || "5");
const DIR_PATH = process.env.DIR_PATH || "cookies";
const HEADERS = {
    accept: '*/*',
    'content-type': 'application/json',
    origin: 'https://pump.fun',
};
// Logger function (mock logger for simplicity)
function log(message, level = 'info') {
    console.log(`[${level.toUpperCase()}]: ${message}`);
}
// Save cookies to a file
function saveCookiesToFile(cookies, filename = 'cookies.json') {
    try {
        fs_1.default.writeFileSync(filename, JSON.stringify(cookies, null, 2));
        log(`Cookies saved to ${filename}`);
    }
    catch (error) {
        log(`Failed to save cookies: ${error.message}`, 'error');
    }
}
// Generate signing and verifying keys
function generateKeypair() {
    const keypair = nacl.sign.keyPair();
    return { signingKey: keypair.secretKey, verifyKey: keypair.publicKey };
}
// Write generated data to a file
function writeToFile(secretKey, token, publicKey) {
    const filePath = 'accounts/generated.txt';
    try {
        fs_1.default.appendFileSync(filePath, `${token}\n`);
        log(`Data written to ${filePath}`);
    }
    catch (error) {
        log(`Failed to write to file: ${error.message}`, 'error');
    }
}
// Send HTTP POST request
async function sendRequest(url, payload = null) {
    try {
        const response = await axios_1.default.post(url, payload, { headers: HEADERS });
        log(`Response status: ${response.status}`);
        if (payload && response.status === 201) {
            const cookies = response.headers['set-cookie'];
            if (cookies) {
                saveCookiesToFile(cookies.reduce((acc, cookie) => {
                    const [nameValue] = cookie.split(';');
                    const [name, value] = nameValue.split('=');
                    acc[name] = value;
                    return acc;
                }, {}), `${DIR_PATH}/${payload["address"]}`);
            }
            return response.data.auth_token || null;
        }
        else {
            log(`Failed request with status ${response.status} and message: ${response.statusText}`, 'error');
            return null;
        }
    }
    catch (error) {
        log(`Error in sendRequest: ${error.message}`, 'error');
        return null;
    }
}
// Perform login
async function login(signingKey, verifyKey) {
    const timestamp = Date.now().toString();
    const message = `Sign in to pump.fun: ${timestamp}`;
    const messageBytes = naclUtil.decodeUTF8(message);
    const signature = nacl.sign.detached(messageBytes, signingKey);
    const payload = {
        address: bs58_1.default.encode(verifyKey),
        signature: bs58_1.default.encode(signature),
        timestamp,
    };
    const accessToken = await sendRequest('https://frontend-api-v2.pump.fun/auth/login', payload);
    if (accessToken) {
        log(`Stored access token: ${accessToken}`);
    }
    return accessToken;
}
// Main function
async function main() {
    const { signingKey, verifyKey } = generateKeypair();
    // const publicKey = bs58.encode(verifyKey);
    await login(signingKey, verifyKey);
    // const accessToken = await login(signingKey, verifyKey);
    // if (accessToken) {
    //     writeToFile(Buffer.from(signingKey).toString('hex'), accessToken, publicKey);
    // }
}
async function callMainWithDelay(generateAmount) {
    for (let i = 0; i < generateAmount; i++) {
        await main();
    }
}
(async () => {
    if (fs_1.default.existsSync(DIR_PATH)) {
        fs_1.default.rmSync(DIR_PATH, { recursive: true }); // `recursive: true` ensures that non-empty directories are deleted
        console.log(`${DIR_PATH} has been removed.`);
    }
    else {
        console.log(`${DIR_PATH} does not exist.`);
    }
    if (!fs_1.default.existsSync(DIR_PATH)) {
        fs_1.default.mkdirSync(DIR_PATH, { recursive: true }); // `recursive: true` ensures parent directories are created if needed
        console.log(`${DIR_PATH} has been created.`);
    }
    else {
        console.log(`${DIR_PATH} already exists.`);
    }
    await callMainWithDelay(NUMBER_OF_ACCOUNT);
})();
