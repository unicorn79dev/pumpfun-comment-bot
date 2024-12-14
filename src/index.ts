
import fs from 'fs';
import { Builder, By, until, WebDriver, WebElement } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import path from 'path';

const DIR_PATH = process.env.DIR_PATH || 'cookies';
const TOKEN_ADDRESS = "D62zFNBWzXT9pSWH6BmG1kXip8YkttvbaNh8TGxZpump";
const COMMENT_TYPE = 'bad';

const getFiles = (directoryPath: any) => {
    try {
        const files = fs.readdirSync(directoryPath);
        console.log('Files in directory:', files);
        return files
    } catch (err) {
        console.log('Error reading directory:', err);
        return []
    }
}

// Logger function (mock logger for simplicity)
function log(message: string, level: string = 'info') {
    console.log(`[${level.toUpperCase()}]: ${message}`);
}

// Load cookies from a file
function loadCookiesFromFile(filename: string = 'cookies.json'): Record<string, string> | null {
    try {
        const data = fs.readFileSync(filename, 'utf-8');
        log(`Cookies loaded from ${filename}`);
        return JSON.parse(data);
    } catch (error: any) {
        log(`Failed to load cookies: ${error.message}`, 'error');
        return null;
    }
}
function getComments(filePath: string): string[] {
    try {
        // Read the file synchronously and split it into an array by line
        const data = fs.readFileSync(filePath, 'utf-8');
        const lines = data.split('\n');

        // Return the array of lines
        return lines;
    } catch (error) {
        console.error('Error reading the file:', error);
        return [];
    }
}
function getRandomText(textArray: string[]): string {
    // Generate a random index between 0 and the length of the array (exclusive)
    const randomIndex = Math.floor(Math.random() * textArray.length);

    // Return the random text at the generated index
    return textArray[randomIndex];
}

function getAllFilesInDirectory(directoryPath: string): string[] {
    const files: string[] = [];

    // Read all files and directories in the given directory
    const items = fs.readdirSync(directoryPath);

    // Loop through all the items and check if it's a file or directory
    items.forEach(item => {
        const fullPath = path.join(directoryPath, item); // Get the absolute path

        // Check if it's a file or directory
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // Recursively call the function for directories
            files.push(...getAllFilesInDirectory(fullPath));
        } else {
            // Push the file path to the array
            files.push(fullPath);
        }
    });

    return files;
}
// Open browser with cookies and interact with the site
async function openBrowserWithCookiesAndInteract() {
    const options = new chrome.Options();
    // options.addArguments('--headless');  // Run Chrome in headless mode
    // options.addArguments('--disable-gpu'); 
    const driver: WebDriver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    const accounts = getFiles(DIR_PATH);
    const comments = getComments(`comments/${COMMENT_TYPE}.txt`);
    const pics = getFiles('pic');

    try {
        await driver.get(`https://pump.fun/coin/${TOKEN_ADDRESS}`);
        for (let account of accounts) {
            {
                const cookies = loadCookiesFromFile(`${DIR_PATH}/${account}`);
                if (cookies) {
                    await driver.manage().deleteAllCookies();
                    log('Cleared all cookies.');
                    for (const [name, value] of Object.entries(cookies)) {
                        await driver.manage().addCookie({ name, value, domain: '.pump.fun' });
                    }
                    log('Added cookies');
                }
                await driver.navigate().refresh();
                await driver.sleep(1000);

                // Interact with the page elements
                // Accept cookies button
                try {
                    const cookieButton = await driver.executeScript(
                        "return document.querySelector('#btn-accept-all');"
                    );
                    if (cookieButton) {
                        await driver.executeScript("arguments[0].click();", cookieButton);
                        log("Accepted cookies using execute_script.");
                    } else {
                        log("Cookie button not found.", 'warning');
                    }
                } catch (e) {
                    log(`Cookie button interaction failed: ${e}`, 'warning');
                }

                // Click "I'm ready to pump" button
                try {
                    const readyButton = await driver.executeScript(
                        `
                        return Array.from(document.querySelectorAll('button')).find(
                            btn => btn.textContent.includes("I'm ready to pump")
                        );
                        `
                    );
                    if (readyButton) {
                        await driver.executeScript("arguments[0].click();", readyButton);
                        log("Clicked 'I'm ready to pump' button using execute_script.");
                    } else {
                        log("'I'm ready to pump' button not found.", 'warning');
                    }
                } catch (e) {
                    log(`'I'm ready to pump' button interaction failed: ${e}`, 'warning');
                }

                try {
                    const postReplyButton = await driver.wait(
                        until.elementLocated(By.xpath("//div[contains(@class, 'text-white') and contains(text(),'post a reply')]")),
                        10000
                    );
                    await postReplyButton.click();
                    log("Clicked 'Post a Reply' button.");

                    const textarea: WebElement = await driver.findElement(By.id('text'));
                    const textMessage = getRandomText(comments);
                    await textarea.sendKeys(textMessage);

                    log(`Text set in textarea: ${textMessage}`);

                    const fileInput = await driver.findElement(By.css('input[type="file"]'));

                    // Set the file path (make sure to use the absolute path to the file)
                    const filePath = `${path.dirname(__dirname)}\\pic\\${getRandomText(pics)}`;
                    await fileInput.sendKeys(filePath);
                    const postReplySubmitButton: WebElement | null = await driver.executeScript(
                        `return Array.from(document.querySelectorAll('button')).find(
                            btn => btn.textContent.includes('post reply') && btn.className.includes('bg-green-400')
                        );`
                    );
                    if (postReplySubmitButton) {
                        await postReplySubmitButton.click();
                        log("Clicked 'Post Reply' button.");
                    }
                    driver.sleep(5000);
                } catch (error: any) {
                    log(`Interaction error: ${error.message}`, 'warning');
                }

                await driver.sleep(3000);
            }
        }
    } finally {
        await driver.quit();
    }
}

// Execution entry point
(async () => {
    await openBrowserWithCookiesAndInteract();
})();
