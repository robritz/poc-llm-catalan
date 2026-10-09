# Saved exchanges

Terms in **bold** on first use are defined in `CONTEXT.md` at the repository root. Use them as defined there.

## Problem Statement

A learner asks the chat to translate something they will need again: how to order a coffee, how to ask where the station is. The **reply** is exactly what they wanted, but it lives only in the current **conversation**. `Nova conversa` clears it, and so does closing or reloading the page. To get it back they must wake the model again, which can take three to four minutes, retype the **message**, and hope the model words the **translation** the same way. There is nowhere to keep the phrases they rely on.

## Solution

The user can save any **exchange**, which is one message together with the reply to it. A **saved exchange** is kept on the user's device and is still there the next time they open the app, with no account and no network call.

Saving happens in the conversation: tapping a reply shows a speaker button under it, and a bookmark button now sits beside it. Saved exchanges are shown in a list, opened from a `Desats` button in the header. Each row shows the message; tapping it expands the row to show the reply, which can be played as speech. The user can reorder the list and delete from it. The list is available as soon as the chat is unlocked, so it can be read while the model is still waking.

## User Stories

### Saving

1. As a learner, I want to save an exchange from the conversation, so that I can come back to a translation I will need again.
2. As a learner, I want to save any exchange and not only translations, so that I can keep an explanation or an answer that was useful.
3. As a learner, I want the save button to appear in the same place as the speaker button when I tap a reply, so that I have one gesture to learn.
4. As a learner, I want the bookmark to change from outline to filled when I save, so that I can see the save worked.
5. As a learner, I want the row under the reply to stay open after I tap the bookmark, so that I can see its new state.
6. As a learner, I want a reply that is already saved to show a filled bookmark when I tap it, so that I know not to save it again.
7. As a learner, I want to unsave an exchange by tapping the filled bookmark, so that I can undo a save without leaving the conversation.
8. As a learner, I want saving the same message and reply twice to leave a single entry, so that my list does not fill with duplicates.
9. As a learner, I want the same message with a differently worded reply to be saved as its own entry, so that I can keep two translations of one phrase.
10. As a learner, I want the saved exchange to hold the message exactly as I typed it and the reply exactly as it was written, so that nothing is lost in saving.
11. As a learner, I want no save button on the greeting at the start of a **session**, so that I am not offered a save that has no message to show.
12. As a learner, I want no save button while a reply is still being written, so that I cannot save half a reply.
13. As a learner, I want to be told when a save could not be stored, so that I do not assume something was kept when it was not.
14. As a learner, I want the bookmark to stay unfilled when a save fails, so that what I see matches what was stored.

### Persistence

15. As a learner, I want my saved exchanges to still be there after I reload or close the page, so that saving is worth doing.
16. As a learner, I want my saved exchanges to survive `Nova conversa`, so that clearing the conversation does not cost me my phrases.
17. As a learner, I want saving, viewing, reordering and deleting to work with no network call, so that the list is instant and works on a poor connection.
18. As a learner, I want a reply I saved in an earlier session to show as saved if the same message and reply appear again, so that the conversation and the list agree.
19. As a learner with the app open in two tabs, I want a save made in one tab to appear in the other, so that the tabs do not disagree.
20. As a learner with the app open in two tabs, I want a change made in one tab never to erase a save made in the other, so that I do not lose data without knowing.
21. As a learner whose stored list has become unreadable, I want the app to show an empty list and keep working, so that a storage fault does not break the chat.

### The list

22. As a learner, I want a `Desats` button in the header, so that I can reach my saved exchanges from anywhere in the chat.
23. As a learner, I want the list to be available while the model is waking, so that I can use a saved translation during the wait.
24. As a learner, I want the list to be available before I have started a session, so that I do not have to wake the model just to read a phrase.
25. As a person who has not entered the secret phrase, I want no access to the list, so that the locked screen shows nothing of the app.
26. As a learner, I want the `Desats` button to be there even when I have saved nothing, so that I can find out the feature exists.
27. As a learner with nothing saved, I want the empty list to tell me how to save, so that I can discover that tapping a reply opens its options.
28. As a learner, I want each row to show the message I typed, so that I can find a phrase by what I asked.
29. As a learner, I want a long message cut to a single line in the collapsed row, so that I can scan the list quickly.
30. As a learner, I want to tap a row to reveal the reply, so that I can test myself before looking at the translation.
31. As a learner, I want the full message shown when a row is open, so that I can read a message that was cut short.
32. As a learner, I want the reply formatted in the list as it was in the conversation, so that lists, tables and emphasis still read correctly.
33. As a learner, I want only one row open at a time, so that the list stays short enough to scan.
34. As a learner, I want every row collapsed when I open the list, so that I always start from the same view.
35. As a learner, I want to tap an open row to close it, so that I can hide the reply again.
36. As a learner, I want a newly saved exchange to appear at the top, so that what I just saved is the first thing I see.
37. As a keyboard or screen-reader user, I want each row to announce whether it is expanded, so that I can use the list without seeing it.

### Reordering and deleting

38. As a learner, I want to move a saved exchange up or down, so that the phrases I use most are at the top.
39. As a learner, I want the up button disabled on the first row and the down button on the last, so that I am not offered a move that does nothing.
40. As a learner, I want my order to be kept between sessions, so that I arrange the list once.
41. As a learner, I want an open row to stay open when I move it, so that reordering does not lose my place.
42. As a learner, I want to delete a saved exchange, so that I can remove phrases I no longer need.
43. As a learner, I want the delete button inside the open row and not on the collapsed row, so that I do not delete by mis-tapping while reordering.
44. As a learner, I want deletion to happen at once with no confirmation, so that tidying the list is quick.
45. As a keyboard or screen-reader user, I want the reorder and delete buttons to have names, so that I know what each one does.

### Moving between the list and the conversation

46. As a learner, I want the header button to read `Torna al xat` while the list is open, so that I know how to get back.
47. As a learner, I want my conversation to be exactly as I left it when I return, so that looking at the list costs me nothing.
48. As a learner, I want the text I had typed and the state of the translation toggle kept when I return, so that I can carry on where I stopped.
49. As a learner, I want a reply that was still arriving when I opened the list to be there in full when I return, so that I can look something up while I wait.
50. As a learner, I want the message input and `Nova conversa` hidden while the list is open, so that I am not offered actions on a conversation I cannot see.

### Hearing

51. As a learner, I want to hear a saved reply spoken, so that I can practise pronunciation of a phrase I use often.
52. As a learner, I want the speaker button visible in the open row, so that hearing a saved reply takes one tap.
53. As a learner, I want to see that the audio is loading, so that I know my tap registered.
54. As a learner, I want to be told when a saved reply could not be spoken, so that I am not left waiting.
55. As a learner, I want a reply to keep speaking when I switch between the conversation and the list, so that a long reply does not hold me in one view.
56. As a learner, I want a reply to keep speaking when I close its row, open another row or reorder the list, so that browsing does not cut the sound off.
57. As a learner, I want a reply to keep speaking when I tap a different reply in the conversation, so that I can save one reply while listening to another.
58. As a learner, I want a mute button in the header whenever something is speaking, so that I can stop the sound from wherever I am.
59. As a learner, I want the mute button under the speaking reply as well, so that I can stop the sound where I started it.
60. As a learner, I want a second sound to take over from the first once it has loaded, so that two replies never speak at once and there is no silence while I wait.
61. As a learner, I want the sound to stop when I delete the saved exchange that is speaking, so that I do not hear text that is no longer on screen.
62. As a learner, I want the sound to stop when `Nova conversa` clears the reply that is speaking, so that I do not hear text that is no longer on screen.
63. As a learner, I want the sound to carry on when I unsave the speaking reply from the conversation, so that unsaving does not interrupt what is still in front of me.
64. As a learner, I want the header mute button to disappear when the sound ends, so that the header shows it only when it is useful.

## Implementation Decisions

### Identity and contents

- A saved exchange consists of the message text and the reply text, and nothing else. It does not record whether the reply was a translation, when it was saved, or the ids of the messages it came from.
- Both texts are stored as the conversation shows them: the visible text of the message, and the reply's Markdown source.
- Two saved exchanges are the same when both texts are equal. Identity is by content because message ids do not survive a reload. Every operation (is it saved, unsave, move, delete) identifies its target this way.
- The exchange for a reply is that reply and the nearest visible user message before it. A reply with no visible message before it, which today means only the greeting, is not an exchange and cannot be saved.

### Storage

- Saved exchanges are kept in the browser's `localStorage` under a single key, as JSON holding a format version and the ordered list. The order of the list is the order shown.
- A new module owns all reading and writing of that key. Nothing else touches `localStorage`. Its interface is small: read the list, subscribe to changes, and save, unsave, move up, move down and delete an exchange. Saving reports whether the write succeeded.
- Every write reads the stored list at that moment, applies the one change to it, and writes the result. It never writes back a list held in memory by the page. A move or delete whose target is no longer in the stored list changes nothing.
- A new saved exchange is inserted at the top. Saving one that is already stored changes nothing, and does not move it.
- The page stays in step with storage, including changes made by another tab, by subscribing to the browser's `storage` event as well as to its own writes.
- Stored data that is missing, cannot be parsed, has an unknown version, or is not the expected shape is read as an empty list. It is left untouched until the user's next save, which replaces it.
- A write that throws, because storage is full or blocked, is reported to the caller and leaves stored data as it was.
- There is no limit on the number of saved exchanges.
- The list is read only in the browser. The server renders the page as if nothing were saved, and the page must not produce a hydration mismatch when the stored list is then read.

### Saving from the conversation

- Tapping a reply opens a row of options under it, and tapping the reply again closes it. Pressing anywhere outside the row and the replies also closes it. A tap on a link in the reply, or a drag that selects text, does not open it. This replaces the earlier gesture of holding a reply for half a second.
- That row gains a bookmark toggle beside the speaker button. Its accessible name is `Desa`, and it reports its pressed state.
- The bookmark is an outline when the exchange is not saved and filled when it is. Tapping it saves or unsaves. Tapping it does not dismiss the row.
- When a save fails, `No s'ha pogut desar.` is shown in the row, styled as the existing audio failure message is, and the bookmark stays an outline.
- The bookmark is absent from the row under a reply that is not part of an exchange.

### The list

- The list is a second view inside the existing chat screen, not a new route. Opening it replaces the conversation area and the input row; the header stays.
- The header holds one button that switches view. It reads `Desats` when the conversation is showing and `Torna al xat` when the list is showing. It is present whenever the chat is unlocked, whether or not a session has started, and absent while locked.
- `Nova conversa` is hidden while the list is showing.
- Switching view must not unmount or reset the conversation. Its messages, the typed input, the translation toggle and any request in flight are unaffected, and a reply that is arriving continues to arrive.
- The list is an accordion built as its own component. Each row has a heading button showing the message on one truncated line, which reports its expanded state, and up and down buttons named `Mou amunt` and `Mou avall`. Up is disabled on the first row and down on the last.
- At most one row is open. Opening a row closes the one that was open. All rows are closed when the list is opened. Which row is open follows the exchange when it is moved.
- An open row shows the message in full, then the reply rendered through the same Markdown rendering as a reply in the conversation, with the same rules: links open in a new tab and images are dropped. Under the reply are a speaker button and a delete button named `Suprimeix`.
- Deleting removes the saved exchange at once. There is no confirmation and no undo.
- With nothing saved, the list shows: `Encara no has desat res. Toca una resposta i després el marcador per desar-la.`
- Tapping a reply in the list does nothing; its options are always shown in the open row.

### Sound

- There remains one audio player for the whole chat, and so one sound at a time.
- A sound, once started, plays until it ends, until a mute button is pressed, or until another sound that was asked for has loaded and takes over. It carries on while that other sound is loading. Switching view, opening, closing or moving a row, and tapping another reply do not stop it.
- Pressing mute while another sound is loading ends only the sound that is playing. The one that is loading still plays when it arrives.
- The audio last loaded is kept. Asking again for the same source, after it was muted or has ended, plays that audio from the start without a second request to the speak route. Only one is kept: loading another replaces it.
- Only the newest request to speak is ever played. One that finishes loading after a later request was made is discarded.
- What is speaking is tracked separately from which reply is showing the row of options. It identifies the one place the sound was started from: a particular reply in the conversation, or a particular saved exchange in the list.
- While a sound is playing, a mute button named `Silencia` is shown in the header in both views. It is removed when the sound ends or is muted.
- The place the sound was started from also shows a mute button in place of its speaker button for as long as it is speaking. In the conversation this stays under the speaking reply even when the row of options has moved to another reply. In the list it shows whenever that row is open.
- The same text reachable from the other view (a reply in the conversation that is also a saved exchange) shows an ordinary speaker button there. Tapping it starts a new sound.
- The sound stops when its source is removed: the speaking saved exchange is deleted, whether from the list or from another tab, or `Nova conversa` clears the conversation holding the speaking reply. Unsaving the speaking reply from the conversation does not stop a sound started in the conversation.
- The loading and failure states of the speaker button work in the list as they do in the conversation: `Carregant…` while the audio is prepared, and `No s'ha pogut reproduir l'àudio.` on failure. A sound requested in one view starts when it is ready even if the user has switched view.
- Speech is fetched through the existing speak route each time. No audio is stored.

### Documentation

- The README gains a section describing saved exchanges, in the manner of its section on hearing a reply. It states that the list is kept in the browser on one device, is lost when site data is cleared, and may be evicted by iOS Safari after about a week without a visit unless the app is on the home screen.

## Testing Decisions

- There is one test seam: the rendered chat. Every behaviour in this spec is tested by driving the chat as a user would and asserting on what is on screen. The storage module and the list component have no test files of their own; they are covered through the chat.
- A good test here describes something a user can observe: what is shown, what can be pressed, what is heard. It does not assert on the stored JSON, on the storage module's functions, or on component state. Persistence is tested by saving, unmounting the chat, rendering it afresh and finding the saved exchange in the list.
- The prior art is the existing chat component tests, which already fake the network and the audio player and already drive the tap on a reply. The new tests extend that file, reuse its helpers, and are grouped under their own headings as the existing groups are.
- The outside world is replaced at three points only:
  - The network and the audio player, by the existing fakes, unchanged.
  - Storage, by jsdom's real `localStorage`, cleared before each test. A failed write is simulated by making the storage write throw. Unreadable storage is simulated by placing junk under the key before rendering.
  - Another tab, by changing storage directly and dispatching a `storage` event.
- Behaviours that must have a test: saving and unsaving from the conversation; the filled bookmark on an exchange already saved; no duplicate on a second save; no bookmark on the greeting; the failure message; survival across a remount and across `Nova conversa`; the list being reachable before a session starts and not while locked; the empty state; one row open at a time; newest first; moving up and down with the end buttons disabled; order surviving a remount; delete; the conversation, typed input and toggle surviving a round trip to the list; a reply arriving while the list is open; hearing a saved reply; sound continuing across a change of view and across tapping another reply; the header mute button; sound stopping on delete and on `Nova conversa`; a save from another tab appearing; a write not erasing another tab's save; junk in storage reading as empty.
- One existing test asserts that opening the options under another reply ends the sound. That behaviour is deliberately changed, so the test is rewritten to assert the new rule. Its other half, that `Nova conversa` ends the sound, still holds.
- Two mute buttons with the same name can now be on screen together. Tests must tell the header's from the reply's by where it sits, not by name alone.

## Out of Scope

- Syncing saved exchanges between devices or browsers, and anything that needs an account or a server.
- Exporting, importing or backing up the list.
- Storing audio, or hearing a saved reply without a network connection.
- Drag-and-drop reordering.
- Editing a saved exchange.
- Copying to the clipboard, or sending a saved message into the conversation again.
- Searching, filtering, grouping or tagging saved exchanges.
- Confirmation or undo for deletion.
- Saving the greeting, or a reply on its own without a message.
- A limit on the number of saved exchanges.
- Protection against the browser evicting stored data.

## Further Notes

- The sound rule is a first iteration. The intent is to try it and adjust once it has been used; the requirement behind it is that a user is never held in one view because something is speaking.
- The options under a reply were first opened by holding it for half a second. That was replaced by a tap, which is easier to discover and leaves text selection on touch screens alone. The empty list still explains it.
- `localStorage` was chosen over IndexedDB because the data is a small amount of text and a synchronous read is simpler. It is an easy decision to reverse, as only the storage module would change, so no ADR records it.
- This version of Next.js differs from earlier ones. Read the relevant guide in the installed package's docs before writing code, as the repository's agent instructions require.
