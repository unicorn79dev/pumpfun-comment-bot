import axios from 'axios';
import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import bs58 from 'bs58'; // For Base58 encoding
import fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const NUMBER_OF_ACCOUNT = parseInt(process.env.NUMBER_OF_ACCOUNT||"5");
const DIR_PATH = process.env.DIR_PATH||"cookies";

const HEADERS = {
    accept: '*/*',
    'content-type': 'application/json',
    origin: 'https://pump.fun',
};

// Logger function (mock logger for simplicity)
function log(message: string, level: string = 'info') {
    console.log(`[${level.toUpperCase()}]: ${message}`);
}

// Save cookies to a file
function saveCookiesToFile(cookies: Record<string, string>, filename: string = 'cookies.json') {
    try {
        fs.writeFileSync(filename, JSON.stringify(cookies, null, 2));
        log(`Cookies saved to ${filename}`);
    } catch (error: any) {
        log(`Failed to save cookies: ${error.message}`, 'error');
    }
}

// Generate signing and verifying keys
function generateKeypair(): { signingKey: Uint8Array; verifyKey: Uint8Array } {
    const keypair = nacl.sign.keyPair();
    return { signingKey: keypair.secretKey, verifyKey: keypair.publicKey };
}

// Write generated data to a file
function writeToFile(secretKey: string, token: string, publicKey: string) {
    const filePath = 'accounts/generated.txt';
    try {
        fs.appendFileSync(filePath, `${token}\n`);
        log(`Data written to ${filePath}`);
    } catch (error: any) {
        log(`Failed to write to file: ${error.message}`, 'error');
    }
}

// Send HTTP POST request
async function sendRequest(url: string, payload: Record<string, any> | null = null): Promise<string | null> {
    try {
        const response = await axios.post(url, payload, { headers: HEADERS });
        log(`Response status: ${response.status}`);
        if (payload && response.status === 201) {
            const cookies = response.headers['set-cookie'];
            if (cookies) {
                saveCookiesToFile(
                    cookies.reduce((acc, cookie: string) => {
                        const [nameValue] = cookie.split(';');
                        const [name, value] = nameValue.split('=');
                        acc[name] = value;
                        return acc;
                    }, {} as Record<string, string>),  `${DIR_PATH}/${payload["address"]}`
                );
            }
            return response.data.auth_token || null;
        } else {
            log(`Failed request with status ${response.status} and message: ${response.statusText}`, 'error');
            return null;
        }
    } catch (error: any) {
        log(`Error in sendRequest: ${error.message}`, 'error');
        return null;
    }
}

// Perform login
async function login(signingKey: Uint8Array, verifyKey: Uint8Array): Promise<string | null> {
    const timestamp = Date.now().toString();
    const message = `Sign in to pump.fun: ${timestamp}`;
    const messageBytes = naclUtil.decodeUTF8(message);

    const signature = nacl.sign.detached(messageBytes, signingKey);

    const payload = {
        address: bs58.encode(verifyKey),
        signature: bs58.encode(signature),
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

async function callMainWithDelay(generateAmount: number) {
    for (let i = 0; i < generateAmount; i++) {
        await main();
    }
}

(async () => {
    if (fs.existsSync(DIR_PATH)) {
        fs.rmSync(DIR_PATH, { recursive: true }); // `recursive: true` ensures that non-empty directories are deleted
        console.log(`${DIR_PATH} has been removed.`);
    } else {
        console.log(`${DIR_PATH} does not exist.`);
    }
    if (!fs.existsSync(DIR_PATH)) {
        fs.mkdirSync(DIR_PATH, { recursive: true }); // `recursive: true` ensures parent directories are created if needed
        console.log(`${DIR_PATH} has been created.`);
    } else {
        console.log(`${DIR_PATH} already exists.`);
    }
    await callMainWithDelay(NUMBER_OF_ACCOUNT);
})();
