import * as vscode from 'vscode';
import { ContextHelper } from './ContextHelper';
import { TaskItem } from '../provider/TaskItem';

const apiKey = vscode.workspace
  .getConfiguration()
  .get<string>('abide.geminiApiKey');

export async function promptGemini(prompt: string) {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({
    apiKey
  });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
  });
  return response.text;
}

export async function generateCode(task: TaskItem): Promise<string> {
  const context = await ContextHelper.getFullContext();

  const prompt = `You are a code generator assistant helping with a software development task.

CONTEXT:
${context}

TASK:
Title: ${task.title}
Description: ${task.descriptionText || 'No description provided'}
Status: ${task.status}

Based on the context and task information above, generate the code needed to complete this task.

Requirements:
- Generate production-ready, well-commented code
- Follow best practices for the detected language/framework
- Include error handling where appropriate
- Match the coding style of the project
- If multiple files are needed, clearly separate them with @@ delimiter

IMPORTANT: Format your response EXACTLY like this:

// File path: src/components/Example.ts
\`\`\`typescript
[your code here]
\`\`\`

@@

// File path: src/utils/helper.ts
\`\`\`typescript
[your code here]
\`\`\`

Use @@ to separate multiple files. ALWAYS include the "// File path:" comment before each code block.
If creating only one file, still include the file path comment.
Use proper file naming convention (Example.ts for classes, example.ts for modules, etc).

Generate the code now:`;

  try {
    const response = await promptGemini(prompt);
    if (!response) {
      return 'No code generated';
    }
    return response;
  } catch (error: any) {
    throw new Error(`Failed to generate code: ${error.message}`);
  }
}
