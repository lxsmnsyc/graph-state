import { node } from 'graph-state';
import todoList from './todo-list';

const toggleTodo = node<undefined, number, void>({
  key: 'toggleTodo',
  get: undefined,
  set: (context, id) => {
    context.set(todoList, (currentTodoList) => {
      const index = currentTodoList.findIndex((data) => data.id === id);

      if (index !== -1) {
        const item = currentTodoList[index];
        item.completed = !item.completed;
      }

      return [
        ...currentTodoList,
      ];
    });
  },
});

export default toggleTodo;
