# 04 — Hear a saved reply

**What to build:** The user can hear a saved reply spoken from the list of saved exchanges. An open row shows a speaker button under the reply, with no further tap needed. The sound behaves by the same rule as in the conversation: it plays until it ends, until another sound is started, or until a mute button is pressed. So a reply started in the list keeps speaking when the user goes back to the conversation, and a reply started in the conversation keeps speaking when the user opens the list. The header mute button from ticket 01 is the way to stop it from wherever the user is.

Speech is fetched through the existing speak route each time; no audio is stored. This is the one part of the list that needs the network.

The full design is in `docs/specs/saved-exchanges.md`; read "Sound". Terms are defined in `CONTEXT.md`.

**Blocked by:** 01 — Sound that outlives the held row. 03 — Reorder and delete saved exchanges.

**Status:** ready-for-agent

- [ ] An open row in the list has a speaker button named `Escolta` under the reply. Tapping it speaks the reply.
- [ ] The button reads `Carregant…` while the audio is prepared, and `No s'ha pogut reproduir l'àudio.` is shown when it fails, as in the conversation.
- [ ] While a saved reply is speaking, its row shows a mute button in place of the speaker button whenever the row is open, and the header shows its mute button in both views.
- [ ] Either mute button ends the sound. Both are removed when the speech ends.
- [ ] A sound started in the list carries on when the user returns to the conversation, and one started in the conversation carries on when the user opens the list.
- [ ] A sound started in the list carries on when its row is closed, when another row is opened, and when rows are moved.
- [ ] A sound asked for in one view takes over from a sound started in the other once it has loaded, and not before. There is one audio player and one sound at a time.
- [ ] A saved reply that was muted or has ended is spoken again from the audio already loaded, with no second request, as in the conversation.
- [ ] A sound requested in one view starts when it is ready even if the user has since switched view.
- [ ] What is speaking identifies the one place the sound was started. The same text in the other view (a reply in the conversation that is also saved) shows an ordinary speaker button there, and tapping it starts a new sound.
- [ ] The sound stops when the saved exchange it was started from leaves the list, for whatever reason. Deleting it with `Suprimeix` is the case to test.
- [ ] Unsaving a reply from the conversation does not stop a sound that was started on that reply in the conversation.
- [ ] `Nova conversa` stops a sound started in the conversation and does not stop one started in the list.
- [ ] Hearing a saved reply works before a session has started.
- [ ] Tests are added to the existing chat component tests, using the existing fake audio player and fake network. Where two mute buttons are on screen, tests tell them apart by where they sit.
- [ ] `npm test` and `npm run lint` pass.
