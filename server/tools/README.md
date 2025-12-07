# Usage

**Requires ffmpeg and mediainfo cli**

Open a terminal in the directory of the set folders. Run the script like this:

```
pwsh -File "absolutepath\setcreator.ps1"
```

The script will create the following file structure inside the folder:

```
 📁 sets
 |\_📁'some set 1'
 |   \_ set.json
 |   \_ some set 1.mp3
 |
  \_📁 'johns very good set'
     \_ set.json
     \_ johns very good set.mp3
```

The script will find all subfolders of the directory and their audio files
and create a folder for each audio file with the name of the audio file.

The script can also be runned directly in the folder of the audio file and
it will create the same "sets" structure inside the folder. This structure
can then be merged with other 'sets' folders.

The set.json has to be filled with details about the title, author and coverfile.
