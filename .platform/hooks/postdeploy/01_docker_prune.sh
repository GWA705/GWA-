#!/usr/bin/env bash
# Reclaim disk after each deploy so old Docker images / build cache can't pile
# up on the instance's root volume, fill it, and wedge the box (the root cause
# of the 2026-10-02 "No Data" outage). Best-effort: never fails the deploy.
# With the Immutable deploy policy every deploy is already a fresh instance, so
# this is belt-and-suspenders for any in-place operation (managed updates, etc.).
set -u
docker image prune -af   >/dev/null 2>&1 || true
docker container prune -f >/dev/null 2>&1 || true
docker builder prune -af  >/dev/null 2>&1 || true
exit 0
