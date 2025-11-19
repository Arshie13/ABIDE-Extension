import * as vscode from 'vscode';

interface GitAPI {
  repositories: Repository[];
}

interface GitExtension {
  getAPI(version: number): GitAPI;
}

interface Repository {
  rootUri: vscode.Uri;
  createBranch(name: string, checkout: boolean, ref?: string): Promise<void>;
  checkout(ref: string): Promise<void>;
  getBranches(query?: { remote?: boolean }): Promise<Branch[]>;
  state: RepositoryState;
}

interface Branch {
  name: string;
  commit?: string;
  upstream?: { remote: string; name: string };
}

interface RepositoryState {
  HEAD?: Branch;
}

export class GitHelper {
  private gitExtension: GitExtension | undefined;
  private git: GitAPI | undefined;

  constructor() {
    this.initializeGit();
  }

  private initializeGit() {
    try {
      this.gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
      if (this.gitExtension) {
        this.git = this.gitExtension.getAPI(1);
      }
    } catch (error) {
      vscode.window.showErrorMessage('Failed to initialize Git extension');
    }
  }

  private getRepository(): Repository | undefined {
    if (!this.git || this.git.repositories.length === 0) {
      return undefined;
    }
    // Return the first repository (you can make this smarter to detect the correct one)
    return this.git.repositories[0];
  }

  private sanitizeBranchName(taskTitle: string): string {
    // Convert task title to a valid git branch name
    return taskTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .substring(0, 50); // Limit length
  }

  async createBranchFromTask(taskTitle: string, taskId: string): Promise<boolean> {
    const repository = this.getRepository();

    if (!repository) {
      vscode.window.showErrorMessage('No Git repository found in workspace');
      return false;
    }

    try {
      // Create branch name from task
      const sanitizedTitle = this.sanitizeBranchName(taskTitle);
      const branchName = `feature/${taskId}-${sanitizedTitle}`;

      // Check if branch already exists
      const branches = await repository.getBranches({ remote: false });
      const branchExists = branches.some(b => b.name === branchName);

      if (branchExists) {
        const switchToBranch = await vscode.window.showWarningMessage(
          `Branch "${branchName}" already exists. Would you like to switch to it?`,
          'Yes', 'No'
        );

        if (switchToBranch === 'Yes') {
          await repository.checkout(branchName);
          vscode.window.showInformationMessage(`Switched to branch: ${branchName}`);
        }
        return true;
      }

      // Ask user for confirmation
      const currentBranch = repository.state.HEAD?.name || 'unknown';
      const create = await vscode.window.showInformationMessage(
        `Create and checkout branch "${branchName}" from "${currentBranch}"?`,
        'Create', 'Cancel'
      );

      if (create !== 'Create') {
        return false;
      }

      // Create and checkout the new branch
      await repository.createBranch(branchName, true);
      vscode.window.showInformationMessage(`Created and checked out branch: ${branchName}`);

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create branch: ${error}`);
      return false;
    }
  }

  async getCurrentBranch(): Promise<string | undefined> {
    const repository = this.getRepository();
    return repository?.state.HEAD?.name;
  }

  isGitAvailable(): boolean {
    return !!this.git && this.git.repositories.length > 0;
  }
}