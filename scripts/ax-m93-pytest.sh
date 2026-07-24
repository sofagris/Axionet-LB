#!/bin/sh
set -e
cd /home/cursor/src/axionet-lb/backend
docker run --rm -v /home/cursor/src/axionet-lb/backend:/work -w /work python:3.12-slim sh -c '
pip install -q -e ".[dev]"
pytest tests/test_vips_api.py -q
'
