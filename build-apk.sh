#!/bin/bash
set -e
mkdir -p /home/runner/eas-tmp
TMPDIR=/home/runner/eas-tmp npx eas-cli build --profile preview --platform android --non-interactive
