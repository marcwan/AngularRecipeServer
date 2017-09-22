#!/bin/bash -x

rm -f ../static/images/*
cp no_recipe_photo.jpg ../static/images
cp recipes.json.start recipes.json
node server.js