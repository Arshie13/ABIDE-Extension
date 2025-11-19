import { TaskStatus } from "../enum/TaskStatus";

export interface Task {
  id: number,
  title: string,
  description: string,
  tag: string,
  status: TaskStatus,
}