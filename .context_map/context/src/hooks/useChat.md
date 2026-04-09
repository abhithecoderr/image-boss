# Context Map: useChat.js


## 1. Purpose

The management hook for the AI Chat interface. It handles message history persistence, user input state, and orchestrates the interaction with the `useProcessor` hook for local LLM generation. It transforms raw AI text chunks into a structured conversation history.


## 2. Imports

- **React**:
  - Syntax: `import { useState, useCallback, useEffect } from 'react';`
  - Purpose: Manages the `messages` array and input field character state.

- **useApp**:
  - Syntax: `import { useApp } from '../context/AppContext';`
  - Purpose: Used for service verification and displaying error toasts.

- **useProcessor**:
  - Syntax: `import { useProcessor } from './useProcessor';`
  - Purpose: The primary engine for sending prompts to the active AI processor.


## 3. Dependencies

- **Used by**:
  - `ChatInterface.jsx` (Primary UI for the local LLM).


## 4. State Management

- **messages (State)**:
  - Syntax: `const [messages, setMessages] = useState([ { role: 'system', content: '...' } ]);`
  - Purpose: An array of role-based message objects that populate the chat log.

- **input (State)**:
  - Syntax: `const [input, setInput] = useState('');`
  - Purpose: Controlled component state for the chat text area.


## 5. Project Flow

1. **Intake**: User types into the input field and triggers `sendMessage`.

2. **UI Update**: The user's message is immediately appended to the `messages` state to provide instant feedback.

3. **Inference**: The `input` text is passed to `useProcessor.process` as an option bundle.

4. **Aggregation**: The AI's response text is extracted from the result buffer.

5. **Realization**: The AI's response is appended as an `assistant` role message, and the loading state is cleared.


## 6. Code Structure

- **sendMessage (Callback)**:
  - Syntax: `const sendMessage = useCallback(async () => { ... }, [input, process, showToast]);`
  - Purpose: The primary async communication orchestrator.
  - Working: Performs whitespace trimming on input, updates the message state, invokes the AI processor, and handles the conditional format of the returned AI text (e.g., `result.text` vs raw string).


## 7. Points To Consider

- **The "Local-Only" Invariant**: This hook assumes the `processor` is running a local model (LFM or Florence-2). No network calls originate from this hook.

- **State Persistence Trap**: Current message history is volatile (reset on page reload). For long-term sessions, this should eventually sync with a `localStorage` registry.

- **Empty Input Guard**: The hook includes a `.trim()` check to prevent sending empty prompts to the AI models, which can cause undefined behavior in tokenizers.

- **System Prompt Initialization**: The default state includes a "System" role message. This determines the AI's greeting and sets the initial conversational tone.
