import * as vscode from 'vscode';

export class DescriptionItem extends vscode.TreeItem {
  constructor(text: string) {
    super(text, vscode.TreeItemCollapsibleState.None);
  }
}