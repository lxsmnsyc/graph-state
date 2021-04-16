import { node } from 'graph-state';

export type TodoListFilter =
  | 'all'
  | 'complete'
  | 'incomplete';

const todoListFilter = node<TodoListFilter>({
  key: 'todoListFilter',
  get: 'all',
});

export default todoListFilter;
