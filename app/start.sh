#!/bin/sh
TARGET="${API_URL:-https://umarell-production.up.railway.app}"
sed "s|PROXY_TARGET|${TARGET}|g" /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
