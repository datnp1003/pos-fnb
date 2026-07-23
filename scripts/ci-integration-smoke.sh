#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_JAR="${RUNNER_TEMP:-/tmp}/pos-fnb-cookies.txt"
LOGIN_BODY="${RUNNER_TEMP:-/tmp}/pos-fnb-login-response.json"

wait_for_route() {
  local path="$1"
  local expected="$2"

  for attempt in $(seq 1 30); do
    local status
    status="$(curl -sS -o /dev/null -w "%{http_code}" "${BASE_URL}${path}" || true)"
    if [[ "$status" == "$expected" ]]; then
      return 0
    fi
    echo "Waiting for ${path}: got ${status}, expected ${expected} (${attempt}/30)"
    sleep 2
  done

  echo "Route ${path} did not return ${expected}" >&2
  return 1
}

assert_authenticated_route() {
  local path="$1"
  local status

  for attempt in $(seq 1 10); do
    status="$(curl -sS -b "$COOKIE_JAR" -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")"
    if [[ "$status" == "200" ]]; then
      return 0
    fi
    echo "Authenticated route ${path}: got ${status}, expected 200 (${attempt}/10)"
    sleep 2
  done

  echo "Authenticated route ${path} returned ${status}, expected 200" >&2
  echo "Response headers:" >&2
  curl -sS -b "$COOKIE_JAR" -D - -o /dev/null "${BASE_URL}${path}" >&2 || true
  return 1
}

rm -f "$COOKIE_JAR" "$LOGIN_BODY"

wait_for_route "/login" "200"

csrf_token="$(
  curl -sS -c "$COOKIE_JAR" "${BASE_URL}/api/auth/csrf" \
    | node -e 'let body = ""; process.stdin.on("data", chunk => body += chunk); process.stdin.on("end", () => process.stdout.write(JSON.parse(body).csrfToken || ""));'
)"

if [[ -z "$csrf_token" ]]; then
  echo "Could not fetch NextAuth CSRF token" >&2
  exit 1
fi

login_status="$(
  curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" -o "$LOGIN_BODY" -w "%{http_code}" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "username=admin" \
    --data-urlencode "password=admin123" \
    --data-urlencode "csrfToken=${csrf_token}" \
    --data-urlencode "callbackUrl=${BASE_URL}/dashboard" \
    --data-urlencode "json=true" \
    "${BASE_URL}/api/auth/callback/credentials"
)"

if [[ "$login_status" != "200" && "$login_status" != "302" ]]; then
  echo "Login returned ${login_status}, expected 200 or 302" >&2
  cat "$LOGIN_BODY" >&2
  exit 1
fi

# NextAuth returns HTTP 200/302 even when credentials are rejected — it redirects
# back to the sign-in page with an `error` query param. Catch that explicitly so a
# failed login is not mistaken for success.
if grep -q "error" "$LOGIN_BODY"; then
  echo "Login was rejected (error in callback response):" >&2
  cat "$LOGIN_BODY" >&2
  exit 1
fi

if ! grep -q "authjs.session-token" "$COOKIE_JAR"; then
  echo "No session cookie (authjs.session-token) set after login" >&2
  cat "$LOGIN_BODY" >&2
  exit 1
fi

assert_authenticated_route "/dashboard"
assert_authenticated_route "/order"
assert_authenticated_route "/inventory"
assert_authenticated_route "/cash"
assert_authenticated_route "/reports"
assert_authenticated_route "/settings"

echo "Integration smoke passed: login, auth session and protected POS routes are reachable."
