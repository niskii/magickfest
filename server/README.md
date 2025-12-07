# server

more to be writen here

configuration file [./config/settings.json](config/settings.json) to set cors origin and port

## Start options:

```txt
Save and load progress of the playlist
--usestate

Loop the playing set
--loop

Which set to start
--setindex #

How much time to skip ahead in the set. Parses the input of the format H?H:MM:SS, M?M:SS or plain number.
--forward time

Unix timestamp for when the player should start.
--scheduledstart unix time

The json playlist file path
--playlist path
```

## Playlists

A playlist has the following format:

```json
{
  "Sets": [
    "sets/my first set yay/set.json",
    "sets/slimy beat party/set.json",
    "sets/my first set part 2/set.json"
  ]
}
```

To make the relativity of the files work, the playlist file, and the sets it
references, must be in the following structure:

```
pathtoplaylist/playlist.json
pathtoplaylist/sets/*
```

More about set generation in [./tools/README.md](tools/README.md)

This structure avoids the need to move folders around when you create a new
playlist. The json itself is just an array of the set.json files to be played,
and the order of the sets is given the index of the array. In the
_config/settings.json_, the path to the playlist.json can be defined.
