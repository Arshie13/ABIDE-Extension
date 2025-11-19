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
var vscode5 = __toESM(require("vscode"));

// src/Panel/SwiperPanel.ts
var vscode = __toESM(require("vscode"));

// src/getNonce.ts
function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// src/Panel/SwiperPanel.ts
var SwiperPanel = class _SwiperPanel {
  static currentPanel;
  _taskProvider;
  static viewType = "meh";
  _panel;
  _extensionUri;
  _disposables = [];
  static createOrShow(extensionUri, taskProvider) {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : void 0;
    if (_SwiperPanel.currentPanel) {
      _SwiperPanel.currentPanel._panel.reveal(column);
      _SwiperPanel.currentPanel._update();
      _SwiperPanel.currentPanel._taskProvider = taskProvider;
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      _SwiperPanel.viewType,
      "Add Task",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "media"),
          vscode.Uri.joinPath(extensionUri, "out/compiled")
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
    this._panel.webview.onDidReceiveMessage(
      async (data) => {
        vscode.window.showInformationMessage(JSON.stringify(data));
        switch (data.type) {
          case "addTask": {
            if (!data.title) {
              return;
            }
            try {
              const res = await fetch("http://localhost:3000/task", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: data.title, description: data.description })
              });
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
              }
              vscode.window.showInformationMessage("Task added successfully!");
              await this._taskProvider?.fetchTasks();
            } catch (err) {
              vscode.window.showErrorMessage(`Failed to add task: ${err}`);
            }
            break;
          }
          case "updateTaskStatus": {
            try {
              vscode.window.showInformationMessage("after: ", data.newStatus);
              const res = await fetch(`http://localhost:3000/update`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: data.taskId, status: data.newStatus })
              });
              vscode.window.showInformationMessage(`result: ${await res.json()}`);
              if (!res.ok) {
                vscode.window.showInformationMessage("Couldn't update task");
              }
              vscode.window.showInformationMessage("Task status updated successfully!");
              await this._taskProvider?.fetchTasks();
            } catch (err) {
              vscode.window.showErrorMessage(`Failed to update task status: ${err}`);
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
      }
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
    const taskListHtml = tasks.length === 0 ? `<tr><td colspan="2" style="text-align:center;">No tasks found.</td></tr>` : tasks.map((t) => {
      return (
        /*html*/
        `
            <tbody class="task-item">
              <tr class="task-row" data-task-id="${t.taskId}">
                <td><strong>${t.title}</strong></td>
                <td>
                  <select class="status-dropdown" data-task-id="${t.taskId}">
                    <option value="" selected disabled>${t.status}</option>
                    <option value="NOT_STARTED">Not Started</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="FOR_TESTING">For Testing</option>
                    <option value="DONE">Done</option>
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
              color: var(--vscode-text-link-foreground);
              margin-bottom: 20px;
            }
            .form-container {
              background-color: var(--vscode-side-bar-background);
              padding: 24px;
              border-radius: 8px;
              margin-bottom: 30px;
              border: 1px solid var(--vscode-side-bar-border, #ccc);
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
              background-color: var(--vscode-button-hover-background, #005a9e);
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
              border-bottom: 1px solid var(--vscode-editor-widget-border, #ccc);
            }
            .task-table th {
              background-color: var(--vscode-side-bar-background, #f0f0f0);
              font-weight: 600;
            }
            .task-table .task-row {
              cursor: pointer;
            }
            .task-table .task-row:hover {
              background-color: var(--vscode-list-hover-background, #f0f0f0);
            }
            .task-table .description-row {
              display: none;
            }
            .task-table .description-row td {
              background-color: var(--vscode-editor-widget-background, #252526);
              padding-left: 30px;
            }
            .status-dropdown {
              margin-bottom: 0;
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

              // Clear form
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
                  descRow.style.display = descRow.style.display === 'none' ? 'table-row' : 'none';
                }
              });
            });

            document.querySelectorAll('.status-dropdown').forEach(dropdown => {
              dropdown.addEventListener('change', (e) => {
                const taskId = e.target.dataset.taskId;
                const newStatus = e.target.value;
                vscode.postMessage({
                  type: "updateTaskStatus",
                  taskId,
                  newStatus
                });
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
var vscode4 = __toESM(require("vscode"));

// src/provider/TaskItem.ts
var vscode2 = __toESM(require("vscode"));
var TaskItem = class extends vscode2.TreeItem {
  constructor(taskId, title, descriptionText, status) {
    super(title, vscode2.TreeItemCollapsibleState.Collapsed);
    this.taskId = taskId;
    this.title = title;
    this.descriptionText = descriptionText;
    this.status = status;
    this.contextValue = "abideTask";
  }
};

// src/provider/DescriptionItem.ts
var vscode3 = __toESM(require("vscode"));
var DescriptionItem = class extends vscode3.TreeItem {
  constructor(text) {
    super(text, vscode3.TreeItemCollapsibleState.None);
  }
};

// src/provider/TaskProvider.ts
var TaskProvider = class {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
  }
  _onDidChangeTreeData = new vscode4.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  tasks = [];
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  async fetchTasks() {
    try {
      const res = await fetch(this.apiUrl + "/tasks");
      const data = await res.json();
      vscode4.window.showInformationMessage(JSON.stringify(data));
      this.tasks = data.map((task) => new TaskItem(task.id, task.title, task.description, task.status));
      this.refresh();
    } catch (err) {
      if (err.code === "ECONNREFUSED") {
        vscode4.window.showErrorMessage("Failed to load tasks. Please ensure the local server is running at http://localhost:3000.");
      } else {
        vscode4.window.showErrorMessage(`Failed to load tasks: ${err.message}`);
      }
    }
  }
  async updateTask(id, status) {
    try {
      const response = await fetch(`${this.apiUrl}/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      if (!response.ok) {
        const responseJson = await response.json();
        console.log("response: ", responseJson);
        vscode4.window.showErrorMessage("Something went wrong while updating task" + responseJson);
        return;
      }
      await this.fetchTasks();
    } catch (error) {
      vscode4.window.showErrorMessage("Something went wrong" + error);
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
  vscode5.window.registerTreeDataProvider("abideTasks", taskProvider);
  const refreshCommand = vscode5.commands.registerCommand("abide.refreshTasks", () => {
    taskProvider.fetchTasks();
  });
  const addTaskCommand = vscode5.commands.registerCommand("abide.addTask", async () => {
    const title = await vscode5.window.showInputBox({
      prompt: "Enter new task title",
      placeHolder: "e.g. Fix bug #42"
    });
    if (!title) {
      return;
    }
    ;
    const description = await vscode5.window.showInputBox({
      prompt: "Enter task description",
      placeHolder: "Optional details for this task"
    });
    try {
      const res = await fetch("http://localhost:3000//task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description })
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      vscode5.window.showInformationMessage("Task added successfully!");
      taskProvider.fetchTasks();
    } catch (err) {
      if (err.code === "ECONNREFUSED") {
        vscode5.window.showErrorMessage("Failed to add task. Please ensure the local server is running at http://localhost:3000.");
      } else {
        vscode5.window.showErrorMessage(`Failed to add task: ${err.message}`);
      }
    }
  });
  context.subscriptions.push(refreshCommand, addTaskCommand);
  context.subscriptions.push(
    vscode5.commands.registerCommand("abide.showPanel", () => {
      SwiperPanel.createOrShow(context.extensionUri, taskProvider);
    })
  );
  context.subscriptions.push(
    vscode5.commands.registerCommand("abide.markNotStarted", (task) => {
      vscode5.window.showInformationMessage(task.id ? task.id : "id does not exist");
      taskProvider.updateTask(task.taskId, "NOT_STARTED");
    })
  );
  context.subscriptions.push(
    vscode5.commands.registerCommand("abide.markInProgress", (task) => {
      vscode5.window.showInformationMessage(task.id ? task.id : "id does not exist");
      taskProvider.updateTask(task.taskId, "IN_PROGRESS");
    })
  );
  context.subscriptions.push(
    vscode5.commands.registerCommand("abide.markForTesting", (task) => {
      vscode5.window.showInformationMessage(`task id: ${task.taskId}`);
      taskProvider.updateTask(task.taskId, "FOR_TESTING");
    })
  );
  context.subscriptions.push(
    vscode5.commands.registerCommand("abide.markDone", (task) => {
      vscode5.window.showInformationMessage(task.id ? task.id : "id does not exist");
      taskProvider.updateTask(task.taskId, "DONE");
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
