import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function run() {
  let env = '';
  try {
    if (fs.existsSync('.env.local')) {
      env = fs.readFileSync('.env.local', 'utf-8');
    } else if (fs.existsSync('.env')) {
      env = fs.readFileSync('.env', 'utf-8');
    }
  } catch(e) {}
  
  const match = env.match(/VITE_GEMINI_API_KEY=(.+)/);
  const apiKey = match ? match[1].trim() : null;
  
  if (!apiKey) {
    console.error("No API key found in env files");
    return;
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  console.log("Fetching models...");
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    await model.generateContent("Hello");
    console.log("Success with gemini-1.5-flash!");
  } catch(e) {
    console.error("Error with 1.5-flash:", e.message);
  }
}
run();
