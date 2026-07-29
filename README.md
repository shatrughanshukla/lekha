# Mazu Banking API

REST API for the Banking Money Transfer schema (`users`, `company`, `accounts`, `transfers`),
built with Go + Gin + PostgreSQL.

## Project layout

```
mazu-banking-api/
├── main.go                    # entry point — loads .env, connects DB, starts server
├── go.mod                     # module + dependency list
├── .env.example                # copy to .env and fill in your DB credentials
├── config/
│   └── database.go            # opens the Postgres connection pool
├── models/
│   ├── user.go                # User struct + request payload structs
│   ├── company.go
│   ├── account.go
│   └── transfer.go
├── handlers/                  # one file per entity — the actual endpoint logic
│   ├── user_handler.go
│   ├── company_handler.go
│   ├── account_handler.go
│   └── transfer_handler.go
└── routes/
    └── routes.go               # maps URLs + HTTP methods to handler functions
```

---

## Step-by-step: setting this up in VS Code

### 1. Install prerequisites (one-time, if not already done)
- **Go**: download from https://go.dev/dl/ and install. Verify with `go version` in a terminal.
- **VS Code Go extension**: open VS Code → Extensions icon (left sidebar, or `Ctrl+Shift+X`) →
  search **"Go"** (by the Go Team at Google) → Install.
- After installing, open any `.go` file once — VS Code will show a popup **"Install
  analysis tools"** in the bottom right. Click it. This installs `gopls` (the Go language
  server), `dlv` (debugger), and linters that power autocomplete, go-to-definition, and
  inline errors.
- **PostgreSQL**: make sure you already have it running locally (you used it earlier for
  the schema file) — you'll point this API at the same database.

### 2. Open the project folder
- `File → Open Folder…` → select the `mazu-banking-api` folder.
- Open the integrated terminal: `` Ctrl+` `` (backtick), or `Terminal → New Terminal`.
  You'll run every command below from here, inside this folder.

### 3. Download the Go dependencies
```bash
go mod tidy
```
This reads the `require` block in `go.mod`, downloads `gin`, `lib/pq`, `godotenv`,
`google/uuid`, and `golang.org/x/crypto`, and writes a `go.sum` lock file. You need
internet access for this step — it fetches straight from GitHub/pkg.go.dev.

### 4. Configure your database connection
```bash
cp .env.example .env
```
Then open `.env` in VS Code (click it in the file explorer) and fill in your real
Postgres values — same database you ran `mazu_banking_schema.sql` against earlier:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_actual_password
DB_NAME=mazu_test
DB_SSLMODE=disable
PORT=8080
```
`.env` is only read locally by `godotenv` in `main.go` — don't commit it to Git
(add it to `.gitignore`).

### 5. Run the server
```bash
go run main.go
```
You should see:
```
connected to database successfully
server starting on port 8080
```
Leave this terminal running — it's your live server. Visit
`http://localhost:8080/health` in a browser; you should get `{"status":"ok"}`.

### 6. Where to actually write/edit code
- **New endpoint for an existing entity** (e.g. "get all accounts for a company"):
  add a new function in the matching file under `handlers/`, then register its
  route in `routes/routes.go`.
- **New entity entirely** (e.g. `notes`, `attachments`): add a struct in a new file
  under `models/`, a new file under `handlers/` with its CRUD functions (copy the
  shape of `company_handler.go` — it's the simplest one), then a new route group in
  `routes/routes.go`.
- **Changing a table's columns**: update the matching struct in `models/`, then the
  SQL in whichever handler functions touch that table.
- After saving any `.go` file, VS Code's Go extension re-checks it instantly and
  underlines errors in red — you don't need to run anything to catch typos or wrong
  argument counts.

### 7. Test the endpoints
You don't need Postman — VS Code can do this natively:
- Install the **"REST Client"** extension (by Huachao Mao) from the Extensions tab.
- Create a file `requests.http` in the project root with content like:
  ```http
  ### Create a user
  POST http://localhost:8080/api/v1/users
  Content-Type: application/json

  {
    "name": "Asha Verma",
    "email": "asha@example.com",
    "password": "supersecret123"
  }

  ### List users
  GET http://localhost:8080/api/v1/users
  ```
- A small **"Send Request"** link appears above each block — click it and the
  response opens in a side panel. This is the fastest way to try every endpoint
  below without leaving VS Code.
- Alternatively, use `curl` in the integrated terminal, or import into Postman if
  you already use it.

### 8. Restarting after code changes
`go run main.go` does not hot-reload. Stop the server with `Ctrl+C` in its terminal
and re-run `go run main.go` after saving changes. (Optional: install
[air](https://github.com/air-verse/air) later for auto-reload on save — not needed
to get started.)

---

## API Reference

Base URL: `http://localhost:8080/api/v1`

### Users
| Method | Path | Body |
|---|---|---|
| POST | `/users` | `{name, email, password}` |
| GET | `/users` | — |
| GET | `/users/:id` | — |
| PUT | `/users/:id` | `{name?, email?}` |
| DELETE | `/users/:id` | — |

### Companies
| Method | Path | Body |
|---|---|---|
| POST | `/companies` | `{company_name, created_by}` |
| GET | `/companies` | — |
| GET | `/companies/:id` | — |
| PUT | `/companies/:id` | `{company_name, updated_by}` |
| DELETE | `/companies/:id` | — |

### Accounts
| Method | Path | Body |
|---|---|---|
| POST | `/accounts` | `{company_id, account_type, current_balance, created_by}` |
| GET | `/accounts?company_id=` | — (company_id filter optional) |
| GET | `/accounts/:id` | — |
| PUT | `/accounts/:id` | `{account_type?, is_active?, updated_by}` |
| DELETE | `/accounts/:id` | — |

### Transfers
| Method | Path | Body |
|---|---|---|
| POST | `/transfers` | `{company_id, transfer_type, from_account_id, to_account_id, amount, transfer_notes?, created_by_user}` |
| GET | `/transfers?company_id=&account_id=&status=` | — (all filters optional) |
| GET | `/transfers/:id` | — |
| PATCH | `/transfers/:id/status` | `{status, updated_by_user}` |

`POST /transfers` is the one endpoint with real logic behind it: it locks both
accounts, checks the source has enough balance and both accounts are active,
moves the money, and records the transfer — all inside one database transaction,
so a crash halfway through can never leave money deducted from one account
without appearing in the other.

## account_type / transfer_type / status values
These match the enums created in `mazu_banking_schema.sql`:
- `account_type`: `SAVINGS`, `CURRENT`, `CASH`, `OVERDRAFT`
- `transfer_type`: `INTERNAL`, `EXTERNAL`, `NEFT`, `RTGS`, `IMPS`, `UPI`
- `status`: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`, `REVERSED`
