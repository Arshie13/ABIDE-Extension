import * as vscode from 'vscode';
import { TaskStatus } from '../enum/TaskStatus';

export class TaskItem extends vscode.TreeItem {
  constructor(
    public taskId: number,
    public title: string,
    public descriptionText: string,
    public status: TaskStatus
  ) {
    super(title, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = "abideTask";
  }
}