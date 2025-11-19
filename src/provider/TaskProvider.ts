import * as vscode from 'vscode';
import 'node-fetch';
import { TaskItem } from './TaskItem';
import { DescriptionItem } from './DescriptionItem';
import { Task } from '../types/TaskType';
import { GitHelper } from "../git/GitProvider";
import * as geminiAI from "../helper/geminiHelper";

export class TaskProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TaskItem | undefined | void> = new vscode.EventEmitter<TaskItem | undefined | void>();
  private _gitHelper: GitHelper;
  readonly onDidChangeTreeData: vscode.Event<TaskItem | undefined | void> = this._onDidChangeTreeData.event;

  private tasks: TaskItem[] = [];

  constructor(public apiUrl: string) {
    this._gitHelper = new GitHelper();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async fetchTasks() {
    try {
      const res = await fetch(this.apiUrl + '/tasks');
      const data = await res.json() as Task[];
      this.tasks = data.map((task: Task) =>
        new TaskItem(
          task.id,
          task.title,
          task.description,
          task.tag,
          task.status
        )
      );
      this.refresh();
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED') {
        vscode.window.showErrorMessage('Failed to load tasks. Please ensure the local server is running at http://localhost:3000.');
      } else {
        vscode.window.showErrorMessage(`Failed to load tasks: ${err.message}`);
      }
    }
  }

  async updateTask(id: number, status: string, taskTag: string, taskTitle: string, taskDescription: string) {
    try {
      if (this._gitHelper.isGitAvailable()) {
        const branchCreated = await this._gitHelper.createBranchFromTask(
          taskTag,
          taskTitle,
          id.toString()
        );

        if (!branchCreated) {
          vscode.window.showWarningMessage('Branch creation cancelled.');
        }
      } else {
        const proceed = await vscode.window.showWarningMessage(
          'Git not available. Continue without creating branch?',
          'Yes', 'No'
        );
        if (proceed !== 'Yes') {
          return;
        }
      }

      if (status === "DONE") {
        const generateCommit = await vscode.window.showInformationMessage(
          'Task completed! Generate a commit message?',
          'Yes', 'No'
        );

        if (generateCommit === 'Yes') {
          const prompt = `Generate a concise git commit message for completing this task: "${taskTitle}: ${taskDescription}". Follow conventional commits format (feat:, fix:, etc.). Keep it under 72 characters. Return only the commit message.`;
          const commitMessage = await geminiAI.promptGemini(prompt);

          if (!commitMessage.text) {
            vscode.window.showErrorMessage("Couldn't generate commit message.");
          } else {
            await vscode.env.clipboard.writeText(commitMessage.text);
            vscode.window.showInformationMessage(`Commit message copied to clipboard: ${commitMessage.text}`);
          }
        }
      }

      const response = await fetch(`${this.apiUrl}/update`, {
        method: 'PUT',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      if (!response.ok) {
        const responseText = await response.text();
        vscode.window.showErrorMessage('Something went wrong while updating task: ' + responseText);
        return;
      }

      await this.fetchTasks();
    } catch (error: any) {
      vscode.window.showErrorMessage('Something went wrong: ' + error.message);
    }
  }

  getTreeItem(element: TaskItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) {
      // top level → tasks
      return this.tasks;
    }

    if (element instanceof TaskItem) {
      // when a task is expanded → show its description
      return [new DescriptionItem(element.descriptionText)];
    }

    return [];
  }

}