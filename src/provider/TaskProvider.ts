import * as vscode from 'vscode';
import 'node-fetch';
import { TaskItem } from './TaskItem';
import { DescriptionItem } from './DescriptionItem';
import { Task } from '../types/TaskType';
import { GitHelper } from "../git/GitProvider";

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

  async updateTask(id: number, status: string, taskTag: string, taskTitle: string) {
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