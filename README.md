# DevNotes

## Overview
DevNotes is a lightweight, offline-first developer notebook built for writing, organizing, and executing code snippets alongside technical notes. Designed with a clean, Notion-inspired dark and light interface, it combines rich markdown editing, bi-directional note linking, an in-browser code execution sandbox, client-side encryption, and visual graph mapping into a responsive web application. It runs entirely in the browser with local persistence and integrates with Cloudflare Workers for secure note sharing.

***Live Site:*** [https://devnotes.geekfolio.workers.dev/](https://devnotes.geekfolio.workers.dev/)

---

> ### ⚠️ Project Disclaimer
> **This is strictly a non-commercial, educational hobby project.** 
> **All application architecture, user interface design, logic, and source code in this repository were completely generated using Artificial Intelligence (AI).** It is maintained solely for learning, personal experimentation, and prototyping purposes.

---

## Tech Stack
- Frontend: HTML5, CSS3, Vanilla JavaScript (ES6+)
- Styling: Custom CSS with dynamic CSS variables, theme switching (Dark, Light, Nord, Catppuccin), and responsive layout
- Offline & PWA: Service Worker API, Cache Storage API, and Web App Manifest
- Security & Cryptography: Web Crypto API (SubtleCrypto, AES-GCM 256-bit, PBKDF2 key derivation)
- Visualization: HTML5 Canvas API for interactive 2D force-directed knowledge graphs
- Build Tooling: Vite
- Serverless Backend: Cloudflare Workers with KV storage for note sharing

## Features
- Markdown Editor and Live Preview: Supports split-pane, edit-only, and preview-only modes with real-time markdown parsing, task lists, code formatting, table rendering, and an interactive table of contents dock.
- In-Browser Code Execution: Built-in sandbox allowing developers to execute JavaScript and HTML code directly from embedded fenced code blocks with inline console output.
- Client-Side Note Encryption: Zero-knowledge client-side encryption using AES-GCM 256-bit encryption. Encrypted notes require a passphrase to decrypt and are never stored in plaintext.
- Bi-directional Linking and Graph Visualization: Obsidian-style double bracket linking (`[[Note Title]]`) with automatic backlink tracking and an interactive force-directed canvas graph view to explore note relationships.
- Hierarchical Organization: Multi-level folder nesting, tags, pinned notes, favorites, and a trash bin with restore and permanent deletion options.
- Command Palette and Quick Navigation: Keyboard-driven workflow with quick navigation via `Cmd/Ctrl + K`, note search, folder switching, and extensive markdown editing shortcuts.
- Productivity Tools: Integrated Pomodoro timer, word count targets, reading time calculations, and detailed writing statistics.
- Data Ownership and Portability: Full JSON export and import, single note Markdown export, printable PDF export, and batch operations for mass note management.
- Note Sharing: Optional note sharing via an integrated Cloudflare Worker API that generates lightweight, read-only public links.
- Progressive Web App: Installable desktop and mobile PWA with offline caching strategies ensuring full functionality without an active network connection.

## Keyboard Shortcuts
Open Command Palette: Cmd/Ctrl + K
New Note: Cmd/Ctrl + N
Save Note: Cmd/Ctrl + S
Toggle Zen Mode: Cmd/Ctrl + Shift + Z
Toggle Table of Contents: Cmd/Ctrl + Shift + T
Knowledge Graph View: Cmd/Ctrl + G
Export Note as PDF: Cmd/Ctrl + Shift + P
Toggle Dark/Light Theme: Cmd/Ctrl + Shift + D
Bold Text: Cmd/Ctrl + B
Italic Text: Cmd/Ctrl + I
Inline Code: Cmd/Ctrl + E
Link Note: [[ + note title + ]]
Close Active Modal: Escape
```bash
npm install
npm run dev
