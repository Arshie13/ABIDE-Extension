import * as vscode from 'vscode';

export async function promptGemini(prompt: string) {

  const apiKey = vscode.workspace
    .getConfiguration()
    .get<string>('abide.geminiApiKey');

  console.log("api key: ", apiKey)

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({
    apiKey
  });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
  });
  return response;
}
