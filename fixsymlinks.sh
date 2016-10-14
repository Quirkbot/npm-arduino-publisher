#/bin/bash

for f in $(find ./dist -maxdepth 20 -type l)
do
    SRC="$(dirname $f)/$(readlink "$f")"
    DST="$f"
    echo "$SRC -> $DST"
    rm "$DST"
    cp "$SRC" "$DST"
done
