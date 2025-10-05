Save Feature

A robust save/restore process is now implemented. All key UI state (models, selected repo, active model, UI tab, page, editor mode, repo list) is automatically saved to localStorage. When you reload or restart the app, your previous state is restored—so you return exactly where you left off.

The save process in the Infinity app works by automatically storing key UI and data state to the browser's localStorage whenever you make changes. This allows you to return to exactly where you left off after a reload or restart.

What is stored in localStorage:

models: All your decision tables and DMN models, including their columns, rows, test cases, and change logs.
selectedRepo: The currently selected repository.
activeModelIdx: The index of the currently selected model within the selected repository.
activeTab: The current UI tab (e.g., "changes", "history", "editor").
activePage: The current main page (e.g., "home", "peerReview", "reporting").
editorMode: Whether you are in the Decision Table IDE or DMN IDE.
repoList: The list of all repositories you have created or added.

How it works:

On every relevant state change, the app serializes this state as a JSON object and saves it to localStorage under the key infinityReactUIState. When the app loads, it checks localStorage for this key. If found, it restores all the above state, so you see the same models, repo, and UI as before. If nothing is found in localStorage, the app uses its default state.
