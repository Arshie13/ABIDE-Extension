"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode6 = __toESM(require("vscode"));

// src/panel/SwiperPanel.ts
var vscode2 = __toESM(require("vscode"));

// src/getNonce.ts
function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// src/git/GitProvider.ts
var vscode = __toESM(require("vscode"));
var GitHelper = class {
  gitExtension;
  git;
  constructor() {
    this.initializeGit();
  }
  initializeGit() {
    try {
      this.gitExtension = vscode.extensions.getExtension("vscode.git")?.exports;
      if (this.gitExtension) {
        this.git = this.gitExtension.getAPI(1);
      }
    } catch (error) {
      vscode.window.showErrorMessage("Failed to initialize Git extension");
    }
  }
  getRepository() {
    if (!this.git || this.git.repositories.length === 0) {
      return void 0;
    }
    return this.git.repositories[0];
  }
  sanitizeBranchName(taskTitle) {
    return taskTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").substring(0, 50);
  }
  async createBranchFromTask(taskTag, taskTitle, taskId) {
    const repository = this.getRepository();
    if (!repository) {
      vscode.window.showErrorMessage("No Git repository found in workspace");
      return false;
    }
    try {
      const sanitizedTitle = this.sanitizeBranchName(taskTitle);
      const branchName = `${taskTag}/#${taskId}-${sanitizedTitle}`;
      const branches = await repository.getBranches({ remote: false });
      const branchExists = branches.some((b) => b.name === branchName);
      if (branchExists) {
        const switchToBranch = await vscode.window.showWarningMessage(
          `Branch "${branchName}" already exists. Would you like to switch to it?`,
          "Yes",
          "No"
        );
        if (switchToBranch === "Yes") {
          await repository.checkout(branchName);
          vscode.window.showInformationMessage(`Switched to branch: ${branchName}`);
        }
        return true;
      }
      const currentBranch = repository.state.HEAD?.name || "unknown";
      const create = await vscode.window.showInformationMessage(
        `Create and checkout branch "${branchName}" from "${currentBranch}"?`,
        "Create",
        "Cancel"
      );
      if (create !== "Create") {
        return false;
      }
      await repository.createBranch(branchName, true);
      vscode.window.showInformationMessage(`Created and checked out branch: ${branchName}`);
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create branch: ${error}`);
      return false;
    }
  }
  async getCurrentBranch() {
    const repository = this.getRepository();
    return repository?.state.HEAD?.name;
  }
  isGitAvailable() {
    return !!this.git && this.git.repositories.length > 0;
  }
};

// src/panel/SwiperPanel.ts
var SwiperPanel = class _SwiperPanel {
  static currentPanel;
  _taskProvider;
  _gitHelper;
  static viewType = "meh";
  _panel;
  _extensionUri;
  _disposables = [];
  static createOrShow(extensionUri, taskProvider) {
    const column = vscode2.window.activeTextEditor ? vscode2.window.activeTextEditor.viewColumn : void 0;
    if (_SwiperPanel.currentPanel) {
      _SwiperPanel.currentPanel._panel.reveal(column);
      _SwiperPanel.currentPanel._update();
      _SwiperPanel.currentPanel._taskProvider = taskProvider;
      return;
    }
    const panel = vscode2.window.createWebviewPanel(
      _SwiperPanel.viewType,
      "Add Task",
      column || vscode2.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode2.Uri.joinPath(extensionUri, "media"),
          vscode2.Uri.joinPath(extensionUri, "out/compiled")
        ]
      }
    );
    _SwiperPanel.currentPanel = new _SwiperPanel(panel, extensionUri, taskProvider);
  }
  static kill() {
    _SwiperPanel.currentPanel?.dispose();
    _SwiperPanel.currentPanel = void 0;
  }
  static revive(panel, extensionUri, taskProvider) {
    _SwiperPanel.currentPanel = new _SwiperPanel(panel, extensionUri, taskProvider);
  }
  constructor(panel, extensionUri, taskProvider) {
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
              const res = await fetch(this._taskProvider.apiUrl + "/task", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: data.title, description: data.description, tag: data.tag })
              });
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
              }
              vscode2.window.showInformationMessage("Task added successfully!");
              await this._taskProvider?.fetchTasks();
              await this._update();
            } catch (err) {
              vscode2.window.showErrorMessage(`Failed to add task: ${err.message}`);
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
              if (newStatus === "IN_PROGRESS" && oldStatus !== "IN_PROGRESS") {
                if (this._gitHelper.isGitAvailable()) {
                  const branchCreated = await this._gitHelper.createBranchFromTask(
                    data.taskTag,
                    data.taskTitle,
                    data.taskId
                  );
                  if (!branchCreated) {
                    vscode2.window.showWarningMessage("Branch creation cancelled. Task status not updated.");
                    return;
                  }
                } else {
                  const proceed = await vscode2.window.showWarningMessage(
                    "Git not available. Continue without creating branch?",
                    "Yes",
                    "No"
                  );
                  if (proceed !== "Yes") {
                    return;
                  }
                }
              }
              const res = await fetch(`${this._taskProvider.apiUrl}/update`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: data.taskId, status: newStatus })
              });
              if (!res.ok) {
                const errorData = await res.text();
                vscode2.window.showErrorMessage(`Couldn't update task: ${errorData}`);
                return;
              }
              vscode2.window.showInformationMessage("Task status updated successfully!");
              await this._taskProvider?.fetchTasks();
              await this._update();
            } catch (err) {
              vscode2.window.showErrorMessage(`Failed to update task status: ${err.message}`);
            }
            break;
          }
          case "onInfo": {
            if (!data.value) {
              return;
            }
            vscode2.window.showInformationMessage(data.value);
            break;
          }
          case "onError": {
            if (!data.value) {
              return;
            }
            vscode2.window.showErrorMessage(data.value);
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
  dispose() {
    _SwiperPanel.currentPanel = void 0;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
  async _update() {
    const webview = this._panel.webview;
    const tasks = this._taskProvider ? this._taskProvider["tasks"] : [];
    this._panel.webview.html = this._getHtmlForWebview(webview, tasks);
  }
  _getHtmlForWebview(webview, tasks) {
    const nonce = getNonce();
    const formatStatus = (status) => {
      return status.replace(/_/g, " ").replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    };
    const taskListHtml = tasks.length === 0 ? `<tr><td colspan="2" style="text-align:center;">No tasks found.</td></tr>` : tasks.map((t) => {
      const escapedTitle = t.title.replace(/"/g, "&quot;");
      const statuses = ["NOT_STARTED", "IN_PROGRESS", "FOR_TESTING", "DONE"];
      return (
        /*html*/
        `
            <tbody class="task-item">
              <tr class="task-row" data-task-id="${t.taskId}">
                <td><strong>${t.title}</strong></td>
                <td>
                  <select class="status-dropdown" 
                          data-task-id="${t.taskId}"
                          data-task-title="${escapedTitle}"
                          data-old-status="${t.status}">
                    ${statuses.map((s) => `
                      <option value="${s}" ${t.status === s ? "selected" : ""}>${formatStatus(s)}</option>
                    `).join("")}
                  </select>
                </td>
              </tr>
              <tr class="description-row" id="desc-${t.taskId}">
                <td colspan="2">${t.descriptionText || "No description"}</td>
              </tr>
            </tbody>
          `
      );
    }).join("");
    return (
      /*html*/
      `
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
  `
    );
  }
};

// src/provider/TaskProvider.ts
var vscode5 = __toESM(require("vscode"));

// src/provider/TaskItem.ts
var vscode3 = __toESM(require("vscode"));
var TaskItem = class extends vscode3.TreeItem {
  constructor(taskId, title, descriptionText, tag, status) {
    super(title, vscode3.TreeItemCollapsibleState.Collapsed);
    this.taskId = taskId;
    this.title = title;
    this.descriptionText = descriptionText;
    this.tag = tag;
    this.status = status;
    this.contextValue = "abideTask";
  }
};

// src/provider/DescriptionItem.ts
var vscode4 = __toESM(require("vscode"));
var DescriptionItem = class extends vscode4.TreeItem {
  constructor(text) {
    super(text, vscode4.TreeItemCollapsibleState.None);
  }
};

// src/provider/TaskProvider.ts
var TaskProvider = class {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
    this._gitHelper = new GitHelper();
  }
  _onDidChangeTreeData = new vscode5.EventEmitter();
  _gitHelper;
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  tasks = [];
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  async fetchTasks() {
    try {
      const res = await fetch(this.apiUrl + "/tasks");
      const data = await res.json();
      this.tasks = data.map(
        (task) => new TaskItem(
          task.id,
          task.title,
          task.description,
          task.tag,
          task.status
        )
      );
      this.refresh();
    } catch (err) {
      if (err.code === "ECONNREFUSED") {
        vscode5.window.showErrorMessage("Failed to load tasks. Please ensure the local server is running at http://localhost:3000.");
      } else {
        vscode5.window.showErrorMessage(`Failed to load tasks: ${err.message}`);
      }
    }
  }
  async updateTask(id, status, taskTag, taskTitle) {
    try {
      if (this._gitHelper.isGitAvailable()) {
        const branchCreated = await this._gitHelper.createBranchFromTask(
          taskTag,
          taskTitle,
          id.toString()
        );
        if (!branchCreated) {
          vscode5.window.showWarningMessage("Branch creation cancelled.");
        }
      } else {
        const proceed = await vscode5.window.showWarningMessage(
          "Git not available. Continue without creating branch?",
          "Yes",
          "No"
        );
        if (proceed !== "Yes") {
          return;
        }
      }
      const response = await fetch(`${this.apiUrl}/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      if (!response.ok) {
        const responseText = await response.text();
        vscode5.window.showErrorMessage("Something went wrong while updating task: " + responseText);
        return;
      }
      await this.fetchTasks();
    } catch (error) {
      vscode5.window.showErrorMessage("Something went wrong: " + error.message);
    }
  }
  getTreeItem(element) {
    return element;
  }
  getChildren(element) {
    if (!element) {
      return this.tasks;
    }
    if (element instanceof TaskItem) {
      return [new DescriptionItem(element.descriptionText)];
    }
    return [];
  }
};

// src/extension.ts
function activate(context) {
  const apiUrl = "http://localhost:3000";
  const taskProvider = new TaskProvider(apiUrl);
  vscode6.window.registerTreeDataProvider("abideTasks", taskProvider);
  const refreshCommand = vscode6.commands.registerCommand("abide.refreshTasks", () => {
    taskProvider.fetchTasks();
  });
  const addTaskCommand = vscode6.commands.registerCommand("abide.addTask", async () => {
    const title = await vscode6.window.showInputBox({
      prompt: "Enter new task title",
      placeHolder: "e.g. Fix bug #42"
    });
    if (!title) {
      return;
    }
    ;
    const description = await vscode6.window.showInputBox({
      prompt: "Enter task description",
      placeHolder: "Optional details for this task"
    });
    const tag = await vscode6.window.showInputBox({
      prompt: "Enter task type",
      placeHolder: "feature | fix | bug | chore"
    });
    try {
      const res = await fetch(apiUrl + "/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, tag })
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      vscode6.window.showInformationMessage("Task added successfully!");
      taskProvider.fetchTasks();
    } catch (err) {
      if (err.code === "ECONNREFUSED") {
        vscode6.window.showErrorMessage("Failed to add task. Please ensure the local server is running at http://localhost:3000.");
      } else {
        vscode6.window.showErrorMessage(`Failed to add task: ${err.message}`);
      }
    }
  });
  context.subscriptions.push(refreshCommand, addTaskCommand);
  context.subscriptions.push(
    vscode6.commands.registerCommand("abide.showPanel", () => {
      SwiperPanel.createOrShow(context.extensionUri, taskProvider);
    })
  );
  context.subscriptions.push(
    vscode6.commands.registerCommand("abide.markNotStarted", (task) => {
      taskProvider.updateTask(task.taskId, "NOT_STARTED", task.tag, task.title);
    })
  );
  context.subscriptions.push(
    vscode6.commands.registerCommand("abide.markInProgress", (task) => {
      vscode6.window.showInformationMessage(task.tag);
      taskProvider.updateTask(task.taskId, "IN_PROGRESS", task.tag, task.title);
    })
  );
  context.subscriptions.push(
    vscode6.commands.registerCommand("abide.markForTesting", (task) => {
      taskProvider.updateTask(task.taskId, "FOR_TESTING", task.tag, task.title);
    })
  );
  context.subscriptions.push(
    vscode6.commands.registerCommand("abide.markDone", (task) => {
      taskProvider.updateTask(task.taskId, "DONE", task.tag, task.title);
    })
  );
  taskProvider.fetchTasks();
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
