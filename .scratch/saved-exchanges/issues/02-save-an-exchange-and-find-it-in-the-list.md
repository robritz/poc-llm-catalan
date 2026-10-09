# 02 — Save an exchange and find it in the list

**What to build:** The user can save an exchange from the conversation and find it again later, in a list that survives a reload. Holding a reply shows the existing row with the speaker button; a bookmark toggle now sits beside it. Tapping it saves the exchange: that reply together with the user's message before it. A `Desats` button in the header swaps the conversation for the list of saved exchanges, where each row shows a message and expands to show its reply.

Saved exchanges are kept in the browser's `localStorage`, with no network call. This ticket is the tracer bullet for the feature: it goes from the bookmark, through storage, to the list and back. Reordering, deleting, hearing a saved reply, and handling of storage faults and other tabs are later tickets.

The full design is in `docs/specs/saved-exchanges.md`; read "Identity and contents", "Storage", "Saving from the conversation" and "The list". Terms are defined in `CONTEXT.md`.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

Saving

- [ ] The row under a held reply has a bookmark toggle named `Desa` beside the speaker button. It is an outline when the exchange is not saved and filled when it is, and it reports its pressed state.
- [ ] Tapping the outline bookmark saves the exchange. Tapping the filled bookmark unsaves it. Neither tap dismisses the row.
- [ ] A saved exchange holds the message as the conversation shows it and the reply's Markdown source, and nothing else.
- [ ] Two exchanges are the same when both the message text and the reply text are equal. Saving one that is already saved leaves a single entry and does not move it.
- [ ] The same message with a different reply is saved as a separate entry.
- [ ] The row under the greeting has no bookmark, because the greeting has no visible message before it.

The list

- [ ] The header has a button that reads `Desats` when the conversation is showing and `Torna al xat` when the list is showing. It is present whenever the chat is unlocked, including before a session has started and while the model is waking. It is absent while locked.
- [ ] The list replaces the conversation area and the input row. `Nova conversa` is hidden while the list is showing.
- [ ] Each row has a heading button showing the message on one truncated line. It reports whether it is expanded.
- [ ] Tapping a heading opens the row, showing the full message and the reply. Tapping it again closes it.
- [ ] The reply is rendered with the same Markdown rendering and the same rules as a reply in the conversation: links open in a new tab and images are dropped.
- [ ] At most one row is open. Opening a row closes the one that was open. All rows are closed each time the list is opened.
- [ ] A newly saved exchange is at the top of the list.
- [ ] With nothing saved, the list shows `Encara no has desat res. Mantén premuda una resposta i toca el marcador per desar-la.`
- [ ] There is no hold gesture in the list.

Persistence and the round trip

- [ ] Saved exchanges are still listed after the chat is unmounted and rendered afresh, and after `Nova conversa`.
- [ ] A reply whose exchange was saved earlier shows a filled bookmark when held, including in a later session.
- [ ] Returning from the list shows the conversation as it was: its messages, the text typed in the input, and the state of the translation toggle.
- [ ] A reply that was still arriving when the list was opened continues to arrive and is there in full on return.
- [ ] The list is read only in the browser, and the page produces no hydration mismatch.

Structure, tests and documentation

- [ ] One module owns all reading and writing of the storage key. Nothing else touches `localStorage`. Stored data is JSON holding a format version and the ordered list.
- [ ] The list is its own component, and the chat component does not absorb it.
- [ ] Tests are added to the existing chat component tests and drive the chat as a user would. They use jsdom's real `localStorage`, cleared before each test, and do not assert on the stored JSON or call the storage module directly. Persistence is tested by remounting the chat.
- [ ] The README gains a section on saved exchanges, in the manner of its section on hearing a reply. It states that the list is kept in the browser on one device, is lost when site data is cleared, and may be evicted by iOS Safari after about a week without a visit unless the app is on the home screen.
- [ ] `npm test` and `npm run lint` pass.
