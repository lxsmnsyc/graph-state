import { node } from 'graph-state';
import todoList from './todo-list';

const submitInput = node<undefined, string, void>({
  key: 'submitInput',
  get: undefined,
  set: (context, value) => {
    if (value) {
      context.set(todoList, (currentTodoList) => [
        {
          id: currentTodoList.length,
          text: value,
          completed: false,
        },
        ...currentTodoList,
      ]);
    }
  },
});

export default submitInput;
