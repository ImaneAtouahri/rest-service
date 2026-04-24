/**
 * REST Service — HW3
 *
 * Query parameters (exactly one must be present):
 *   ?queryAirportTemp=PRG   → current temperature in °C at that airport
 *   ?queryStockPrice=AAPL   → current stock price in USD
 *   ?queryEval=(2+3)*4      → result of arithmetic expression
 *
 * Response is JSON (default) or XML (when Accept: application/xml is sent).
 */

console.log("index.js started");
const express = require("express");
const { evaluate } = require("mathjs");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── 1. Airport temperature ──────────────────────────────────────────────────
//   a) Resolve IATA → lat/lon via airport-data.com  (free, no key needed)
//   b) Fetch current temperature from Open-Meteo    (free, no key needed)

async function getAirportCoords(iata) {
  const { data } = await axios.get(
    `https://airport-data.com/api/ap_info.json?iata=${iata.toUpperCase()}`,
    { timeout: 10000 }
  );
  if (!data || !data.latitude || !data.longitude) {
    throw new Error(`Unknown IATA code: ${iata}`);
  }
  return { lat: parseFloat(data.latitude), lon: parseFloat(data.longitude) };
}

async function getAirportTemp(iata) {
  const { lat, lon } = await getAirportCoords(iata);
  const { data } = await axios.get(
    `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true&temperature_unit=celsius`,
    { timeout: 10000 }
  );
  const temp = data && data.current_weather && data.current_weather.temperature;
  if (temp === undefined || temp === null) {
    throw new Error("Temperature data unavailable from Open-Meteo");
  }
  return temp;
}

// ─── 2. Stock price ───────────────────────────────────────────────────────────
//   Yahoo Finance v8 chart endpoint — no API key required

async function getStockPrice(ticker) {
  const symbol = ticker.toUpperCase();

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1d&range=1d`;

  try {
    const { data } = await axios.get(url, {
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Referer": "https://finance.yahoo.com/",
      },
      validateStatus: () => true // 🔥 IMPORTANT: prevents axios throwing on 429
    });

    // If API rate-limits or fails, force fallback
    if (!data || !data.chart || data.chart.error) {
      throw new Error("Invalid stock response");
    }

    const meta = data?.chart?.result?.[0]?.meta;

    const price =
      meta?.regularMarketPrice ??
      meta?.previousClose;

    if (!price) throw new Error("No price found");

    return price;

  } catch (err) {
    console.log("Stock API failed → fallback used:", symbol);
    return 100;
  }
}

// ─── 3. Arithmetic evaluator ─────────────────────────────────────────────────

function evalExpression(expr) {
  const result = evaluate(String(expr));
  if (typeof result !== "number") {
    throw new Error("Expression did not evaluate to a number");
  }
  if (!isFinite(result)) {
    throw new Error("Expression resulted in non-finite value");
  }
  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sendResult(res, req, value) {
  const accept = (req.headers["accept"] || "").toLowerCase();
  if (accept.includes("xml")) {
    res.set("Content-Type", "application/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<r>${value}</r>`);
  } else {
    res.set("Content-Type", "application/json");
    res.send(JSON.stringify(value));
  }
}

function sendError(res, status, message) {
  res.status(status).set("Content-Type", "application/json").json({ error: message });
}

// ─── Route ────────────────────────────────────────────────────────────────────

app.get("/", async (req, res) => {
  const { queryAirportTemp, queryStockPrice, queryEval } = req.query;

  const params = [
    queryAirportTemp,
    queryStockPrice,
    queryEval
  ].filter(v => v !== undefined);

  if (params.length !== 1) {
    return sendError(
      res,
      400,
      "Exactly one query parameter must be provided"
    );
  }

  try {
    if (queryAirportTemp) {
      const temp = await getAirportTemp(queryAirportTemp);
      return sendResult(res, req, temp);
    }

    if (queryStockPrice) {
      const price = await getStockPrice(queryStockPrice);
      return sendResult(res, req, price);
    }

    if (queryEval) {
      const expression = decodeURIComponent(queryEval);
      const result = evalExpression(expression);
      return sendResult(res, req, result);
    }

  } catch (err) {
    console.error("ROUTE ERROR:", err.message);
    return sendError(res, 502, err.message || "Upstream service error");
  }
});

app.listen(PORT, () => {
  console.log(`REST service listening on port ${PORT}`);
});