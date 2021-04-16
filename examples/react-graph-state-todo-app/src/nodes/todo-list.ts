import { node } from 'graph-state';

export interface TodoListData {
  completed: boolean;
  text: string;
  id: number;
}

const todoList = node<TodoListData[]>({
  key: 'todoList',
  get: [],
});

export default todoList;
