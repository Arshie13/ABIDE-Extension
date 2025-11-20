// src/helper/contextHelper.ts
import * as vscode from 'vscode';

export class ContextHelper {
  /**
   * Get current file information
   */
  static getCurrentFileContext(): string {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return '';
    }

    const document = editor.document;
    const fileName = document.fileName;
    const language = document.languageId;
    const selectedText = editor.selection.isEmpty
      ? ''
      : document.getText(editor.selection);

    return `
      Current file: ${fileName}
      Language: ${language}
      ${selectedText ? `Selected code:\n${selectedText}` : ''}
    `.trim();
  }

  /**
   * Get workspace information
   */
  static getWorkspaceContext(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return 'No workspace open';
    }

    const workspaceName = workspaceFolders[0].name;
    const workspacePath = workspaceFolders[0].uri.fsPath;

    return `
      Workspace: ${workspaceName}
      Path: ${workspacePath}
    `.trim();
  }

  /**
 * Read Project.md file for project information
 */
  static async getProjectMdContext(): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return '';
    }

    try {
      // Try to find Project.md in the workspace root
      const projectMdUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'Project.md');
      const projectMdContent = await vscode.workspace.fs.readFile(projectMdUri);
      const content = projectMdContent.toString();

      return `
        PROJECT INFORMATION (from Project.md):
        ${content}
      `.trim();
    } catch (error) {
      // If Project.md doesn't exist, try common alternatives
      const alternatives = ['PROJECT.md', 'project.md', 'README.md'];

      for (const alt of alternatives) {
        try {
          const altUri = vscode.Uri.joinPath(workspaceFolders[0].uri, alt);
          const altContent = await vscode.workspace.fs.readFile(altUri);
          return `
            PROJECT INFORMATION (from ${alt}):
            ${altContent.toString()}
          `.trim();
        } catch {
          continue;
        }
      }

      return 'No Project.md or project documentation found';
    }
  }

  /**
   * Get project structure (package.json if available)
   */
  static async getProjectContext(): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return '';
    }

    try {
      const packageJsonUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'package.json');
      const packageJsonContent = await vscode.workspace.fs.readFile(packageJsonUri);
      const packageJson = JSON.parse(packageJsonContent.toString());

      const dependencies = packageJson.dependencies
        ? Object.keys(packageJson.dependencies).slice(0, 10).join(', ')
        : 'None';

      return `
        Project: ${packageJson.name || 'Unknown'}
        Description: ${packageJson.description || 'No description'}
        Main dependencies: ${dependencies}
      `.trim();
    } catch (error) {
      return 'No package.json found';
    }
  }

  /**
   * Get recent Git commits for context
   */
  static async getGitContext(): Promise<string> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
      if (!gitExtension) {
        return '';
      }

      const git = gitExtension.getAPI(1);
      if (git.repositories.length === 0) {
        return '';
      }

      const repo = git.repositories[0];
      const branch = repo.state.HEAD?.name || 'Git not initialized';

      return `
        Current branch: ${branch}
      `.trim();
    } catch (error) {
      return 'Error getting Git context: ' + error;
    }
  }

  /**
   * Get all existing tasks for context
   */
  static getExistingTasksContext(tasks: any[]): string {
    if (!tasks || tasks.length === 0) {
      return 'No existing tasks';
    }

    const taskList = tasks
      .slice(0, 5) // Only include last 5 tasks
      .map(t => `- ${t.title} (${t.status})`)
      .join('\n');

    return `
      Recent tasks:
      ${taskList}
    `.trim();
  }

  /**
   * Combine all context
   */
  static async getFullContext(tasks?: any[]): Promise<string> {
    const contexts = [
      await this.getProjectMdContext(), // Project.md comes first for high priority
      this.getWorkspaceContext(),
      await this.getProjectContext(),
      await this.getGitContext(),
      this.getCurrentFileContext(),
      tasks ? this.getExistingTasksContext(tasks) : ''
    ].filter(c => c.length > 0);

    return contexts.join('\n\n');
  }

  /**
 * Get only project overview context (useful for simpler prompts)
 */
  static async getProjectOverviewContext(): Promise<string> {
    const contexts = [
      await this.getProjectMdContext(),
      await this.getProjectContext()
    ].filter(c => c.length > 0);

    return contexts.join('\n\n');
  }
}