/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  ToolResult,
} from './tools.js';
import { FunctionDeclaration } from '@google/genai';
import { SchemaValidator } from '../utils/schemaValidator.js';

interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface TodoWriteParams {
  todos: TodoItem[];
}

const todoWriteSchemaData: FunctionDeclaration = {
  name: 'todo_write',
  description:
    'Use this tool to create and manage a structured task list for your current coding session. This helps track progress, organize complex tasks, and demonstrate thoroughness.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The task description',
              minLength: 1,
            },
            status: {
              type: 'string',
              description: 'The current status of the task',
              enum: ['pending', 'in_progress', 'completed'],
            },
            id: {
              type: 'string',
              description: 'Unique identifier for the task',
            },
          },
          required: ['content', 'status', 'id'],
          additionalProperties: false,
        },
        description: 'The updated todo list',
        minItems: 1,
      },
    },
    required: ['todos'],
    additionalProperties: false,
  },
};

const todoWriteDescription = `
Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.
It also helps the user understand the progress of the task and overall progress of their requests.

## When to Use This Tool
Use this tool proactively in these scenarios:

1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests todo list - When the user directly asks you to use the todo list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as todos
6. When you start working on a task - Mark it as in_progress BEFORE beginning work. Ideally you should only have one todo as in_progress at a time
7. After completing a task - Mark it as completed and add any new follow-up tasks discovered during implementation

## When NOT to Use This Tool

Skip using this tool when:
1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no organizational benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

NOTE that you should not use this tool if there is only one trivial task to do. In this case you are better off just doing the task directly.

## Examples of When to Use the Todo List

<example>
User: I want to add a dark mode toggle to the application settings. Make sure you run the tests and build when you're done!
Assistant: I'll help add a dark mode toggle to your application settings. Let me create a todo list to track this implementation.
*Creates todo list with the following items:*
1. Create dark mode toggle component in Settings page
2. Add dark mode state management (context/store)
3. Implement CSS-in-JS styles for dark theme
4. Update existing components to support theme switching
5. Run tests and build process, addressing any failures or errors that occur
*Begins working on the first task*

<reasoning>
The assistant used the todo list because:
1. Adding dark mode is a multi-step feature requiring UI, state management, and styling changes
2. The user explicitly requested tests and build be run afterward
3. The assistant inferred that tests and build need to pass by adding \"Ensure tests and build succeed\" as the final task
</reasoning>
</example>

<example>
User: Help me rename the function getCwd to getCurrentWorkingDirectory across my project
Assistant: Let me first search through your codebase to find all occurrences of 'getCwd'.
*Uses grep or search tools to locate all instances of getCwd in the codebase*
Assistant: I've found 15 instances of 'getCwd' across 8 different files. Let me create a todo list to track these changes.
*Creates todo list with specific items for each file that needs updating*

<reasoning>
The assistant used the todo list because:
1. First, the assistant searched to understand the scope of the task
2. Upon finding multiple occurrences across different files, it determined this was a complex task with multiple steps
3. The todo list helps ensure every instance is tracked and updated systematically
4. This approach prevents missing any occurrences and maintains code consistency
</reasoning>
</example>


<example>
User: I need to implement these features for my e-commerce site: user registration, product catalog, shopping cart, and checkout flow.
Assistant: I'll help implement these features. First, let's add all the features to the todo list.
*Creates a todo list breaking down each feature into specific tasks based on the project architecture*
Assistant: Let's start with user registration. This will involve creating database models, API endpoints, and frontend forms that integrate with your existing authentication system.

<reasoning>
The assistant used the todo list because:
1. The user provided multiple complex features to implement in a comma separated list
2. The todo list helps organize these large features into manageable tasks
3. This approach allows for tracking progress across the entire implementation
</reasoning>
</example>

<example>
User: Can you help optimize my React application? It's rendering slowly and has performance issues.</user>
Assistant: I'll help optimize your React application. First, let me examine your codebase to identify potential performance bottlenecks.
*Reviews component structure, render patterns, state management, and data fetching*
Assistant: After analyzing your codebase, I've identified several performance issues. Let me create a todo list to track our optimization efforts.
*Creates todo list with items like: 1) Implement memoization for expensive calculations in ProductList, 2) Add virtualization for long lists in Dashboard, 3) Optimize image loading in Gallery component, 4) Fix state update loops in ShoppingCart, 5) Review bundle size and implement code splitting*
Let's start by implementing memoization for the expensive calculations in your ProductList component.</assistant>

<reasoning>
The assistant used the todo list because:
1. First, the assistant examined the codebase to identify specific performance issues
2. Based on this analysis, it identified multiple optimization opportunities
3. Performance optimization is a non-trivial task requiring multiple steps
4. The todo list helps methodically track improvements across different components
5. This systematic approach ensures all performance bottlenecks are addressed
</reasoning>
</example>

## Examples of When NOT to Use the Todo List

<example>
User: How do I print 'Hello World' in Python?
Assistant: In Python, you can print \"Hello World\" with this simple code:

python
print(\"Hello World\")

This will output the text \"Hello World\" to the console when executed.</assistant>

<reasoning>
The assistant did not use the todo list because this is a single, trivial task that can be completed in one step. There's no need to track multiple tasks or steps for such a straightforward request.
</reasoning>
</example>

<example>
User: What does the git status command do?
Assistant: The git status command shows the current state of your working directory and staging area. It displays which changes have been staged, which haven't, and which files aren't being tracked by Git. This is a fundamental command for understanding the current state of your repository before making commits.

<reasoning>
The assistant did not use the todo list because this is an informational request with no actual coding task to complete. The user is simply asking for an explanation, not for the assistant to perform multiple steps or tasks.
</reasoning>
</example>

<example>
User: Can you add a comment to the calculateTotal function to explain what it does?
Assistant: Sure, let me add a comment to the calculateTotal function to explain what it does.
* Uses the Edit tool to add a comment to the calculateTotal function *

<reasoning>
The assistant did not use the todo list because this is a single, straightforward task confined to one location in the code. Adding a comment doesn't require tracking multiple steps or systematic organization.
</reasoning>
</example>

<example>
User: Run npm install for me and tell me what happens.
Assistant: I'll run the npm install command for you.

*Executes: npm install*

The command completed successfully. Here's the output:
[Output of npm install command]

All dependencies have been installed according to your package.json file.

<reasoning>
The assistant did not use the todo list because this is a single command execution with immediate results. There are no multiple steps to track or organize, making the todo list unnecessary for this straightforward task.
</reasoning>
</example>

## Task States and Management

1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully

2. **Task Management**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Only have ONE task in_progress at any time
   - Complete current tasks before starting new ones
   - Remove tasks that are no longer relevant from the list entirely

3. **Task Completion Requirements**:
   - ONLY mark a task as completed when you have FULLY accomplished it
   - If you encounter errors, blockers, or cannot finish, keep the task as in_progress
   - When blocked, create a new task describing what needs to be resolved
   - Never mark a task as completed if:
     - Tests are failing
     - Implementation is partial
     - You encountered unresolved errors
     - You couldn't find necessary files or dependencies

4. **Task Breakdown**:
   - Create specific, actionable items
   - Break complex tasks into smaller, manageable steps
   - Use clear, descriptive task names

## Parameters

- \`todos\` (array, required): Array of todo items, each with:
  - \`id\` (string): Unique identifier for the task
  - \`content\` (string): Description of the task
  - \`status\` (enum): One of "pending", "in_progress", or "completed"

When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.`;

// Global storage for todos
let currentTodos: TodoItem[] = [];
let mostRecentlyCompletedId: string | null = null;

class TodoWriteInvocation extends BaseToolInvocation<
  TodoWriteParams,
  ToolResult
> {
  getDescription(): string {
    const todoCount = this.params.todos.length;
    const statusCounts = this.params.todos.reduce(
      (acc, todo) => {
        acc[todo.status] = (acc[todo.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const inProgress = statusCounts.in_progress || 0;
    const pending = statusCounts.pending || 0;
    const completed = statusCounts.completed || 0;

    return `📋 Managing ${todoCount} tasks: ${inProgress} in progress, ${pending} pending, ${completed} completed`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      // Find the newly completed task to highlight it.
      const previouslyInProgress = currentTodos.find(
        (t) => t.status === 'in_progress',
      );
      if (previouslyInProgress) {
        const nowCompleted = this.params.todos.find(
          (t) => t.id === previouslyInProgress.id && t.status === 'completed',
        );
        if (nowCompleted) {
          mostRecentlyCompletedId = nowCompleted.id;
        } else {
          mostRecentlyCompletedId = null;
        }
      } else {
        mostRecentlyCompletedId = null;
      }

      // Update the global todos
      currentTodos = [...this.params.todos];

      // Generate display output
      const todoDisplay = this.generateTodoDisplay();
      const summary = this.generateSummary();

      return {
        llmContent: JSON.stringify({
          success: true,
          message: 'Todo list updated successfully',
          todos: this.params.todos,
          summary,
        }),
        returnDisplay: todoDisplay,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[TodoWriteTool] Error updating todos: ${errorMessage}`);
      return {
        llmContent: JSON.stringify({
          success: false,
          error: `Failed to update todos: ${errorMessage}`,
        }),
        returnDisplay: `Error updating todos: ${errorMessage}`,
      };
    }
  }

  private generateTodoDisplay(): string {
    const todos = this.params.todos;
    if (todos.length === 0) {
      return '📋 Todo List\n└── No todos currently tracked.';
    }

    let display = '📋 Todo List\n';

    // Display each todo with status-based formatting
    todos.forEach((todo, index) => {
      const isLast = index === todos.length - 1;
      const prefix = isLast ? '└──' : '├──';

      let statusIcon: string;
      let content: string;

      switch (todo.status) {
        case 'in_progress':
          statusIcon = '☐'; // Empty square box for in_progress
          content = `\x1b[34m${todo.content}\x1b[0m`; // Blue text for in_progress
          break;
        case 'completed':
          statusIcon = '☑'; // Square box with checkmark for completed
          if (todo.id === mostRecentlyCompletedId) {
            // Green, strikethrough text for the most recently completed task
            content = `\x1b[32m\x1b[9m${todo.content}\x1b[29m\x1b[0m`;
          } else {
            // Regular strikethrough for other completed tasks
            content = `\x1b[9m${todo.content}\x1b[29m\x1b[0m`;
          }
          break;
        default: // pending
          statusIcon = '☐'; // Empty square box for pending
          content = todo.content; // No special formatting for pending
          break;
      }

      display += `${prefix} ${statusIcon} ${content}\n`;
    });

    return display.trim();
  }

  private generateSummary(): string {
    const todos = this.params.todos;
    const totalTodos = todos.length;
    const completedTodos = todos.filter((t) => t.status === 'completed').length;
    const inProgressTodos = todos.filter(
      (t) => t.status === 'in_progress',
    ).length;
    const pendingTodos = todos.filter((t) => t.status === 'pending').length;

    return `${totalTodos} total tasks: ${completedTodos} completed, ${inProgressTodos} in progress, ${pendingTodos} pending`;
  }
}

export class TodoWriteTool extends BaseDeclarativeTool<
  TodoWriteParams,
  ToolResult
> {
  static readonly Name: string = todoWriteSchemaData.name!;

  constructor() {
    super(
      TodoWriteTool.Name,
      'TodoWrite',
      todoWriteDescription,
      Kind.Think,
      todoWriteSchemaData.parametersJsonSchema as Record<string, unknown>,
    );
  }

  override validateToolParams(params: TodoWriteParams): string | null {
    const errors = SchemaValidator.validate(
      this.schema.parametersJsonSchema,
      params,
    );
    if (errors) {
      return errors;
    }

    // Validate todos array
    if (!Array.isArray(params.todos) || params.todos.length === 0) {
      return 'Parameter "todos" must be a non-empty array.';
    }

    // Validate each todo item
    for (let i = 0; i < params.todos.length; i++) {
      const todo = params.todos[i];

      if (!todo.id || typeof todo.id !== 'string' || todo.id.trim() === '') {
        return `Todo item at index ${i} must have a non-empty "id" string.`;
      }

      if (
        !todo.content ||
        typeof todo.content !== 'string' ||
        todo.content.trim() === ''
      ) {
        return `Todo item at index ${i} must have a non-empty "content" string.`;
      }

      if (!['pending', 'in_progress', 'completed'].includes(todo.status)) {
        return `Todo item at index ${i} must have a valid "status" (pending, in_progress, or completed).`;
      }
    }

    // Validate that there's at most one in_progress task
    const inProgressTasks = params.todos.filter(
      (todo) => todo.status === 'in_progress',
    );
    if (inProgressTasks.length > 1) {
      return 'Only one task can be "in_progress" at a time.';
    }

    // Validate unique IDs
    const ids = params.todos.map((todo) => todo.id);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      return 'All todo IDs must be unique.';
    }

    return null;
  }

  protected createInvocation(params: TodoWriteParams) {
    return new TodoWriteInvocation(params);
  }

  /**
   * Get the current todos (for testing or external access)
   */
  static getCurrentTodos(): TodoItem[] {
    return [...currentTodos];
  }

  /**
   * Clear all todos (for testing)
   */
  static clearTodos(): void {
    currentTodos = [];
  }
}

