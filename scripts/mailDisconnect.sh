#!/usr/bin/env bash

bun x prisma db execute --stdin <<EOF
UPDATE auth_users
SET email_connected = false,
    gmail_access_token = NULL,
    gmail_refresh_token = NULL
WHERE id = 21;
EOF
