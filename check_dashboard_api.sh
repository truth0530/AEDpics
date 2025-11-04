#!/bin/bash
# Get dashboard data from API (needs browser session cookie)
curl -s "http://localhost:3001/api/dashboard?sido=대구&dateRange=today" | jq '.data.dashboard.data[] | select(.region == "달성군" or .region == "중구") | {region, blockedAssigned, blockedFieldInspected, uninspectedAssigned, uninspectedFieldInspected}'
