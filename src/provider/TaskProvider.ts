import * as vscode from 'vscode';
import 'node-fetch';
import { TaskItem } from './TaskItem';
import { DescriptionItem } from './DescriptionItem';
import { TaskStatus } from '../enum/TaskStatus';
import { Task } from '../types/TaskType';

export class TaskProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TaskItem | undefined | void> = new vscode.EventEmitter<TaskItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<TaskItem | undefined | void> = this._onDidChangeTreeData.event;

  private tasks: TaskItem[] = [];

  constructor(private apiUrl: string) { }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async fetchTasks() {
    try {
      const res = await fetch(this.apiUrl + '/tasks');
      const data = await res.json() as Task[];
      vscode.window.showInformationMessage(JSON.stringify(data));
      this.tasks = data.map((task: Task) => new TaskItem(task.id, task.title, task.description, task.status));
      this.refresh();
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED') {
        vscode.window.showErrorMessage('Failed to load tasks. Please ensure the local server is running at http://localhost:3000.');
      } else {
        vscode.window.showErrorMessage(`Failed to load tasks: ${err.message}`);
      }
    }
  }

  async updateTask(id: number, status: string) {
    try {
      const response = await fetch(`${this.apiUrl}/update`, {
        method: 'PUT',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({id, status})
      });
      if (!response.ok) {
        const responseJson = await response.json();
        console.log("response: ", responseJson);
        vscode.window.showErrorMessage('Something went wrong while updating task' + responseJson);
        return;
      }
      await this.fetchTasks();
    } catch (error) {
      vscode.window.showErrorMessage('Something went wrong' + error);
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