# server

more to be writen here

## Playlists

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
