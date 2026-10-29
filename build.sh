#!/bin/sh
# Wraps the artifact page (mtg-quest.html) in a full HTML document so it can be opened directly from disk or GitHub Pages.
set -e
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  printf '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%%}[hidden]{display:none!important}</style>\n</head>\n<body>\n'
  cat mtg-quest.html
  printf '\n</body>\n</html>\n'
} > index.html
echo "Built index.html"
