# Pomodoro Tunes

Inspired by pomodoro videos, this is a chrome extenstion that keeps a work playlist tab and a break playlist tab open, and switches betweeen the two with timer. Works with YouTube and Bilibili links.
![Pomodoro Tunes icon](img_for_git.jpg)

## Install
1. Unzip this folder.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `pomodoro-tunes` folder.
   (Updating from an earlier version: replace the folder, then click the reload arrow on the extension's card.)
4. Pin the tomato icon to the toolbar.

## Use
1. Click the icon, paste the two playlist links, set the minutes (25 and 5 by default).
2. Pick a switch sound (use **Play sample** to hear it) and a volume.
3. Click **Start timer**. Both tabs open; the work playlist plays and the break playlist is paused.
4. When time is up the work tab pauses and the break tab plays, then back, until you click **Stop timer**.

If you already have a tab open on exactly the link you pasted, that tab is used instead of opening a new one.

The number on the icon is the minutes left (red = work, green = break).

## Playlist curation 
The extension works for both videos that is already a playlist and self-curated youtube/bilibili playlist. 
