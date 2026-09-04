#!/usr/bin/env python3
import hashlib
import json
import os
import re
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOST = os.environ.get('SYNC_HOST', '127.0.0.1')
PORT = int(os.environ.get('SYNC_PORT', '8788'))
DB_PATH = os.environ.get('SYNC_DB', '/opt/sync-service/sync.db')
MAX_BODY = 1024 * 1024
APP_RE = re.compile(r'^[a-z0-9][a-z0-9_-]{0,63}$')
KEY_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$')
ALLOWED_ORIGINS = {
    origin.strip() for origin in os.environ.get(
        'SYNC_ALLOWED_ORIGINS',
        'https://tangkk.github.io,http://localhost:8000,http://127.0.0.1:8000'
    ).split(',') if origin.strip()
}


def connect_db():
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA busy_timeout=5000')
    db.execute('''
        CREATE TABLE IF NOT EXISTS sync_state (
            account_hash TEXT NOT NULL,
            app TEXT NOT NULL,
            state_key TEXT NOT NULL,
            value_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (account_hash, app, state_key)
        )
    ''')
    return db


def account_hash(sync_key):
    return hashlib.sha256(sync_key.encode('utf-8')).hexdigest()


class Handler(BaseHTTPRequestHandler):
    server_version = 'TangkkSync/1.0'

    def log_message(self, fmt, *args):
        print(f'{self.address_string()} - {fmt % args}')

    def cors_origin(self):
        origin = self.headers.get('Origin', '')
        return origin if origin in ALLOWED_ORIGINS else ''

    def common_headers(self):
        origin = self.cors_origin()
        if origin:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Sync-Key')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        self.send_response(status)
        self.common_headers()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.common_headers()
        self.end_headers()

    def parse_app(self):
        path = urlparse(self.path).path.rstrip('/')
        match = re.fullmatch(r'/v1/([^/]+)/state', path)
        if not match:
            return None
        app = match.group(1)
        return app if APP_RE.fullmatch(app) else None

    def auth(self):
        key = self.headers.get('X-Sync-Key', '').strip()
        if not key or len(key) > 256:
            return None
        return account_hash(key)

    def read_body(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            return None
        if length <= 0 or length > MAX_BODY:
            return None
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode('utf-8'))
        except Exception:
            return None

    def load_state(self, account, app):
        with connect_db() as db:
            rows = db.execute(
                'SELECT state_key, value_json, updated_at FROM sync_state WHERE account_hash=? AND app=?',
                (account, app)
            ).fetchall()
        items = []
        for state_key, value_json, updated_at in rows:
            try:
                value = json.loads(value_json)
            except Exception:
                continue
            items.append({'key': state_key, 'value': value, 'updatedAt': updated_at})
        items.sort(key=lambda item: item['key'])
        return items

    def do_GET(self):
        path = urlparse(self.path).path.rstrip('/')
        if path == '/health':
            self.send_json(200, {'ok': True, 'time': int(time.time() * 1000)})
            return

        app = self.parse_app()
        if not app:
            self.send_json(404, {'error': 'not_found'})
            return
        account = self.auth()
        if not account:
            self.send_json(401, {'error': 'missing_sync_key'})
            return
        self.send_json(200, {'app': app, 'items': self.load_state(account, app)})

    def do_POST(self):
        app = self.parse_app()
        if not app:
            self.send_json(404, {'error': 'not_found'})
            return
        account = self.auth()
        if not account:
            self.send_json(401, {'error': 'missing_sync_key'})
            return
        payload = self.read_body()
        if not isinstance(payload, dict) or not isinstance(payload.get('items'), list):
            self.send_json(400, {'error': 'invalid_json'})
            return

        normalized = []
        for item in payload['items'][:100]:
            if not isinstance(item, dict):
                continue
            state_key = item.get('key')
            updated_at = item.get('updatedAt')
            if not isinstance(state_key, str) or not KEY_RE.fullmatch(state_key):
                continue
            if not isinstance(updated_at, int) or updated_at < 0:
                continue
            try:
                value_json = json.dumps(item.get('value'), ensure_ascii=False, separators=(',', ':'))
            except Exception:
                continue
            if len(value_json.encode('utf-8')) > 256 * 1024:
                continue
            normalized.append((state_key, value_json, updated_at))

        if not normalized and payload['items']:
            self.send_json(400, {'error': 'no_valid_items'})
            return

        with connect_db() as db:
            for state_key, value_json, updated_at in normalized:
                db.execute('''
                    INSERT INTO sync_state(account_hash, app, state_key, value_json, updated_at)
                    VALUES(?,?,?,?,?)
                    ON CONFLICT(account_hash, app, state_key) DO UPDATE SET
                        value_json=excluded.value_json,
                        updated_at=excluded.updated_at
                    WHERE excluded.updated_at >= sync_state.updated_at
                ''', (account, app, state_key, value_json, updated_at))
            db.commit()

        self.send_json(200, {'app': app, 'items': self.load_state(account, app)})


def main():
    os.makedirs(os.path.dirname(DB_PATH) or '.', exist_ok=True)
    with connect_db():
        pass
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f'sync service listening on http://{HOST}:{PORT}; db={DB_PATH}')
    server.serve_forever()


if __name__ == '__main__':
    main()
