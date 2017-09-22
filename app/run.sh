#!/bin/bash -x

rm -f ../static/images/*
cp emptybowl.jpg ../static/images
cp recipes.json.start recipes.json
node server.js