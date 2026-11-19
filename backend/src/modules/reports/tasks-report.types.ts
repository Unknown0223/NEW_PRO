/** SalesDoc `/report/tasksReport` — topshiriqlar hisoboti. */

export type TasksReportFilters = {
  from: string;
  to: string;
  statuses: string[];
  priorities: string[];
  assignee_ids: number[];
  created_by_ids: number[];
  client_ids: number[];
  task_type_refs: string[];
  search?: string;
  page: number;
  limit: number;
};

export type TasksReportRow = {
  row_number: number;
  task_id: number;
  title: string;
  description: string;
  status: string;
  status_label: string;
  priority: string;
  priority_label: string;
  task_type: string;
  assignee_name: string;
  created_by_name: string;
  client_name: string;
  created_at: string;
  due_at: string | null;
  completed_at: string | null;
  result_comment: string;
  photo_count: number;
};
