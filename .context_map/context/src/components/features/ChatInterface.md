# Context Map: ChatInterface.jsx


## 1. Purpose

The dedicated full-screen interface for the Local AI Chat service. It provides a standard conversational layout (message bubbles, input bar, status indicators) and manages the visual rendering of the LLM interaction history.


## 2. Imports

- **React**:
  - Syntax: `import React, { useRef, useEffect } from 'react';`
  - Purpose: Used for the auto-scroll-to-bottom logic in the chat log.

- **useApp**:
  - Syntax: `import { useApp } from '../../context/AppContext';`
  - Purpose: Accesses global processing status (`isProcessing`) to show loading spinners.

- **useChat**:
  - Syntax: `import { useChat } from '../../hooks/useChat';`
  - Purpose: Primary business logic hook for message state and AI communication.


## 3. Dependencies

- **Used by**:
  - `App.jsx` (Conditionally rendered when `currentService.id === 'chat'`).

- **External APIs**:
  - **Browser DOM**: Textarea and button event listeners.


## 4. State Management

- **messages (Destructured Hook State)**:
  - Syntax: `const { messages, input, setInput, sendMessage } = useChat();`
  - Purpose: The source data for rendering the message log.

- **isProcessing (Destructured Global State)**:
  - Syntax: `const { isProcessing } = useApp();`
  - Purpose: Toggles the "Thinking..." status and disables the send button.


### 1. Mounting
- **Flow**: The component subscribes to the `useChat` hook to populate initial messages.
- **Files Involved**:
  - `useChat.js`: Provides the message history and streaming logic.

### 2. Synchronization
- **Flow**: An `useEffect` monitors the `messages` array and auto-scrolls to the bottom.

### 3. Interaction
- **Flow**: User types and presses Enter (or clicks Send). `sendMessage` is invoked.
- **Files Involved**:
  - `useChat.js`: Orchestrates the AI communication and local message appending.

### 4. Feedback
- **Flow**: While the AI is generating tokens, a loading indicator is displayed.
- **Files Involved**:
  - `AppContext.jsx`: Provides the `isProcessing` lock to prevent multiple overlapping requests.


## 6. Code Structure

- **Auto-Scroll Behavior (Effect Hook)**:
  - Syntax: `useEffect(() => { ... scrollIntoView({ behavior: 'smooth' }) ... }, [messages]);`
  - Purpose: UX improvement for long conversations.
  - Working: References a dummy `div` at the bottom of the message list and triggers a smooth scroll whenever the history appends.

- **Input Handling (Function)**:
  - Syntax: `const onKeyDown = (e) => { ... };`
  - Purpose: Standard chat keyboard shortcuts.
  - Working: Listens for the "Enter" key (without Shift) to trigger `sendMessage`.


## 7. Points To Consider

- **The "Shift+Enter" Trap**: The input is a `<textarea>`, so the component must distinguish between a new line (`Shift+Enter`) and a submission (`Enter`).

- **Role-Based Styling**: Messages are rendered with dynamic classes based on `msg.role` ('user', 'assistant', 'system'). This is the primary way the UI differentiates between chat bubbles.

- **Loading State Lock**: The "Send" button and textarea should be disabled when `isProcessing` is true to prevent overlapping AI requests which might crash the local model session.

- **Model Context**: While this component is a generic chat UI, it is specifically configured to work with the `LFM-1.2B` model via the `useChat` hook settings.
