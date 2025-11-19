import * as vscode from 'vscode';
import 'node-fetch';
import { SwiperPanel } from './Panel/SwiperPanel';
import { TaskProvider } from './provider/TaskProvider';
import { TaskStatus } from './enum/TaskStatus';
// import { Task } from './types/TaskType';
import { TaskItem } from './provider/TaskItem';

export function activate(context: vscode.ExtensionContext) {
  const apiUrl = 'http://localhost:3000';
  const taskProvider = new TaskProvider(apiUrl);

  vscode.window.registerTreeDataProvider('abideTasks', taskProvider);

  // Refresh button
  const refreshCommand = vscode.commands.registerCommand('abide.refreshTasks', () => {
    taskProvider.fetchTasks();
  });

  // Add task button with POST request
  const addTaskCommand = vscode.commands.registerCommand('abide.addTask', async () => {
    // First input for title
    const title = await vscode.window.showInputBox({
      prompt: 'Enter new task title',
      placeHolder: 'e.g. Fix bug #42'
    });
    if (!title) {
      return;
    };

    // Second input for description
    const description = await vscode.window.showInputBox({
      prompt: 'Enter task description',
      placeHolder: 'Optional details for this task'
    });

    try {
      const res = await fetch('http://localhost:3000/' + '/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      vscode.window.showInformationMessage('Task added successfully!');
      taskProvider.fetchTasks();
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED') {
        vscode.window.showErrorMessage('Failed to add task. Please ensure the local server is running at http://localhost:3000.');
      } else {
        vscode.window.showErrorMessage(`Failed to add task: ${err.message}`);
      }
    }
  });

  context.subscriptions.push(refreshCommand, addTaskCommand);
  context.subscriptions.push(
    vscode.commands.registerCommand('abide.showPanel', () => {
      SwiperPanel.createOrShow(context.extensionUri, taskProvider);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("abide.markNotStarted", (task: TaskItem) => {
      vscode.window.showInformationMessage(task.id ? task.id : 'id does not exist');
      taskProvider.updateTask(task.taskId, "NOT_STARTED");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("abide.markInProgress", (task: TaskItem) => {
      vscode.window.showInformationMessage(task.id ? task.id : 'id does not exist');
      taskProvider.updateTask(task.taskId, "IN_PROGRESS");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("abide.markForTesting", (task: TaskItem) => {
      vscode.window.showInformationMessage(`task id: ${task.taskId}`);
      taskProvider.updateTask(task.taskId, "FOR_TESTING");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("abide.markDone", (task: TaskItem) => {
      vscode.window.showInformationMessage(task.id ? task.id : 'id does not exist');
      taskProvider.updateTask(task.taskId, "DONE");
    })
  );

  // Initial fetch
  taskProvider.fetchTasks();
}

export function deactivate() { }
