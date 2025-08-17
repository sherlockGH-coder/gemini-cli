/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TodoWriteTool } from './todo-write.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('TodoWriteTool', () => {
  let tool: TodoWriteTool;

  beforeEach(() => {
    tool = new TodoWriteTool();
    TodoWriteTool.clearTodos();
  });

  describe('validateToolParams', () => {
    it('should accept valid todo parameters', () => {
      const params = {
        todos: [
          {
            id: 'task1',
            content: 'Complete task 1',
            status: 'pending' as const,
          },
          {
            id: 'task2',
            content: 'Complete task 2',
            status: 'in_progress' as const,
          },
        ],
      };

      const result = tool.validateToolParams(params);
      expect(result).toBeNull();
    });

    it('should reject empty todos array', () => {
      const params = { todos: [] };
      const result = tool.validateToolParams(params);
      expect(result).toContain('Parameter "todos" must be a non-empty array.');
    });

    it('should reject todos without id', () => {
      const params = {
        todos: [
          {
            content: 'Complete task 1',
            status: 'pending' as const,
          } as any,
        ],
      };

      const result = tool.validateToolParams(params);
      expect(result).toContain('must have a non-empty "id" string');
    });

    it('should reject todos without content', () => {
      const params = {
        todos: [
          {
            id: 'task1',
            status: 'pending' as const,
          } as any,
        ],
      };

      const result = tool.validateToolParams(params);
      expect(result).toContain('must have a non-empty "content" string');
    });

    it('should reject invalid status', () => {
      const params = {
        todos: [
          {
            id: 'task1',
            content: 'Complete task 1',
            status: 'invalid' as any,
          },
        ],
      };

      const result = tool.validateToolParams(params);
      expect(result).toContain('must have a valid "status"');
    });

    it('should reject multiple in_progress tasks', () => {
      const params = {
        todos: [
          {
            id: 'task1',
            content: 'Task 1',
            status: 'in_progress' as const,
          },
          {
            id: 'task2',
            content: 'Task 2',
            status: 'in_progress' as const,
          },
        ],
      };

      const result = tool.validateToolParams(params);
      expect(result).toContain('Only one task can be "in_progress"');
    });

    it('should reject duplicate IDs', () => {
      const params = {
        todos: [
          {
            id: 'task1',
            content: 'Task 1',
            status: 'pending' as const,
          },
          {
            id: 'task1',
            content: 'Task 2',
            status: 'pending' as const,
          },
        ],
      };

      const result = tool.validateToolParams(params);
      expect(result).toContain('All todo IDs must be unique');
    });
  });

  describe('execute', () => {
    it('should successfully update todos', async () => {
      const params = {
        todos: [
          {
            id: 'task1',
            content: 'Complete implementation',
            status: 'in_progress' as const,
          },
          {
            id: 'task2',
            content: 'Write tests',
            status: 'pending' as const,
          },
        ],
      };

      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toContain('success');
      expect(result.returnDisplay).toContain('📋 Todo List');
      expect(result.returnDisplay).toContain('Complete implementation');
      expect(result.returnDisplay).toContain('Write tests');

      // Check that todos were stored
      const currentTodos = TodoWriteTool.getCurrentTodos();
      expect(currentTodos).toHaveLength(2);
      expect(currentTodos[0].id).toBe('task1');
      expect(currentTodos[1].id).toBe('task2');
    });

    it('should generate proper display format', async () => {
      const params = {
        todos: [
          {
            id: 'task1',
            content: 'Complete implementation',
            status: 'completed' as const,
          },
          {
            id: 'task2',
            content: 'Write documentation',
            status: 'in_progress' as const,
          },
          {
            id: 'task3',
            content: 'Review code',
            status: 'pending' as const,
          },
        ],
      };

      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);

      expect(result.returnDisplay).toContain('📋 Todo List');
      expect(result.returnDisplay).toContain('☑'); // Completed
      expect(result.returnDisplay).toContain('☐'); // In-progress and pending
      expect(result.returnDisplay).toContain(
        '\x1b[9mComplete implementation\x1b[0m',
      ); // ANSI strikethrough for completed
      expect(result.returnDisplay).toContain(
        '\x1b[34mWrite documentation\x1b[0m',
      ); // Blue text for in_progress
      expect(result.returnDisplay).toContain('Review code');
    });

    it('should highlight the most recently completed task', async () => {
      // Set initial state with an in-progress task
      const initialParams = {
        todos: [
          { id: 'task1', content: 'Task 1', status: 'in_progress' as const },
          { id: 'task2', content: 'Task 2', status: 'pending' as const },
        ],
      };
      let invocation = tool.build(initialParams);
      await invocation.execute(new AbortController().signal);

      // Now, complete the task
      const updatedParams = {
        todos: [
          { id: 'task1', content: 'Task 1', status: 'completed' as const },
          { id: 'task2', content: 'Task 2', status: 'in_progress' as const },
        ],
      };
      invocation = tool.build(updatedParams);
      const result = await invocation.execute(new AbortController().signal);

      // Check that the completed task is highlighted in green
      expect(result.returnDisplay).toContain('\x1b[32;9mTask 1\x1b[0m');
      // Check that the new in-progress task is blue
      expect(result.returnDisplay).toContain('\x1b[34mTask 2\x1b[0m');
    });

    it('should correctly handle task transition from completed to pending', async () => {
      // Set initial state with a completed task
      const initialParams = {
        todos: [
          { id: 'task1', content: 'Task 1', status: 'completed' as const },
        ],
      };
      let invocation = tool.build(initialParams);
      await invocation.execute(new AbortController().signal);

      // Now, change the status of the task back to pending
      const updatedParams = {
        todos: [{ id: 'task1', content: 'Task 1', status: 'pending' as const }],
      };
      invocation = tool.build(updatedParams);
      const result = await invocation.execute(new AbortController().signal);

      // Check that the task is no longer highlighted as completed
      expect(result.returnDisplay).not.toContain('\x1b[32;9mTask 1\x1b[0m'); // No green strikethrough
      expect(result.returnDisplay).toContain('Task 1'); // Still contains the task content
      expect(result.returnDisplay).toContain('☐'); // Should be pending (empty box)

      // Check that todos were stored correctly
      const currentTodos = TodoWriteTool.getCurrentTodos();
      expect(currentTodos).toHaveLength(1);
      expect(currentTodos[0].id).toBe('task1');
      expect(currentTodos[0].status).toBe('pending');
    });

    it('should handle empty todo list display', async () => {
      const params = {
        todos: [],
      };
      const invocation = tool.build(params);
      const result = await invocation.execute(new AbortController().signal);
      expect(result.returnDisplay).toContain('No todos currently tracked');
    });
  });

  describe('schema', () => {
    it('should have correct tool name', () => {
      expect(tool.name).toBe('todo_write');
      expect(tool.schema.name).toBe('todo_write');
    });

    it('should have proper parameter schema', () => {
      const schema = tool.schema.parametersJsonSchema as any;
      expect(schema.type).toBe('object');
      expect(schema.properties.todos).toBeDefined();
      expect(schema.properties.todos.type).toBe('array');
      expect(schema.required).toContain('todos');
    });
  });

  describe('getDescription', () => {
    it('should provide meaningful description', () => {
      const params = {
        todos: [
          {
            id: 'task1',
            content: 'Task 1',
            status: 'completed' as const,
          },
          {
            id: 'task2',
            content: 'Task 2',
            status: 'in_progress' as const,
          },
          {
            id: 'task3',
            content: 'Task 3',
            status: 'pending' as const,
          },
        ],
      };

      const invocation = tool.build(params);
      const description = invocation.getDescription();

      expect(description).toContain('3 tasks');
      expect(description).toContain('1 completed');
      expect(description).toContain('1 in progress');
      expect(description).toContain('1 pending');
    });
  });
});
