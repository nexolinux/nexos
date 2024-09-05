#!/bin/bash
git add .
echo "please provide your commit comment:"
read comment
git commit -m "$comment"
git push -u origin main
