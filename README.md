# HW3 – REST Service

A Node.js/Express REST service that handles three types of queries via a single GET endpoint.

## Endpoints

All queries go to `GET /` with **exactly one** of these query parameters:

| Parameter | Example | Returns |
|---|---|---|
| `queryAirportTemp` | `?queryAirportTemp=PRG` | Temperature in °C (number) |
| `queryStockPrice` | `?queryStockPrice=AAPL` | Stock price (number) |
| `queryEval` | `?queryEval=(2%2B3)*4` | Arithmetic result (number) |

**Response format:**
- Default: `application/json` — bare number e.g. `20.5`
- XML: send `Accept: application/xml` header → `<r>20.5</r>`

## External APIs used (all free, no API key)

- **Airport coords**: [airport-data.com](https://airport-data.com/api/doc.php)
- **Weather**: [Open-Meteo](https://open-meteo.com/) 
- **Stock prices**: Yahoo Finance v8 chart endpoint

## Local setup

```bash
npm install
node index.js          # runs on port 3000 by default
PORT=8080 node index.js  # custom port
```

## Deployment on aisa.fi.muni.cz (or any Linux server)

```bash
# 1. Copy files to the server
scp -r rest-service/ xlogin@aisa.fi.muni.cz:~/

# 2. SSH in
ssh xlogin@aisa.fi.muni.cz

# 3. Install Node.js if needed (or use module system)
module load nodejs   # on MetaCentrum / faculty machines

# 4. Install dependencies
cd ~/rest-service && npm install

# 5. Run in background (stays alive after logout)
nohup node index.js > service.log 2>&1 &
echo $! > service.pid   # save PID to stop it later

# 6. Check it works
curl "http://aisa.fi.muni.cz:3000/?queryEval=2%2B3"
# → 5

# 7. Submit to the checker
curl "http://andromeda.fi.muni.cz/~xbatko/homework3?email=YOUR_UCO@mail.muni.cz&url=http://aisa.fi.muni.cz:3000/"

# To stop the service later:
kill $(cat ~/rest-service/service.pid)
```

## Test examples

```bash
BASE=http://localhost:3000

# Arithmetic eval
curl "$BASE/?queryEval=(2%2B3)*4"          # → 20
curl "$BASE/?queryEval=7/2"                # → 3.5
curl "$BASE/?queryEval=100-1"              # → 99

# Stock price
curl "$BASE/?queryStockPrice=AAPL"         # → e.g. 189.3
curl "$BASE/?queryStockPrice=TSLA"

# Airport temperature
curl "$BASE/?queryAirportTemp=PRG"         # Prague Václav Havel
curl "$BASE/?queryAirportTemp=JFK"         # New York JFK
curl "$BASE/?queryAirportTemp=LHR"         # London Heathrow

# XML output
curl -H "Accept: application/xml" "$BASE/?queryEval=10-3"
# → <?xml version="1.0" encoding="UTF-8"?>
# → <r>7</r>

# Error cases
curl "$BASE/"                              # → 400 (no param)
curl "$BASE/?queryEval=1%2B1&queryStockPrice=AAPL"  # → 400 (two params)
```
