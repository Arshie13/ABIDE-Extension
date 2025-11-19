import * as vscode from "vscode";
import { getNonce } from "../getNonce";
import { TaskProvider } from "../provider/TaskProvider";
import { TaskItem } from "../provider/TaskItem";
import { GitHelper } from "../git/GitProvider";
import * as geminiAI from "../helper/geminiHelper";

export class SwiperPanel {
  public static currentPanel: SwiperPanel | undefined;
  private _taskProvider?: TaskProvider;
  private _gitHelper: GitHelper;

  public static readonly viewType = "meh";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, taskProvider?: TaskProvider) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (SwiperPanel.currentPanel) {
      SwiperPanel.currentPanel._panel.reveal(column);
      SwiperPanel.currentPanel._update();
      SwiperPanel.currentPanel._taskProvider = taskProvider;
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      SwiperPanel.viewType,
      "Add Task",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "media"),
          vscode.Uri.joinPath(extensionUri, "out/compiled"),
        ],
      }
    );

    SwiperPanel.currentPanel = new SwiperPanel(panel, extensionUri, taskProvider);
  }

  public static kill() {
    SwiperPanel.currentPanel?.dispose();
    SwiperPanel.currentPanel = undefined;
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, taskProvider?: TaskProvider) {
    SwiperPanel.currentPanel = new SwiperPanel(panel, extensionUri, taskProvider);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, taskProvider?: TaskProvider) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._taskProvider = taskProvider;
    this._gitHelper = new GitHelper();

    this._panel.webview.onDidReceiveMessage(
      async (data) => {
        switch (data.type) {
          case "addTask": {
            if (!data.title || !this._taskProvider) {
              return;
            }
            try {
              const res = await fetch(this._taskProvider.apiUrl + '/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: data.title, description: data.description, tag: data.tag })
              });
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
              }
              vscode.window.showInformationMessage('Task added successfully!');
              await this._taskProvider?.fetchTasks();
              await this._update();
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to add task: ${err.message}`);
            }
            break;
          }
          case "updateTaskStatus": {
            if (!this._taskProvider) {
              return;
            }
            try {
              const newStatus = data.newStatus;
              const oldStatus = data.oldStatus;

              // Check if transitioning to IN_PROGRESS
              if (newStatus === "IN_PROGRESS" && oldStatus !== "IN_PROGRESS") {
                if (this._gitHelper.isGitAvailable()) {
                  const branchCreated = await this._gitHelper.createBranchFromTask(
                    data.taskTag,
                    data.taskTitle,
                    data.taskId
                  );

                  if (!branchCreated) {
                    vscode.window.showWarningMessage('Branch creation cancelled. Task status not updated.');
                    return;
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
              }

              // When marking as DONE, offer to generate commit message
              if (newStatus === "DONE" && oldStatus !== "DONE") {
                const generateCommit = await vscode.window.showInformationMessage(
                  'Task completed! Generate a commit message?',
                  'Yes', 'No'
                );

                if (generateCommit === 'Yes') {
                  const prompt = `Generate a concise git commit message for completing this task: "${data.taskTitle}: ${data.description}". Follow conventional commits format (feat:, fix:, etc.). Keep it under 72 characters. Return only the commit message.`;
                  const commitMessage = await geminiAI.promptGemini(prompt);

                  if (!commitMessage.text) {
                    vscode.window.showErrorMessage("Couldn't generate commit message.");
                  } else {
                    await vscode.env.clipboard.writeText(commitMessage.text);
                    vscode.window.showInformationMessage(`Commit message copied to clipboard: ${commitMessage.text}`);
                  }
                }
              }

              const res = await fetch(`${this._taskProvider.apiUrl}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: data.taskId, status: newStatus })
              });

              if (!res.ok) {
                const errorData = await res.text();
                vscode.window.showErrorMessage(`Couldn't update task: ${errorData}`);
                return;
              }

              vscode.window.showInformationMessage('Task status updated successfully!');
              await this._taskProvider?.fetchTasks();
              await this._update();
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to update task status: ${err.message}`);
            }
            break;
          }
          case "onInfo": {
            if (!data.value) {
              return;
            }
            vscode.window.showInformationMessage(data.value);
            break;
          }
          case "onError": {
            if (!data.value) {
              return;
            }
            vscode.window.showErrorMessage(data.value);
            break;
          }
        }
      },
      null,
      this._disposables
    );

    this._update();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public dispose() {
    SwiperPanel.currentPanel = undefined;
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private async _update() {
    const webview = this._panel.webview;
    const tasks = this._taskProvider ? this._taskProvider['tasks'] as unknown as TaskItem[] : [];
    this._panel.webview.html = this._getHtmlForWebview(webview, tasks);
  }

  private _getHtmlForWebview(webview: vscode.Webview, tasks: TaskItem[]) {
    const nonce = getNonce();

    const formatStatus = (status: string) => {
      return status.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    };

    const taskListHtml = tasks.length === 0
      ? `<tr><td colspan="2" style="text-align:center;">No tasks found.</td></tr>`
      : tasks.map(t => {
        // Escape quotes in title for data attribute
        const escapedTitle = t.title.replace(/"/g, '&quot;');
        const statuses = ["NOT_STARTED", "IN_PROGRESS", "FOR_TESTING", "DONE"];

        return /*html*/`
            <tbody class="task-item">
              <tr class="task-row" data-task-id="${t.taskId}">
                <td><strong>${t.title}</strong></td>
                <td>
                  <select class="status-dropdown" 
                          data-task-id="${t.taskId}"
                          data-task-title="${escapedTitle}"
                          data-old-status="${t.status}">
                    ${statuses.map(s => `
                      <option value="${s}" ${t.status === s ? 'selected' : ''}>${formatStatus(s)}</option>
                    `).join('')}
                  </select>
                </td>
              </tr>
              <tr class="description-row" id="desc-${t.taskId}">
                <td colspan="2">${t.descriptionText || "No description"}</td>
              </tr>
            </tbody>
          `;
      }).join("");

    return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Tasks</title>

          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              padding: 20px;
              background-color: var(--vscode-editor-background);
              color: var(--vscode-editor-foreground);
            }
            h1, h2 {
              text-align: center;
              color: var(--vscode-textLink-foreground);
              margin-bottom: 20px;
            }
            .form-container {
              background-color: var(--vscode-sideBar-background);
              padding: 24px;
              border-radius: 8px;
              margin-bottom: 30px;
              border: 1px solid var(--vscode-sideBar-border, #ccc);
            }
            label {
              display: block;
              margin-bottom: 8px;
              font-weight: 600;
            }
            input[type="text"],
            textarea,
            select {
              width: 100%;
              padding: 10px;
              border-radius: 4px;
              border: 1px solid var(--vscode-input-border, #ccc);
              background-color: var(--vscode-input-background, #fff);
              color: var(--vscode-input-foreground, #000);
              margin-bottom: 16px;
              box-sizing: border-box;
            }
            textarea {
              min-height: 80px;
              resize: vertical;
            }
            button[type="submit"] {
              width: 100%;
              padding: 12px;
              border-radius: 4px;
              border: none;
              background-color: var(--vscode-button-background, #007acc);
              color: var(--vscode-button-foreground, #fff);
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: background-color 0.2s;
            }
            button[type="submit"]:hover {
              background-color: var(--vscode-button-hoverBackground, #005a9e);
            }
            .task-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            .task-table th,
            .task-table td {
              padding: 12px 15px;
              text-align: left;
              border-bottom: 1px solid var(--vscode-editorWidget-border, #ccc);
            }
            .task-table th {
              background-color: var(--vscode-sideBar-background, #f0f0f0);
              font-weight: 600;
            }
            .task-table .task-row {
              cursor: pointer;
            }
            .task-table .task-row:hover {
              background-color: var(--vscode-list-hoverBackground, #f0f0f0);
            }
            .task-table .description-row {
              display: none;
            }
            .task-table .description-row td {
              background-color: var(--vscode-editorWidget-background, #252526);
              padding-left: 30px;
            }
            .status-dropdown {
              margin-bottom: 0;
              cursor: pointer;
            }
          </style>
      </head>

      <body>
          <h1>Task Manager</h1>

          <!-- FORM -->
          <div class="form-container">
            <form id="taskForm">
                <label for="title">Title</label>
                <input type="text" id="title" name="title" required />

                <label for="description">Description</label>
                <textarea id="description" name="description"></textarea>

                <button type="submit">Add Task</button>
            </form>
          </div>

          <!-- TASK LIST -->
          <h2>Tasks</h2>
          <table class="task-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
              </tr>
            </thead>
            ${taskListHtml}
          </table>

          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();

            document.getElementById('taskForm').addEventListener('submit', (e) => {
              e.preventDefault();
              const titleInput = document.getElementById('title');
              const descriptionInput = document.getElementById('description');
              
              const title = titleInput.value;
              const description = descriptionInput.value;

              vscode.postMessage({
                type: "addTask",
                title,
                description
              });

              titleInput.value = '';
              descriptionInput.value = '';
            });

            document.querySelectorAll('.task-row').forEach(row => {
              row.addEventListener('click', (e) => {
                if (e.target.tagName === 'SELECT') {
                  return;
                }
                const taskId = row.dataset.taskId;
                const descRow = document.getElementById('desc-' + taskId);
                if (descRow) {
                  descRow.style.display = descRow.style.display === 'none' || descRow.style.display === '' ? 'table-row' : 'none';
                }
              });
            });

            document.querySelectorAll('.status-dropdown').forEach(dropdown => {
              dropdown.addEventListener('change', (e) => {
                const taskId = e.target.dataset.taskId;
                const taskTitle = e.target.dataset.taskTitle;
                const oldStatus = e.target.dataset.oldStatus;
                const newStatus = e.target.value;
                
                vscode.postMessage({
                  type: "updateTaskStatus",
                  taskId,
                  taskTitle,
                  oldStatus,
                  newStatus
                });

                // Update the old status for next change
                e.target.dataset.oldStatus = newStatus;
              });
            });
          </script>
      </body>
    </html>
  `;
  }
}